import base64
import logging

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional

logger = logging.getLogger(__name__)

from app.schemas.session import SessionCreate, SessionResponse
from app.models.session import create_session, get_session
from app.services.ai_service import analyze_problem

router = APIRouter()


def _error_message(exc: Exception) -> str:
    msg = str(exc).strip()
    return msg if msg else f"{type(exc).__name__}"


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
        voice_status=session.get("voice_status"),
        build_stage=session.get("build_stage"),
    )


@router.post("", response_model=SessionResponse)
async def create_session_json(body: SessionCreate):
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

    session = create_session(
        title=result["title"],
        subject=result["subject"],
        problem_text=problem_text,
        step_count=len(result["steps"]),
    )

    # Store the generated steps in the session
    from app.models.session import update_session

    update_session(session["session_id"], steps=result["steps"])
    update_session(session["session_id"], build_stage="script_ready")

    return SessionResponse(
        session_id=session["session_id"],
        title=result["title"],
        subject=result["subject"],
        step_count=len(result["steps"]),
        status=session["status"],
        voice_status=session.get("voice_status"),
        build_stage="script_ready",
    )


@router.post("/upload", response_model=SessionResponse)
async def create_session_upload(
    file: UploadFile = File(...),
    problem_text: Optional[str] = Form(default=""),
    subject_hint: Optional[str] = Form(default=None),
):
    """Create a new tutoring session from a file upload (image of a problem)."""
    # Validate content type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image.")

    # Read and validate file size
    contents = await file.read()
    max_size = 10 * 1024 * 1024  # 10MB
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

    session = create_session(
        title=result["title"],
        subject=result["subject"],
        problem_text=problem_text or "",
        image_b64=image_b64,
        step_count=len(result["steps"]),
    )

    # Store the generated steps in the session
    from app.models.session import update_session

    update_session(session["session_id"], steps=result["steps"])
    update_session(session["session_id"], build_stage="script_ready")

    return SessionResponse(
        session_id=session["session_id"],
        title=result["title"],
        subject=result["subject"],
        step_count=len(result["steps"]),
        status=session["status"],
        voice_status=session.get("voice_status"),
        build_stage="script_ready",
    )
