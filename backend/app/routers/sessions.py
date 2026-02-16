import base64
import logging
from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models.course import get_course, search_course_snippets
from app.models.session import create_session, get_session, list_sessions, update_session
from app.schemas.session import (
    MicroLessonCreate,
    SessionCreate,
    SessionHistoryItem,
    SessionResponse,
)
from app.services.ai_service import AIServiceError, analyze_problem, generate_micro_lesson
from app.services.micro_lesson_service import prepare_micro_lesson_steps

router = APIRouter()
logger = logging.getLogger(__name__)

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def _error_message(exc: Exception) -> str:
    msg = str(exc).strip()
    return msg if msg else f"{type(exc).__name__}"


def _build_session_response(session: dict[str, Any]) -> SessionResponse:
    confusion_state = session.get("confusion_state")
    if not isinstance(confusion_state, dict):
        confusion_state = {}
    return SessionResponse(
        session_id=session["session_id"],
        title=session["title"],
        subject=session["subject"],
        problem_text=session.get("problem_text"),
        step_count=session["step_count"],
        status=session["status"],
        voice_status=session.get("voice_status"),
        build_stage=session.get("build_stage"),
        audio_status=session.get("audio_status"),
        steps=session.get("steps"),
        created_at=session.get("created_at"),
        updated_at=session.get("updated_at"),
        course_id=session.get("course_id"),
        course_label=session.get("course_label"),
        confusion_score=confusion_state.get("score"),
        confusion_level=confusion_state.get("level"),
        adaptation_mode=confusion_state.get("adaptation_mode"),
        lesson_type=session.get("lesson_type"),
        include_voice=session.get("include_voice"),
    )


def _resolve_course_context(
    *,
    course_id: str | None,
    problem_text: str,
    subject_hint: str | None,
    top_k: int = 5,
) -> tuple[str | None, list[dict[str, Any]]]:
    if not course_id:
        return None, []

    course = get_course(course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    course_label = course.get("label")
    retrieval_query = " ".join(
        part.strip()
        for part in [problem_text, subject_hint or "", course_label or ""]
        if part and part.strip()
    )
    snippets = search_course_snippets(course_id, retrieval_query, top_k=top_k)
    return course_label, snippets


def _create_and_store_session(
    *,
    title: str,
    subject: str,
    problem_text: str,
    image_b64: str | None,
    steps: list[dict[str, Any]],
    course_id: str | None,
    course_label: str | None,
    lesson_type: str,
    include_voice: bool,
) -> dict[str, Any]:
    session = create_session(
        title=title,
        subject=subject,
        problem_text=problem_text,
        image_b64=image_b64,
        step_count=len(steps),
        course_id=course_id,
        course_label=course_label,
        lesson_type=lesson_type,
        include_voice=include_voice,
    )
    update_session(
        session["session_id"],
        title=title,
        subject=subject,
        steps=steps,
        step_count=len(steps),
        build_stage="script_ready",
    )
    return get_session(session["session_id"]) or session


@router.get("", response_model=list[SessionHistoryItem])
async def get_session_history():
    """List prior sessions for history navigation."""
    sessions = list_sessions()
    return [
        SessionHistoryItem(
            session_id=session["session_id"],
            title=session["title"],
            subject=session["subject"],
            problem_text=session.get("problem_text"),
            status=session["status"],
            step_count=session["step_count"],
            updated_at=session.get("updated_at"),
            created_at=session.get("created_at"),
            course_id=session.get("course_id"),
            course_label=session.get("course_label"),
            lesson_type=session.get("lesson_type"),
        )
        for session in sessions
    ]


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_info(session_id: str):
    """Retrieve session metadata."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return _build_session_response(session)


@router.post("", response_model=SessionResponse)
async def create_session_json(body: SessionCreate):
    """Create a new tutoring session from a JSON body with problem text."""
    try:
        problem_text = body.problem_text or ""
        course_id = body.course_id or None
        course_label, course_snippets = _resolve_course_context(
            course_id=course_id,
            problem_text=problem_text,
            subject_hint=body.subject_hint,
            top_k=5,
        )

        try:
            result = await analyze_problem(
                problem_text=problem_text,
                subject_hint=body.subject_hint,
                course_label=course_label,
                course_snippets=course_snippets,
            )
        except AIServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        resolved_problem_text = (
            problem_text.strip() or str(result.get("problem_statement", "")).strip()
        )
        session = _create_and_store_session(
            title=result["title"],
            subject=result["subject"],
            problem_text=resolved_problem_text,
            image_b64=None,
            steps=result["steps"],
            course_id=course_id,
            course_label=course_label,
            lesson_type="full",
            include_voice=True,
        )
        return _build_session_response(session)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Session creation failed")
        raise HTTPException(
            status_code=500,
            detail=f"Session creation failed: {_error_message(exc)}",
        ) from exc


@router.post("/upload", response_model=SessionResponse)
async def create_session_upload(
    file: UploadFile = File(...),
    problem_text: Optional[str] = Form(default=""),
    subject_hint: Optional[str] = Form(default=None),
    course_id: Optional[str] = Form(default=None),
):
    """Create a new tutoring session from a file upload (image of a problem)."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image.")

    contents = await file.read()
    if len(contents) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    try:
        image_b64 = base64.b64encode(contents).decode("utf-8")
        resolved_course_id = course_id or None
        course_label, course_snippets = _resolve_course_context(
            course_id=resolved_course_id,
            problem_text=problem_text or "",
            subject_hint=subject_hint,
            top_k=5,
        )

        try:
            result = await analyze_problem(
                problem_text=problem_text or "",
                image_b64=image_b64,
                subject_hint=subject_hint,
                course_label=course_label,
                course_snippets=course_snippets,
            )
        except AIServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        resolved_problem_text = (
            (problem_text or "").strip()
            or str(result.get("problem_statement", "")).strip()
        )
        session = _create_and_store_session(
            title=result["title"],
            subject=result["subject"],
            problem_text=resolved_problem_text,
            image_b64=image_b64,
            steps=result["steps"],
            course_id=resolved_course_id,
            course_label=course_label,
            lesson_type="full",
            include_voice=True,
        )
        return _build_session_response(session)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Session upload creation failed")
        raise HTTPException(
            status_code=500,
            detail=f"Session creation failed: {_error_message(exc)}",
        ) from exc


@router.post("/micro", response_model=SessionResponse)
async def create_micro_session_json(body: MicroLessonCreate):
    """Create a short micro-lesson from typed text."""
    try:
        problem_text = body.problem_text or ""
        course_id = body.course_id or None
        include_voice = bool(body.include_voice)
        course_label, course_snippets = _resolve_course_context(
            course_id=course_id,
            problem_text=problem_text,
            subject_hint=body.subject_hint,
            top_k=6,
        )

        try:
            result = await generate_micro_lesson(
                problem_text=problem_text,
                subject_hint=body.subject_hint,
                course_label=course_label,
                course_snippets=course_snippets,
            )
        except AIServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        prepared_steps = await prepare_micro_lesson_steps(
            result["steps"], include_voice=include_voice
        )
        session = _create_and_store_session(
            title=result["title"],
            subject=result["subject"],
            problem_text=problem_text,
            image_b64=None,
            steps=prepared_steps,
            course_id=course_id,
            course_label=course_label,
            lesson_type="micro",
            include_voice=include_voice,
        )
        return _build_session_response(session)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Micro session creation failed")
        raise HTTPException(
            status_code=500,
            detail=f"Session creation failed: {_error_message(exc)}",
        ) from exc


@router.post("/micro/upload", response_model=SessionResponse)
async def create_micro_session_upload(
    file: UploadFile = File(...),
    problem_text: Optional[str] = Form(default=""),
    subject_hint: Optional[str] = Form(default=None),
    course_id: Optional[str] = Form(default=None),
    include_voice: bool = Form(default=True),
):
    """Create a short micro-lesson from uploaded image/text."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image.")

    contents = await file.read()
    if len(contents) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    try:
        image_b64 = base64.b64encode(contents).decode("utf-8")
        resolved_course_id = course_id or None
        course_label, course_snippets = _resolve_course_context(
            course_id=resolved_course_id,
            problem_text=problem_text or "",
            subject_hint=subject_hint,
            top_k=6,
        )

        try:
            result = await generate_micro_lesson(
                problem_text=problem_text or "",
                image_b64=image_b64,
                subject_hint=subject_hint,
                course_label=course_label,
                course_snippets=course_snippets,
            )
        except AIServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        prepared_steps = await prepare_micro_lesson_steps(
            result["steps"], include_voice=bool(include_voice)
        )
        session = _create_and_store_session(
            title=result["title"],
            subject=result["subject"],
            problem_text=problem_text or "",
            image_b64=image_b64,
            steps=prepared_steps,
            course_id=resolved_course_id,
            course_label=course_label,
            lesson_type="micro",
            include_voice=bool(include_voice),
        )
        return _build_session_response(session)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Micro upload session creation failed")
        raise HTTPException(
            status_code=500,
            detail=f"Session creation failed: {_error_message(exc)}",
        ) from exc
