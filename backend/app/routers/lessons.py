from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.models.session import get_session
from app.services.lesson_service import stream_lesson_steps
from app.auth import get_current_user_id
from app.database import get_db

router = APIRouter()


@router.get("/{session_id}/lesson/stream")
async def stream_lesson(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """SSE endpoint that streams lesson steps one at a time."""
    session = await get_session(db, session_id, user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    async def event_generator():
        async for item in stream_lesson_steps(session_id, db):
            yield {
                "event": item["event"],
                "data": item["data"],
            }

    return EventSourceResponse(event_generator(), ping=10)
