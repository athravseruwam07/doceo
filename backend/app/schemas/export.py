from pydantic import BaseModel, Field
from typing import Any


class ExportResponse(BaseModel):
    session_id: str
    title: str
    subject: str
    steps: list
    chat_log: list
    lesson_type: str | None = None
    include_voice: bool | None = None
    confusion_state: dict[str, Any] | None = None
    exam_materials: list = Field(default_factory=list)
    exam_cram: dict | None = None
