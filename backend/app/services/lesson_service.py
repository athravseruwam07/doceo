import asyncio
import copy
import json
import logging
from typing import AsyncGenerator

from app.models.session import get_session, update_session
from app.services.ai_service import analyze_problem
from app.services.voice_service import get_voice_service
from app.schemas.lesson import LessonStep, LessonComplete

logger = logging.getLogger(__name__)

# ElevenLabs free tier allows max 2 concurrent requests
_ELEVENLABS_CONCURRENCY = 2


def _steps_have_audio(steps: list[dict]) -> bool:
    """Check if any narrate event in the steps already has audio_url."""
    for step in steps:
        for event in step.get("events", []):
            if event.get("type") == "narrate":
                if event.get("payload", {}).get("audio_url"):
                    return True
    return False


async def _generate_audio_throttled(
    semaphore: asyncio.Semaphore,
    voice_service,
    text: str,
) -> dict:
    """Generate audio with concurrency throttling."""
    async with semaphore:
        return await voice_service.generate_narration_audio(text)


async def _enrich_steps_with_audio(all_steps: list[dict]) -> list[dict]:
    """Generate ElevenLabs audio for every narrate event and attach URLs.

    Returns the steps list with audio_url and audio_duration added to
    narrate event payloads, and step-level audio fields set.
    """
    voice_service = get_voice_service()
    semaphore = asyncio.Semaphore(_ELEVENLABS_CONCURRENCY)

    # Collect ALL narrate events across ALL steps for batch processing
    all_narrate_refs = []  # list of (step_index, event_index, original_duration)
    all_narrate_tasks = []

    for step_idx, step in enumerate(all_steps):
        events = step.get("events", [])
        for ev_idx, event in enumerate(events):
            if event.get("type") == "narrate":
                text = event.get("payload", {}).get("text", "")
                if text:
                    all_narrate_refs.append((step_idx, ev_idx, event.get("duration", 3000)))
                    all_narrate_tasks.append(
                        _generate_audio_throttled(semaphore, voice_service, text)
                    )

    # Generate all audio with throttled concurrency
    print(f"[LessonService] Generating audio for {len(all_narrate_tasks)} narrate events (max {_ELEVENLABS_CONCURRENCY} concurrent)...")
    audio_results = await asyncio.gather(*all_narrate_tasks, return_exceptions=True)

    # Attach audio to events
    for (step_idx, ev_idx, original_duration), audio_result in zip(all_narrate_refs, audio_results):
        event = all_steps[step_idx]["events"][ev_idx]

        if isinstance(audio_result, Exception):
            print(f"[LessonService] Audio generation failed for step {step_idx} event {ev_idx}: {audio_result}")
            # Keep original estimated duration — don't set to 0
            continue

        audio_url = audio_result.get("audio_url")
        audio_duration = audio_result.get("duration", 0)

        if audio_url and audio_duration > 0:
            # Replace with real audio duration
            event["duration"] = audio_duration * 1000  # seconds → ms
            event["payload"]["audio_url"] = audio_url
            event["payload"]["audio_duration"] = audio_duration
            print(f"[LessonService] Step {step_idx} event {ev_idx}: audio_url={audio_url} duration={audio_duration:.1f}s")
        else:
            # Audio generation returned no URL — keep original estimated duration
            print(f"[LessonService] No audio URL for step {step_idx} event {ev_idx}, keeping estimated duration")

    # Set step-level audio fields for backward compat
    for step in all_steps:
        events = step.get("events", [])
        first_narrate_audio = None
        total_step_audio_duration = 0
        for event in events:
            if event.get("type") == "narrate":
                payload = event.get("payload", {})
                if payload.get("audio_url") and not first_narrate_audio:
                    first_narrate_audio = payload["audio_url"]
                if payload.get("audio_duration"):
                    total_step_audio_duration += payload["audio_duration"]

        step["audio_url"] = first_narrate_audio
        step["audio_duration"] = total_step_audio_duration

    return all_steps


async def _generate_audio_in_background(session_id: str) -> None:
    """Generate lesson narration audio asynchronously without blocking streaming."""
    session = get_session(session_id)
    if session is None:
        return

    if session.get("audio_status") == "in_progress":
        return

    steps = session.get("steps", [])
    if not steps:
        return

    if _steps_have_audio(steps):
        update_session(session_id, audio_status="complete")
        return

    update_session(session_id, audio_status="in_progress")
    try:
        # Work on a deep copy to avoid mutating objects while UI is streaming them.
        steps_with_audio = await _enrich_steps_with_audio(copy.deepcopy(steps))
        update_session(
            session_id,
            steps=steps_with_audio,
            step_count=len(steps_with_audio),
            audio_status="complete",
        )
    except Exception:
        logger.exception("Background audio generation failed for session %s", session_id)
        update_session(session_id, audio_status="failed")


def _schedule_background_audio_generation(session_id: str) -> None:
    """Queue background audio generation if needed."""
    session = get_session(session_id)
    if session is None:
        return

    status = session.get("audio_status")
    if status in {"queued", "in_progress", "complete"}:
        return

    steps = session.get("steps", [])
    if not steps or _steps_have_audio(steps):
        return

    update_session(session_id, audio_status="queued")
    asyncio.create_task(_generate_audio_in_background(session_id))


async def create_lesson(session_id: str) -> None:
    """Analyze the problem and store steps quickly without blocking on audio.

    Flow:
    1. Use existing steps if available, otherwise call Gemini to generate them
    2. Store generated steps immediately so SSE can start quickly
    3. Queue audio generation in background (non-blocking)
    """
    session = get_session(session_id)
    if session is None:
        return

    # Reuse existing steps if the session creation endpoint already generated them
    existing_steps = session.get("steps", [])
    if existing_steps and len(existing_steps) > 0:
        logger.info("[LessonService] Reusing %s existing steps", len(existing_steps))
        update_session(
            session_id,
            title=session.get("title", "Lesson"),
            subject=session.get("subject", "STEM"),
            steps=existing_steps,
            step_count=len(existing_steps),
            status="streaming",
            audio_status="complete" if _steps_have_audio(existing_steps) else "pending",
        )
        if not _steps_have_audio(existing_steps):
            _schedule_background_audio_generation(session_id)
        return

    logger.info("[LessonService] No existing steps, generating with Gemini...")
    result = await analyze_problem(
        problem_text=session.get("problem_text", ""),
        image_b64=session.get("image_b64"),
    )

    all_steps = result.get("steps", [])
    update_session(
        session_id,
        title=result["title"],
        subject=result["subject"],
        steps=all_steps,
        step_count=len(all_steps),
        status="streaming",
        audio_status="pending",
    )
    _schedule_background_audio_generation(session_id)


async def stream_lesson_steps(session_id: str) -> AsyncGenerator[dict, None]:
    """Stream lesson steps with embedded animation events."""
    session = get_session(session_id)
    if session is None:
        return

    steps = session.get("steps", [])

    # Send an immediate status event so SSE connection opens right away.
    yield {
        "event": "status",
        "data": json.dumps({"state": "connected"}),
    }

    # Generate lesson structure first if needed (non-audio path for fast startup)
    if not steps:
        logger.info("[LessonService] Generating lesson steps for session %s", session_id)
        lesson_task = asyncio.create_task(create_lesson(session_id))
        elapsed_seconds = 0

        # Keep stream active while lesson is being generated.
        while not lesson_task.done():
            await asyncio.sleep(2.0)
            elapsed_seconds += 2
            yield {
                "event": "status",
                "data": json.dumps(
                    {
                        "state": "generating",
                        "elapsed_seconds": elapsed_seconds,
                    }
                ),
            }

        # Propagate exceptions from lesson generation if they occurred.
        await lesson_task
        session = get_session(session_id)
        if session is None:
            return
        steps = session.get("steps", [])

    # Never block stream on ElevenLabs audio generation.
    if steps and not _steps_have_audio(steps):
        _schedule_background_audio_generation(session_id)

    update_session(session_id, status="streaming")

    for step_dict in steps:
        await asyncio.sleep(0.3)
        step = LessonStep(**step_dict)
        yield {"event": "step", "data": step.model_dump_json()}

    update_session(session_id, status="complete")

    complete = LessonComplete(
        message="Lesson complete! Feel free to ask questions.",
        total_steps=len(steps),
    )
    yield {"event": "complete", "data": complete.model_dump_json()}
