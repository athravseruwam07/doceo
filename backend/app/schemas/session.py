from pydantic import BaseModel
from typing import Optional


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
    step_count: int
    status: str  # "processing" | "streaming" | "complete"
    created_at: Optional[str] = None
    course_id: Optional[str] = None
    course_label: Optional[str] = None
    confusion_score: Optional[float] = None
    confusion_level: Optional[str] = None
    adaptation_mode: Optional[str] = None
    lesson_type: Optional[str] = None
    include_voice: Optional[bool] = None
