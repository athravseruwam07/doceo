from pydantic import BaseModel, Field


class CourseCreate(BaseModel):
    label: str = Field(min_length=1, max_length=80)


class CourseResponse(BaseModel):
    course_id: str
    label: str
    created_at: str
    material_count: int = 0


class CourseMaterialResponse(BaseModel):
    material_id: str
    filename: str
    content_type: str
    uploaded_at: str
    char_count: int
    chunk_count: int
    preview: str = ""


class CourseDetailResponse(CourseResponse):
    materials: list[CourseMaterialResponse] = Field(default_factory=list)


class CourseLessonResponse(BaseModel):
    session_id: str
    title: str
    subject: str
    status: str
    step_count: int
    lesson_type: str = "full"
    created_at: str
    problem_preview: str = ""
