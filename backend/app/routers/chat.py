from fastapi import APIRouter, HTTPException

from app.schemas.chat import ChatRequest, ChatResponse
from app.models.session import get_session
from app.services.chat_service import handle_message
from app.services.ai_service import AIServiceError

router = APIRouter()


@router.post("/{session_id}/chat", response_model=ChatResponse)
async def chat(session_id: str, body: ChatRequest):
    """Send a message to the AI tutor and receive a response."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    context = body.context.model_dump(exclude_none=True) if body.context else None
    try:
        response = await handle_message(session_id, body.message, context=context)
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if response is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return ChatResponse(**response)
