from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.course import (
    add_material,
    create_course,
    delete_course,
    get_course,
    list_courses,
    list_materials,
)
from app.models.session import delete_sessions_for_course, list_sessions_for_course
from app.schemas.course import (
    CourseCreate,
    CourseDetailResponse,
    CourseLessonResponse,
    CourseMaterialResponse,
    CourseResponse,
)

router = APIRouter()


@router.get("", response_model=list[CourseResponse])
async def get_courses():
    """List all available labeled courses."""
    return [CourseResponse(**course) for course in list_courses()]


@router.post("", response_model=CourseResponse)
async def create_course_route(body: CourseCreate):
    """Create a labeled course (e.g., Math, Science)."""
    try:
        course = create_course(body.label)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CourseResponse(**course)


@router.delete("/{course_id}", response_model=CourseResponse)
async def delete_course_route(course_id: str):
    """Delete a labeled course and all uploaded materials in it."""
    course = delete_course(course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    delete_sessions_for_course(course_id)
    return CourseResponse(**course)


@router.get("/{course_id}", response_model=CourseDetailResponse)
async def get_course_details(course_id: str):
    """Get course metadata and uploaded materials."""
    course = get_course(course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    materials = list_materials(course_id) or []
    return CourseDetailResponse(
        course_id=course["course_id"],
        label=course["label"],
        created_at=course["created_at"],
        material_count=len(materials),
        materials=[CourseMaterialResponse(**material) for material in materials],
    )


@router.get("/{course_id}/materials", response_model=list[CourseMaterialResponse])
async def get_course_materials(course_id: str):
    """List all uploaded notes/syllabus files for a course."""
    materials = list_materials(course_id)
    if materials is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return [CourseMaterialResponse(**material) for material in materials]


@router.get("/{course_id}/lessons", response_model=list[CourseLessonResponse])
async def get_course_lessons(course_id: str):
    """List previously created lessons for a specific course."""
    course = get_course(course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    lessons = list_sessions_for_course(course_id)
    return [CourseLessonResponse(**lesson) for lesson in lessons]


@router.post("/{course_id}/materials", response_model=CourseMaterialResponse)
async def upload_course_material(course_id: str, file: UploadFile = File(...)):
    """Upload a notes/syllabus file to a specific course."""
    contents = await file.read()
    try:
        material = add_material(
            course_id=course_id,
            filename=file.filename or "notes.txt",
            content_type=file.content_type,
            contents=contents,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if material is None:
        raise HTTPException(status_code=404, detail="Course not found")

    return CourseMaterialResponse(**material)
