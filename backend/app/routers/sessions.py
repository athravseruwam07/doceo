import base64
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

logger = logging.getLogger(__name__)

from app.schemas.session import SessionCreate, SessionResponse, SessionHistoryItem
from app.models.session import create_session, get_session, list_sessions, update_session
from app.services.ai_service import analyze_problem
from app.auth import get_current_user_id
from app.database import get_db

router = APIRouter()


def _error_message(exc: Exception) -> str:
    msg = str(exc).strip()
    return msg if msg else f"{type(exc).__name__}"


@router.get("", response_model=list[SessionHistoryItem])
async def get_session_history(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List prior sessions for history navigation."""
    sessions = await list_sessions(db, user_id)
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
        )
        for session in sessions
    ]


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_info(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve session metadata."""
    session = await get_session(db, session_id, user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
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
    )


@router.post("", response_model=SessionResponse)
async def create_session_json(
    body: SessionCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new tutoring session from a JSON body with problem text."""
    problem_text = body.problem_text or ""

    try:
        result = await analyze_problem(problem_text=problem_text)
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"AI service error: {_error_message(e)}",
        )

    resolved_problem_text = (problem_text or result.get("problem_statement") or "").strip()

    session = await create_session(
        db,
        user_id=user_id,
        title=result["title"],
        subject=result["subject"],
        problem_text=resolved_problem_text,
        step_count=len(result["steps"]),
    )

    await update_session(db, session["session_id"], steps=result["steps"])
    await update_session(db, session["session_id"], build_stage="script_ready")

    return SessionResponse(
        session_id=session["session_id"],
        title=result["title"],
        subject=result["subject"],
        problem_text=resolved_problem_text,
        step_count=len(result["steps"]),
        status=session["status"],
        voice_status=session.get("voice_status"),
        build_stage="script_ready",
        audio_status=session.get("audio_status"),
        steps=result["steps"],
    )


@router.post("/upload", response_model=SessionResponse)
async def create_session_upload(
    file: UploadFile = File(...),
    problem_text: Optional[str] = Form(default=""),
    subject_hint: Optional[str] = Form(default=None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new tutoring session from a file upload (image of a problem)."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image.")

    contents = await file.read()
    max_size = 10 * 1024 * 1024
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    image_b64 = base64.b64encode(contents).decode("utf-8")

    try:
        result = await analyze_problem(
            problem_text=problem_text or "",
            image_b64=image_b64,
        )
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"AI service error: {_error_message(e)}",
        )

    resolved_problem_text = ((problem_text or "").strip() or str(result.get("problem_statement", "")).strip())

    session = await create_session(
        db,
        user_id=user_id,
        title=result["title"],
        subject=result["subject"],
        problem_text=resolved_problem_text,
        image_b64=image_b64,
        step_count=len(result["steps"]),
    )

    await update_session(db, session["session_id"], steps=result["steps"])
    await update_session(db, session["session_id"], build_stage="script_ready")

    return SessionResponse(
        session_id=session["session_id"],
        title=result["title"],
        subject=result["subject"],
        problem_text=resolved_problem_text,
        step_count=len(result["steps"]),
        status=session["status"],
        voice_status=session.get("voice_status"),
        build_stage="script_ready",
        audio_status=session.get("audio_status"),
        steps=result["steps"],
    )
