import base64

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional

from app.models.course import get_course, search_course_snippets
from app.schemas.session import SessionCreate, SessionResponse
from app.models.session import create_session, get_session
from app.services.ai_service import AIServiceError, analyze_problem

router = APIRouter()


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_info(session_id: str):
    """Retrieve session metadata."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse(
        session_id=session["session_id"],
        title=session["title"],
        subject=session["subject"],
        step_count=session["step_count"],
        status=session["status"],
        created_at=session.get("created_at"),
        course_id=session.get("course_id"),
        course_label=session.get("course_label"),
    )


@router.post("", response_model=SessionResponse)
async def create_session_json(body: SessionCreate):
    """Create a new tutoring session from a JSON body with problem text."""
    try:
        problem_text = body.problem_text or ""
        course_id = body.course_id
        course_label: str | None = None
        course_snippets = []

        if course_id:
            course = get_course(course_id)
            if course is None:
                raise HTTPException(status_code=404, detail="Course not found")
            course_label = course.get("label")
            retrieval_query = " ".join(
                part.strip()
                for part in [problem_text, body.subject_hint or "", course_label or ""]
                if part and part.strip()
            )
            course_snippets = search_course_snippets(course_id, retrieval_query, top_k=5)

        try:
            result = await analyze_problem(
                problem_text=problem_text,
                subject_hint=body.subject_hint,
                course_label=course_label,
                course_snippets=course_snippets,
            )
        except AIServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        session = create_session(
            title=result["title"],
            subject=result["subject"],
            problem_text=problem_text,
            step_count=len(result["steps"]),
            course_id=course_id,
            course_label=course_label,
        )

        # Store the generated steps in the session
        from app.models.session import update_session

        update_session(session["session_id"], steps=result["steps"])

        return SessionResponse(
            session_id=session["session_id"],
            title=result["title"],
            subject=result["subject"],
            step_count=len(result["steps"]),
            status=session["status"],
            created_at=session.get("created_at"),
            course_id=course_id,
            course_label=course_label,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Session creation failed: {exc}") from exc


@router.post("/upload", response_model=SessionResponse)
async def create_session_upload(
    file: UploadFile = File(...),
    problem_text: Optional[str] = Form(default=""),
    subject_hint: Optional[str] = Form(default=None),
    course_id: Optional[str] = Form(default=None),
):
    """Create a new tutoring session from a file upload (image of a problem)."""
    try:
        contents = await file.read()
        image_b64 = base64.b64encode(contents).decode("utf-8")
        course_label: str | None = None
        course_snippets = []

        if course_id:
            course = get_course(course_id)
            if course is None:
                raise HTTPException(status_code=404, detail="Course not found")
            course_label = course.get("label")
            retrieval_query = " ".join(
                part.strip()
                for part in [problem_text or "", subject_hint or "", course_label or ""]
                if part and part.strip()
            )
            course_snippets = search_course_snippets(course_id, retrieval_query, top_k=5)

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

        session = create_session(
            title=result["title"],
            subject=result["subject"],
            problem_text=problem_text or "",
            image_b64=image_b64,
            step_count=len(result["steps"]),
            course_id=course_id,
            course_label=course_label,
        )

        # Store the generated steps in the session
        from app.models.session import update_session

        update_session(session["session_id"], steps=result["steps"])

        return SessionResponse(
            session_id=session["session_id"],
            title=result["title"],
            subject=result["subject"],
            step_count=len(result["steps"]),
            status=session["status"],
            created_at=session.get("created_at"),
            course_id=course_id,
            course_label=course_label,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Session creation failed: {exc}") from exc
