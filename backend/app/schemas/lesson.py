from pydantic import BaseModel
from typing import Literal, Optional


class MathBlock(BaseModel):
    latex: str
    display: bool = True  # True = block display, False = inline


class AnimationEventPayload(BaseModel):
    """Payload for a single animation event on the whiteboard."""
    text: Optional[str] = None
    latex: Optional[str] = None
    display: Optional[bool] = None
    position: Optional[Literal["top", "center", "bottom"]] = None
    annotation_type: Optional[Literal["highlight", "underline", "circle", "box"]] = None
    target_id: Optional[str] = None
    step_number: Optional[int] = None
    step_title: Optional[str] = None
    # Voice fields — populated by backend after ElevenLabs generation
    audio_url: Optional[str] = None
    audio_duration: Optional[float] = None


class AnimationEvent(BaseModel):
    """A single granular teaching event in the whiteboard timeline.

    Types:
      - narrate: Tutor speaks (text is what they say, audio_url/duration filled by backend)
      - write_equation: LaTeX equation appears on whiteboard
      - write_text: Plain text appears on whiteboard
      - annotate: Highlight/underline/circle an existing element
      - clear_section: Clear a portion of the whiteboard
      - pause: Brief pause between ideas
      - step_marker: Marks the beginning of a new step (metadata only)
    """
    id: str
    type: Literal[
        "narrate",
        "write_equation",
        "write_text",
        "annotate",
        "clear_section",
        "pause",
        "step_marker",
    ]
    duration: float  # milliseconds — set by backend (audio-driven for narrate, algorithmic for others)
    payload: AnimationEventPayload


class LessonStep(BaseModel):
    step_number: int
    title: str
    content: str  # Markdown with inline $...$ math (kept for backward compat / summary)
    math_blocks: list[MathBlock] = []
    hint: Optional[str] = None
    narration: Optional[str] = None  # Full step narration (kept for backward compat)
    audio_url: Optional[str] = None  # Step-level audio (kept for backward compat)
    audio_duration: Optional[float] = None
    # NEW: Granular teaching events — the real timeline
    events: list[AnimationEvent] = []


class LessonComplete(BaseModel):
    message: str
    total_steps: int
