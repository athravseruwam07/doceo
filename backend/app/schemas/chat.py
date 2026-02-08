from typing import Literal, Optional

from pydantic import BaseModel, Field


class ChatContext(BaseModel):
    current_step: Optional[int] = None
    current_step_title: Optional[str] = None
    current_event_type: Optional[str] = None
    active_narration: Optional[str] = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    context: Optional[ChatContext] = None


class MathBlock(BaseModel):
    latex: str
    display: bool = True


class EventPayload(BaseModel):
    text: Optional[str] = None
    latex: Optional[str] = None
    display: Optional[bool] = None
    position: Optional[Literal["top", "center", "bottom", "side"]] = None
    stepNumber: Optional[int] = None
    stepTitle: Optional[str] = None


class ChatEvent(BaseModel):
    id: str
    type: Literal[
        "step_marker",
        "narrate",
        "write_equation",
        "write_text",
        "annotate",
        "pause",
        "clear_section",
        "transition",
    ]
    duration: int
    payload: EventPayload = Field(default_factory=EventPayload)


class ChatResponse(BaseModel):
    role: Literal["tutor"]
    message: str
    math_blocks: list[MathBlock] = Field(default_factory=list)
    related_step: Optional[int] = None
    narration: Optional[str] = None
    audio_url: Optional[str] = None
    audio_duration: Optional[float] = None
    events: list[ChatEvent] = Field(default_factory=list)
