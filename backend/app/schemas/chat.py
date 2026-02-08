from pydantic import BaseModel
from typing import Optional

from app.schemas.lesson import AnimationEvent


class ChatContext(BaseModel):
    current_step: Optional[int] = None
    current_step_title: Optional[str] = None
    current_event_type: Optional[str] = None
    active_narration: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    context: Optional[ChatContext] = None


class ChatResponse(BaseModel):
    role: str  # "tutor"
    message: str
    math_blocks: list = []
    related_step: Optional[int] = None
    narration: Optional[str] = None
    audio_url: Optional[str] = None
    audio_duration: Optional[float] = None
    events: Optional[list[AnimationEvent]] = None
