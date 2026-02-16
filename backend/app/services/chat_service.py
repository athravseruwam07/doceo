import re
import uuid
from typing import Any

from app.models.course import get_course, search_course_snippets
from app.models.session import get_session, update_session
from app.services.ai_service import generate_chat_response
from app.services.confusion_service import analyze_confusion
from app.services.voice_service import get_voice_service


def _build_step_lookup(steps: list[dict[str, Any]]) -> dict[int, str]:
    lookup: dict[int, str] = {}
    for step in steps:
        step_number = step.get("step_number")
        title = step.get("title")
        if isinstance(step_number, int) and isinstance(title, str):
            lookup[step_number] = title
    return lookup


def _build_lesson_context(session: dict[str, Any], context: dict[str, Any] | None) -> str:
    context = context or {}
    session_title = session.get("title")
    current_step = context.get("current_step")
    current_step_title = context.get("current_step_title")
    current_event_type = context.get("current_event_type")
    active_narration = context.get("active_narration")

    sections: list[str] = []
    if isinstance(session_title, str) and session_title.strip():
        sections.append(f"Current lesson: {session_title.strip()}")
    if isinstance(current_step, int):
        sections.append(f"Student is currently on step {current_step}.")
    if isinstance(current_step_title, str) and current_step_title.strip():
        sections.append(f"Step title: {current_step_title.strip()}")
    if isinstance(current_event_type, str) and current_event_type.strip():
        sections.append(f"Active teaching event type: {current_event_type.strip()}")
    if isinstance(active_narration, str) and active_narration.strip():
        sections.append(f"Current narration: {active_narration.strip()}")

    if not sections:
        return ""

    return "Current lesson context:\n" + "\n".join(f"- {line}" for line in sections)


def _resolve_related_step(
    response: dict[str, Any], context: dict[str, Any] | None
) -> int | None:
    related_step = response.get("related_step")
    if isinstance(related_step, int):
        return related_step

    if context and isinstance(context.get("current_step"), int):
        return context["current_step"]

    return None


def _estimate_text_duration_ms(text: str, minimum: int = 900, maximum: int = 4200) -> int:
    stripped = re.sub(r"\s+", " ", text).strip()
    if not stripped:
        return minimum
    estimated = len(stripped) * 22
    return max(minimum, min(maximum, estimated))


def _event(event_type: str, duration: int, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": f"chat-{uuid.uuid4().hex[:10]}",
        "type": event_type,
        "duration": max(duration, 200),
        "payload": payload,
    }


def _build_chat_events(response: dict[str, Any], step_title: str | None) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []

    related_step = response.get("related_step")
    if isinstance(related_step, int):
        events.append(
            _event(
                "step_marker",
                350,
                {
                    "step_number": related_step,
                    "step_title": step_title or f"Step {related_step}",
                    "position": "side",
                },
            )
        )

    narration = (response.get("narration") or response.get("message") or "").strip()
    audio_duration = response.get("audio_duration")
    if narration:
        narration_ms = (
            int(float(audio_duration) * 1000)
            if isinstance(audio_duration, (float, int)) and audio_duration > 0
            else _estimate_text_duration_ms(narration, minimum=1200, maximum=7000)
        )
        events.append(
            _event(
                "narrate",
                narration_ms,
                {
                    "text": narration,
                    "position": "side",
                },
            )
        )

    message_text = (response.get("message") or "").strip()
    if message_text:
        events.append(
            _event(
                "write_text",
                _estimate_text_duration_ms(message_text),
                {
                    "text": message_text,
                    "position": "side",
                },
            )
        )

    for block in response.get("math_blocks", []) or []:
        if not isinstance(block, dict):
            continue
        latex = block.get("latex")
        if not isinstance(latex, str) or not latex.strip():
            continue
        events.append(
            _event(
                "write_equation",
                _estimate_text_duration_ms(latex, minimum=1300, maximum=3200),
                {
                    "latex": latex,
                    "display": bool(block.get("display", True)),
                    "position": "side",
                },
            )
        )

    if events:
        events.append(_event("pause", 650, {"position": "side"}))

    return events


async def handle_message(
    session_id: str, message: str, context: dict[str, Any] | None = None
) -> dict[str, Any] | None:
    """Process a student chat message and return the tutor's response.

    Stores both the user message and tutor response in the session's chat_log.
    """
    session = get_session(session_id)
    if session is None:
        return None

    steps = session.get("steps", [])
    step_lookup = _build_step_lookup(steps if isinstance(steps, list) else [])
    lesson_context = _build_lesson_context(session, context)
    course_id = session.get("course_id")
    course_label: str | None = None
    course_snippets: list[dict[str, Any]] = []

    if isinstance(course_id, str) and course_id.strip():
        course = get_course(course_id)
        if course:
            course_label = course.get("label")
            snippet_query = " ".join(
                part.strip()
                for part in [
                    message,
                    context.get("current_step_title") if context else "",
                    session.get("problem_text", ""),
                ]
                if isinstance(part, str) and part.strip()
            )
            course_snippets = search_course_snippets(course_id, snippet_query, top_k=4)

    chat_log = session.get("chat_log", [])
    confusion_result = analyze_confusion(
        message=message,
        chat_log=chat_log,
        previous_state=session.get("confusion_state"),
        context=context,
    )
    confusion_state = confusion_result["state"]
    adaptation = confusion_result["adaptation"]

    # Store user message
    chat_log.append({"role": "student", "message": message, "context": context or {}})

    # Generate tutor response with the current lesson state folded into context.
    problem_context = session.get("problem_text", "")
    if lesson_context:
        problem_context = f"{problem_context}\n\n{lesson_context}"

    response = await generate_chat_response(
        problem_context=problem_context,
        chat_history=chat_log,
        question=message,
        course_label=course_label,
        course_snippets=course_snippets,
        adaptation=adaptation,
    )

    response["role"] = "tutor"
    response["related_step"] = _resolve_related_step(response, context)
    response["narration"] = response.get("narration", response.get("message", ""))
    if not isinstance(response.get("math_blocks"), list):
        response["math_blocks"] = []

    # Generate audio for tutor response
    narration = response.get("narration", "")
    if narration:
        voice_service = get_voice_service()
        audio_data = await voice_service.generate_narration_audio(narration)
        response["audio_url"] = audio_data.get("audio_url")
        response["audio_duration"] = audio_data.get("duration", 0)
        if not response["audio_url"] and audio_data.get("error_code") == "missing_tts_permission":
            print(
                "[ChatService] Voice provider key is missing text_to_speech permission. "
                "Returning chat response without narration audio."
            )
    else:
        response["audio_url"] = None
        response["audio_duration"] = 0

    related_step = response.get("related_step")
    step_title = step_lookup.get(related_step) if isinstance(related_step, int) else None
    if step_title is None and context and isinstance(context.get("current_step_title"), str):
        step_title = context["current_step_title"]

    existing_events = response.get("events")
    if isinstance(existing_events, list) and existing_events:
        response["events"] = existing_events
    else:
        response["events"] = _build_chat_events(response, step_title)

    response["confusion_score"] = adaptation.get("score")
    response["confusion_level"] = adaptation.get("level")
    response["adaptation_mode"] = adaptation.get("mode")
    response["adaptation_reason"] = adaptation.get("reason")
    response["confusion_signals"] = adaptation.get("signals", [])

    # Store tutor response
    chat_log.append(response)
    update_session(session_id, chat_log=chat_log, confusion_state=confusion_state)

    return response
