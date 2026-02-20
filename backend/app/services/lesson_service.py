import asyncio
import copy
import json
import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import get_session, update_session
from app.services.voice_service import get_voice_service
from app.schemas.lesson import LessonStep, LessonComplete

logger = logging.getLogger(__name__)

# Keep narration synthesis throttled to avoid provider rate limits.
_TTS_CONCURRENCY = 4
_INLINE_TTS_TIMEOUT_SECONDS = 35


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


async def _enrich_steps_with_audio(all_steps: list[dict]) -> tuple[list[dict], str]:
    """Generate narration audio for every narrate event and attach URLs."""
    voice_service = get_voice_service()
    semaphore = asyncio.Semaphore(_TTS_CONCURRENCY)

    all_narrate_refs = []
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

    print(f"[LessonService] Generating audio for {len(all_narrate_tasks)} narrate events (max {_TTS_CONCURRENCY} concurrent)...")
    audio_results = await asyncio.gather(*all_narrate_tasks, return_exceptions=True)

    success_count = 0
    failure_codes: dict[str, int] = {}
    for (step_idx, ev_idx, original_duration), audio_result in zip(all_narrate_refs, audio_results):
        event = all_steps[step_idx]["events"][ev_idx]

        if isinstance(audio_result, Exception):
            print(f"[LessonService] Audio generation failed for step {step_idx} event {ev_idx}: {audio_result}")
            failure_codes["exception"] = failure_codes.get("exception", 0) + 1
            continue

        audio_url = audio_result.get("audio_url")
        audio_duration = audio_result.get("duration", 0)
        error_code = audio_result.get("error_code")

        if audio_url and audio_duration > 0:
            event["duration"] = audio_duration * 1000
            event["payload"]["audio_url"] = audio_url
            event["payload"]["audio_duration"] = audio_duration
            print(f"[LessonService] Step {step_idx} event {ev_idx}: audio_url={audio_url} duration={audio_duration:.1f}s")
            success_count += 1
        else:
            print(f"[LessonService] No audio URL for step {step_idx} event {ev_idx}, keeping estimated duration")
            if isinstance(error_code, str):
                failure_codes[error_code] = failure_codes.get(error_code, 0) + 1

    if all_narrate_refs and success_count == 0:
        print(f"[LessonService] WARNING: Voice provider did not return audio for any narrate events. failure_codes={failure_codes}")
        if failure_codes.get("missing_tts_permission"):
            print("[LessonService] ACTION REQUIRED: Enable text_to_speech permission on the active voice provider key, then restart backend.")

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

    voice_status = "unknown"
    if all_narrate_refs:
        if success_count > 0:
            voice_status = "ok"
        elif failure_codes.get("missing_tts_permission"):
            voice_status = "missing_tts_permission"
        elif failure_codes.get("unauthorized"):
            voice_status = "unauthorized"
        elif failure_codes.get("rate_limited"):
            voice_status = "rate_limited"
        else:
            voice_status = "unknown"

    return all_steps, voice_status


async def _generate_audio_in_background(session_id: str, db: AsyncSession) -> None:
    """Generate lesson narration audio asynchronously without blocking streaming."""
    session = await get_session(db, session_id)
    if session is None:
        return

    if session.get("audio_status") == "in_progress":
        return

    steps = session.get("steps", [])
    if not steps:
        return

    if _steps_have_audio(steps):
        await update_session(
            db, session_id,
            audio_status="complete",
            voice_status=session.get("voice_status", "ok"),
        )
        return

    await update_session(db, session_id, audio_status="in_progress", build_stage="voice_generation")
    try:
        steps_with_audio, voice_status = await _enrich_steps_with_audio(copy.deepcopy(steps))
        await update_session(
            db, session_id,
            steps=steps_with_audio,
            step_count=len(steps_with_audio),
            audio_status="complete",
            voice_status=voice_status,
            build_stage="stream_ready",
        )
    except Exception:
        logger.exception("Background audio generation failed for session %s", session_id)
        await update_session(
            db, session_id,
            audio_status="failed",
            voice_status="unknown",
            build_stage="stream_ready",
        )


def _schedule_background_audio_generation(session_id: str, db: AsyncSession) -> None:
    """Queue background audio generation if needed."""
    # NOTE: We cannot easily run this in background with an async db session
    # that's request-scoped. For now, audio generation happens inline during streaming.
    pass


async def create_lesson(session_id: str, db: AsyncSession) -> None:
    """Analyze the problem and store steps quickly without blocking on audio."""
    session = await get_session(db, session_id)
    if session is None:
        return

    existing_steps = session.get("steps", [])
    if existing_steps and len(existing_steps) > 0:
        logger.info("[LessonService] Reusing %s existing steps", len(existing_steps))
        await update_session(
            db, session_id,
            title=session.get("title", "Lesson"),
            subject=session.get("subject", "STEM"),
            steps=existing_steps,
            step_count=len(existing_steps),
            status="streaming",
            build_stage="stream_ready",
            audio_status="complete" if _steps_have_audio(existing_steps) else "pending",
        )
        return

    logger.info("[LessonService] No existing steps, generating with Gemini...")
    from app.services.ai_service import analyze_problem

    result = await analyze_problem(
        problem_text=session.get("problem_text", ""),
        image_b64=session.get("image_b64"),
    )

    all_steps = result.get("steps", [])
    await update_session(
        db, session_id,
        title=result["title"],
        subject=result["subject"],
        steps=all_steps,
        step_count=len(all_steps),
        status="streaming",
        voice_status=session.get("voice_status", "unknown"),
        build_stage="stream_ready",
        audio_status="pending",
    )


async def stream_lesson_steps(session_id: str, db: AsyncSession) -> AsyncGenerator[dict, None]:
    """Stream lesson steps with embedded animation events."""
    session = await get_session(db, session_id)
    if session is None:
        return

    steps = session.get("steps", [])

    yield {
        "event": "status",
        "data": json.dumps({"state": "connected"}),
    }

    if not steps:
        logger.info("[LessonService] Generating lesson steps for session %s", session_id)
        await create_lesson(session_id, db)
        session = await get_session(db, session_id)
        if session is None:
            return
        steps = session.get("steps", [])

    # Ensure streamed steps have narration audio when possible.
    if steps and not _steps_have_audio(steps):
        await update_session(db, session_id, audio_status="in_progress", build_stage="voice_generation")
        try:
            steps_with_audio, voice_status = await asyncio.wait_for(
                _enrich_steps_with_audio(copy.deepcopy(steps)),
                timeout=_INLINE_TTS_TIMEOUT_SECONDS,
            )
            steps = steps_with_audio
            await update_session(
                db, session_id,
                steps=steps_with_audio,
                step_count=len(steps_with_audio),
                audio_status="complete" if _steps_have_audio(steps_with_audio) else "failed",
                voice_status=voice_status,
                build_stage="stream_ready",
            )
        except asyncio.TimeoutError:
            logger.warning(
                "Inline audio generation timed out after %ss for session %s; continuing stream",
                _INLINE_TTS_TIMEOUT_SECONDS,
                session_id,
            )
            await update_session(
                db, session_id,
                audio_status="pending",
                build_stage="stream_ready",
            )
        except Exception:
            logger.exception("Inline audio generation failed for session %s", session_id)
            await update_session(
                db, session_id,
                audio_status="pending",
                voice_status="unknown",
                build_stage="stream_ready",
            )

    await update_session(db, session_id, status="streaming", build_stage="streaming")

    for step_dict in steps:
        await asyncio.sleep(0.3)
        step = LessonStep(**step_dict)
        yield {"event": "step", "data": step.model_dump_json()}

    await update_session(db, session_id, status="complete", build_stage="complete")

    complete = LessonComplete(
        message="Lesson complete! Feel free to ask questions.",
        total_steps=len(steps),
    )
    yield {"event": "complete", "data": complete.model_dump_json()}
