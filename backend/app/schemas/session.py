from typing import Optional

from pydantic import BaseModel


class SessionCreate(BaseModel):
    problem_text: Optional[str] = None
    subject_hint: Optional[str] = None
    course_id: Optional[str] = None


class MicroLessonCreate(SessionCreate):
    include_voice: bool = True


class SessionResponse(BaseModel):
    session_id: str
    title: str
    subject: str
    problem_text: Optional[str] = None
    step_count: int
    status: str  # "processing" | "streaming" | "complete"
    voice_status: Optional[str] = None
    build_stage: Optional[str] = None
    audio_status: Optional[str] = None
    steps: Optional[list[dict]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    course_id: Optional[str] = None
    course_label: Optional[str] = None
    confusion_score: Optional[float] = None
    confusion_level: Optional[str] = None
    adaptation_mode: Optional[str] = None
    lesson_type: Optional[str] = None
    include_voice: Optional[bool] = None


class SessionHistoryItem(BaseModel):
    session_id: str
    title: str
    subject: str
    problem_text: Optional[str] = None
    status: str
    step_count: int
    updated_at: Optional[str] = None
    created_at: Optional[str] = None
    course_id: Optional[str] = None
    course_label: Optional[str] = None
    lesson_type: Optional[str] = None
