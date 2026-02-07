from pydantic import BaseModel
from typing import Optional


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    role: str  # "tutor"
    message: str
    math_blocks: list = []
    related_step: Optional[int] = None
