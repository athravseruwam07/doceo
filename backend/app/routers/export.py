from fastapi import APIRouter, HTTPException

from app.schemas.export import ExportResponse
from app.models.session import get_session

router = APIRouter()


@router.get("/{session_id}/export", response_model=ExportResponse)
async def export_session(session_id: str):
    """Export a complete session including all steps and chat history."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return ExportResponse(
        session_id=session["session_id"],
        title=session["title"],
        subject=session["subject"],
        steps=session.get("steps", []),
        chat_log=session.get("chat_log", []),
        lesson_type=session.get("lesson_type"),
        include_voice=session.get("include_voice"),
        confusion_state=session.get("confusion_state"),
        exam_materials=session.get("exam_materials", []),
        exam_cram=session.get("exam_cram"),
    )
