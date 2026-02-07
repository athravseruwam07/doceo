import base64

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional

from app.schemas.session import SessionCreate, SessionResponse
from app.models.session import create_session, get_session
from app.services.ai_service import analyze_problem

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
    )


@router.post("", response_model=SessionResponse)
async def create_session_json(body: SessionCreate):
    """Create a new tutoring session from a JSON body with problem text."""
    problem_text = body.problem_text or ""

    result = await analyze_problem(problem_text=problem_text)

    session = create_session(
        title=result["title"],
        subject=result["subject"],
        problem_text=problem_text,
        step_count=len(result["steps"]),
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
    )


@router.post("/upload", response_model=SessionResponse)
async def create_session_upload(
    file: UploadFile = File(...),
    problem_text: Optional[str] = Form(default=""),
    subject_hint: Optional[str] = Form(default=None),
):
    """Create a new tutoring session from a file upload (image of a problem)."""
    contents = await file.read()
    image_b64 = base64.b64encode(contents).decode("utf-8")

    result = await analyze_problem(
        problem_text=problem_text or "",
        image_b64=image_b64,
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

    return SessionResponse(
        session_id=session["session_id"],
        title=result["title"],
        subject=result["subject"],
        step_count=len(result["steps"]),
        status=session["status"],
    )
