from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.models.session import get_session
from app.services.lesson_service import stream_lesson_steps

router = APIRouter()


@router.get("/{session_id}/lesson/stream")
async def stream_lesson(session_id: str):
    """SSE endpoint that streams lesson steps one at a time."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    async def event_generator():
        async for item in stream_lesson_steps(session_id):
            yield {
                "event": item["event"],
                "data": item["data"],
            }

    return EventSourceResponse(event_generator(), ping=10)
