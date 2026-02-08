from pydantic import BaseModel
from typing import Optional


class SessionCreate(BaseModel):
    problem_text: Optional[str] = None
    subject_hint: Optional[str] = None


class SessionResponse(BaseModel):
    session_id: str
    title: str
    subject: str
    step_count: int
    status: str  # "processing" | "streaming" | "complete"
    voice_status: Optional[str] = None
    build_stage: Optional[str] = None
