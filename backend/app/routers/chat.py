from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.chat import ChatRequest, ChatResponse
from app.models.session import get_session
from app.services.chat_service import handle_message
from app.services.ai_service import AIServiceError
from app.auth import get_current_user_id
from app.database import get_db

router = APIRouter()


@router.post("/{session_id}/chat", response_model=ChatResponse)
async def chat(
    session_id: str,
    body: ChatRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to the AI tutor and receive a response."""
    session = await get_session(db, session_id, user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    context = body.context.model_dump(exclude_none=True) if body.context else None
    try:
        response = await handle_message(
            session_id,
            body.message,
            context=context,
            user_id=user_id,
        )
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if response is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return ChatResponse(**response)
