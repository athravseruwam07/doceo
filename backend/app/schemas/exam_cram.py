from typing import Literal, Optional

from pydantic import BaseModel, Field


class ExamCramTextRequest(BaseModel):
    materials: list[str] = Field(default_factory=list)
    subject_hint: Optional[str] = None
    exam_name: Optional[str] = None


class MaterialSummary(BaseModel):
    name: str
    source_type: Literal["text", "upload"]
    char_count: int


class PrioritizedTopic(BaseModel):
    topic: str
    likelihood: float = Field(ge=0, le=1)
    why: str
    evidence: list[str] = Field(default_factory=list)
    study_actions: list[str] = Field(default_factory=list)


class FocusedLesson(BaseModel):
    title: str
    objective: str
    key_points: list[str] = Field(default_factory=list)
    estimated_minutes: int = Field(ge=5, le=60)


class PracticeQuestion(BaseModel):
    question: str
    difficulty: Literal["easy", "medium", "hard"]
    concept: str
    answer_outline: str


class ExamCramResponse(BaseModel):
    session_id: str
    subject: str
    exam_name: Optional[str] = None
    source_count: int
    generated_at: str
    top_terms: list[str] = Field(default_factory=list)
    recurring_patterns: list[str] = Field(default_factory=list)
    prioritized_topics: list[PrioritizedTopic] = Field(default_factory=list)
    focused_lessons: list[FocusedLesson] = Field(default_factory=list)
    practice_questions: list[PracticeQuestion] = Field(default_factory=list)
    materials: list[MaterialSummary] = Field(default_factory=list)
