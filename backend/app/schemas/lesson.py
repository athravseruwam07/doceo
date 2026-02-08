from pydantic import BaseModel, Field, AliasChoices
from typing import Literal, Optional


class MathBlock(BaseModel):
    latex: str
    display: bool = True  # True = block display, False = inline


class BoardPoint(BaseModel):
    x: float
    y: float


class EventStyle(BaseModel):
    color: Optional[str] = None
    stroke_width: Optional[float] = Field(
        default=None,
        validation_alias=AliasChoices("stroke_width", "strokeWidth"),
    )
    emphasis: Optional[Literal["normal", "key", "final"]] = None


class AnimationEventPayload(BaseModel):
    """Payload for a single animation event on the whiteboard."""
    text: Optional[str] = None
    latex: Optional[str] = None
    display: Optional[bool] = None
    position: Optional[Literal["top", "center", "bottom", "side"]] = None
    annotation_type: Optional[Literal["highlight", "underline", "circle", "box"]] = None
    target_id: Optional[str] = None
    step_number: Optional[int] = None
    step_title: Optional[str] = None
    # Voice fields — populated by backend after ElevenLabs generation
    audio_url: Optional[str] = None
    audio_duration: Optional[float] = None
    # Whiteboard placement
    zone: Optional[Literal["given", "main", "scratch", "final"]] = None
    anchor: Optional[Literal["given", "work", "scratch", "final"]] = None
    align: Optional[Literal["left", "center", "right"]] = None
    group_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("group_id", "groupId"),
    )
    intent: Optional[Literal["introduce", "derive", "emphasize", "result", "side_note"]] = None
    temporary: Optional[bool] = None
    focus_target: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("focus_target", "focusTarget"),
    )
    teaching_phase: Optional[Literal["setup", "derive", "checkpoint", "result"]] = Field(
        default=None,
        validation_alias=AliasChoices("teaching_phase", "teachingPhase"),
    )
    board_page: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("board_page", "boardPage"),
    )
    lane: Optional[Literal["given", "derivation", "scratch", "final"]] = None
    slot_index: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("slot_index", "slotIndex"),
    )
    reserve_height: Optional[float] = Field(
        default=None,
        validation_alias=AliasChoices("reserve_height", "reserveHeight"),
    )
    transform_chain_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("transform_chain_id", "transformChainId"),
    )
    render_order: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("render_order", "renderOrder"),
    )
    layout_locked: Optional[bool] = Field(
        default=None,
        validation_alias=AliasChoices("layout_locked", "layoutLocked"),
    )
    is_page_turn_marker: Optional[bool] = Field(
        default=None,
        validation_alias=AliasChoices("is_page_turn_marker", "isPageTurnMarker"),
    )
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    style: Optional[EventStyle] = None
    # Clear targeting
    clear_target: Optional[Literal["zone", "id"]] = None
    clear_zone: Optional[Literal["given", "main", "scratch", "final"]] = None
    clear_id: Optional[str] = None
    # Diagram primitives
    x1: Optional[float] = None
    y1: Optional[float] = None
    x2: Optional[float] = None
    y2: Optional[float] = None
    cx: Optional[float] = None
    cy: Optional[float] = None
    r: Optional[float] = None
    label: Optional[str] = None
    x_label: Optional[str] = None
    y_label: Optional[str] = None
    ticks: Optional[int] = None
    points: Optional[list[BoardPoint]] = None


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
        "draw_line",
        "draw_arrow",
        "draw_rect",
        "draw_circle",
        "draw_axes",
        "plot_curve",
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
