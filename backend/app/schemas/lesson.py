from pydantic import BaseModel
from typing import Optional


class MathBlock(BaseModel):
    latex: str
    display: bool = True  # True = block display, False = inline


class LessonStep(BaseModel):
    step_number: int
    title: str
    content: str  # Markdown with inline $...$ math
    math_blocks: list[MathBlock] = []
    hint: Optional[str] = None


class LessonComplete(BaseModel):
    message: str
    total_steps: int
