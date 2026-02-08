import asyncio
import re
import uuid
from typing import Any

from app.services.voice_service import get_voice_service

_ELEVENLABS_CONCURRENCY = 2


def _estimate_text_duration_ms(text: str, minimum: int = 900, maximum: int = 6500) -> int:
    compact = re.sub(r"\s+", " ", text).strip()
    if not compact:
        return minimum
    estimated = len(compact) * 26
    return max(minimum, min(maximum, estimated))


def _event(event_type: str, duration: int, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": f"micro-{uuid.uuid4().hex[:10]}",
        "type": event_type,
        "duration": max(200, int(duration)),
        "payload": payload,
    }


def _compact_text(text: str, limit: int = 420) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3].rstrip() + "..."


def _normalize_math_blocks(step: dict[str, Any]) -> list[dict[str, Any]]:
    blocks = step.get("math_blocks")
    if not isinstance(blocks, list):
        return []

    normalized: list[dict[str, Any]] = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        latex = block.get("latex")
        if not isinstance(latex, str) or not latex.strip():
            continue
        normalized.append(
            {
                "latex": latex.strip(),
                "display": bool(block.get("display", True)),
            }
        )
    return normalized


def _build_step_events(step: dict[str, Any]) -> list[dict[str, Any]]:
    step_number = int(step.get("step_number", 1))
    step_title = str(step.get("title", f"Step {step_number}")).strip() or f"Step {step_number}"
    narration = str(step.get("narration") or step.get("content") or step_title).strip()
    content = _compact_text(str(step.get("content", "")))
    math_blocks = _normalize_math_blocks(step)

    events: list[dict[str, Any]] = [
        _event(
            "step_marker",
            320,
            {
                "step_number": step_number,
                "step_title": step_title,
            },
        )
    ]

    if narration:
        events.append(
            _event(
                "narrate",
                _estimate_text_duration_ms(narration, minimum=1300, maximum=7200),
                {
                    "text": narration,
                    "position": "top",
                },
            )
        )

    if content:
        events.append(
            _event(
                "write_text",
                _estimate_text_duration_ms(content),
                {
                    "text": content,
                    "position": "center",
                },
            )
        )

    for block in math_blocks[:4]:
        events.append(
            _event(
                "write_equation",
                _estimate_text_duration_ms(
                    str(block.get("latex", "")), minimum=1200, maximum=4200
                ),
                {
                    "latex": block.get("latex"),
                    "display": bool(block.get("display", True)),
                    "position": "center",
                },
            )
        )

    events.append(_event("pause", 520, {"position": "bottom"}))
    return events


async def _generate_audio_throttled(
    semaphore: asyncio.Semaphore, text: str
) -> dict[str, Any]:
    async with semaphore:
        return await get_voice_service().generate_narration_audio(text)


async def _attach_audio_to_narration(steps: list[dict[str, Any]]) -> None:
    semaphore = asyncio.Semaphore(_ELEVENLABS_CONCURRENCY)
    refs: list[tuple[int, int]] = []
    tasks: list[Any] = []

    for step_index, step in enumerate(steps):
        events = step.get("events", [])
        if not isinstance(events, list):
            continue

        for event_index, event in enumerate(events):
            if not isinstance(event, dict):
                continue
            if event.get("type") != "narrate":
                continue
            payload = event.get("payload", {})
            if not isinstance(payload, dict):
                continue
            text = str(payload.get("text", "")).strip()
            if not text:
                continue

            refs.append((step_index, event_index))
            tasks.append(_generate_audio_throttled(semaphore, text))

    if not tasks:
        return

    results = await asyncio.gather(*tasks, return_exceptions=True)
    for (step_index, event_index), result in zip(refs, results):
        if isinstance(result, Exception):
            continue

        event = steps[step_index]["events"][event_index]
        payload = event.get("payload", {})
        audio_url = result.get("audio_url")
        audio_duration = result.get("duration", 0)
        if audio_url and isinstance(audio_duration, (float, int)) and audio_duration > 0:
            payload["audio_url"] = audio_url
            payload["audio_duration"] = float(audio_duration)
            event["duration"] = int(float(audio_duration) * 1000)

    for step in steps:
        events = step.get("events", [])
        first_audio_url: str | None = None
        total_audio_duration = 0.0
        for event in events:
            if event.get("type") != "narrate":
                continue
            payload = event.get("payload", {})
            url = payload.get("audio_url")
            duration = payload.get("audio_duration")
            if isinstance(url, str) and url and first_audio_url is None:
                first_audio_url = url
            if isinstance(duration, (float, int)):
                total_audio_duration += float(duration)

        step["audio_url"] = first_audio_url
        step["audio_duration"] = total_audio_duration


async def prepare_micro_lesson_steps(
    steps: list[dict[str, Any]], include_voice: bool
) -> list[dict[str, Any]]:
    prepared_steps: list[dict[str, Any]] = []
    for index, raw_step in enumerate(steps, start=1):
        step = dict(raw_step)
        step["step_number"] = index
        step["title"] = str(step.get("title", f"Step {index}")).strip() or f"Step {index}"
        step["content"] = str(step.get("content", "")).strip()
        step["narration"] = (
            str(step.get("narration", "")).strip() or _compact_text(step["content"], limit=320)
        )
        step["math_blocks"] = _normalize_math_blocks(step)
        step["events"] = _build_step_events(step)
        prepared_steps.append(step)

    if include_voice:
        await _attach_audio_to_narration(prepared_steps)

    return prepared_steps
