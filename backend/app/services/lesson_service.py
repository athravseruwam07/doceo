import asyncio
from typing import AsyncGenerator

from app.models.session import get_session, update_session
from app.services.ai_service import analyze_problem
from app.services.voice_service import get_voice_service
from app.schemas.lesson import LessonStep, LessonComplete


async def create_lesson(session_id: str) -> None:
    """Analyze the problem and store the generated lesson steps in the session."""
    session = get_session(session_id)
    if session is None:
        return

    result = await analyze_problem(
        problem_text=session.get("problem_text", ""),
        image_b64=session.get("image_b64"),
    )

    # Generate audio for each step
    voice_service = get_voice_service()
    steps_with_audio = []

    for step in result.get("steps", []):
        # Get narration text
        narration = step.get("narration", step.get("content", ""))

        # Generate audio
        audio_data = await voice_service.generate_narration_audio(narration)

        # Add audio data to step
        step["audio_url"] = audio_data.get("audio_url")
        step["audio_duration"] = audio_data.get("duration", 0)

        steps_with_audio.append(step)

    update_session(
        session_id,
        title=result["title"],
        subject=result["subject"],
        steps=steps_with_audio,
        step_count=len(steps_with_audio),
        status="streaming",
    )


async def stream_lesson_steps(session_id: str) -> AsyncGenerator[dict, None]:
    """Async generator that yields lesson steps with a delay, simulating streaming.

    Yields dicts with an "event" key ("step" or "complete") and a "data" key
    containing the serialized payload.
    """
    session = get_session(session_id)
    if session is None:
        return

    # Ensure lesson has been created
    if not session.get("steps"):
        await create_lesson(session_id)
        session = get_session(session_id)
        if session is None:
            return

    update_session(session_id, status="streaming")

    steps = session["steps"]
    for step_dict in steps:
        await asyncio.sleep(2)
        step = LessonStep(**step_dict)
        yield {"event": "step", "data": step.model_dump_json()}

    update_session(session_id, status="complete")

    complete = LessonComplete(
        message="Lesson complete! Feel free to ask questions.",
        total_steps=len(steps),
    )
    yield {"event": "complete", "data": complete.model_dump_json()}
