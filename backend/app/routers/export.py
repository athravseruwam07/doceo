from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.export import ExportResponse
from app.models.session import get_session
from app.auth import get_current_user_id
from app.database import get_db

router = APIRouter()


@router.get("/{session_id}/export", response_model=ExportResponse)
async def export_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Export a complete session including all steps and chat history."""
    session = await get_session(db, session_id, user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return ExportResponse(
        session_id=session["session_id"],
        title=session["title"],
        subject=session["subject"],
        steps=session.get("steps", []),
        chat_log=session.get("chat_log", []),
        exam_materials=session.get("exam_materials", []),
        exam_cram=session.get("exam_cram"),
    )
