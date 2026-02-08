from pydantic import BaseModel
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
