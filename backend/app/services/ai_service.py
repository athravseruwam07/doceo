"""AI service using Google Gemini API for lesson generation and tutoring."""

import asyncio
import json
import logging
import uuid
from typing import Any

import google.generativeai as genai

from app.config import settings

# Configure Gemini
genai.configure(api_key=settings.gemini_api_key)

logger = logging.getLogger(__name__)


class AIServiceError(Exception):
    """Raised when Gemini generation fails or returns malformed content."""


async def analyze_problem(
    problem_text: str,
    image_b64: str | None = None,
    subject_hint: str | None = None,
    course_label: str | None = None,
    course_snippets: list[dict[str, Any]] | None = None,
) -> dict:
    """Analyze a problem and return lesson plan with granular teaching events.

    Args:
        problem_text: Text description of the problem
        image_b64: Optional base64-encoded image of the problem

    Returns:
        Dict with title, subject, and steps array (each step has events)
    """
    try:
        prompt = _build_lesson_generation_prompt(
            problem_text=problem_text,
            image_b64=image_b64,
            subject_hint=subject_hint,
            course_label=course_label,
            course_snippets=course_snippets or [],
        )
        primary_model_name = settings.gemini_model

        request_payload: Any = prompt
        if image_b64:
            import base64
            from io import BytesIO

            from PIL import Image

            try:
                image_data = base64.b64decode(image_b64)
                image = Image.open(BytesIO(image_data))
            except Exception as exc:
                raise AIServiceError("Uploaded image could not be decoded.") from exc

            # Convert to RGB (strip alpha) and resize to keep inference reliable.
            image = image.convert("RGB")
            image.thumbnail((1024, 1024))
            request_payload = [prompt, image]

        result = await _generate_and_parse_lesson(
            model_name=primary_model_name,
            payload=request_payload,
        )

        if _should_use_quality_fallback(primary_model_name) and not _lesson_quality_sufficient(result):
            quality_model_name = settings.gemini_quality_model
            logger.warning(
                "Primary Gemini model (%s) produced low-quality lesson structure; retrying with %s.",
                primary_model_name,
                quality_model_name,
            )
            result = await _generate_and_parse_lesson(
                model_name=quality_model_name,
                payload=request_payload,
            )

        return result
    except AIServiceError:
        raise
    except Exception as exc:
        raise AIServiceError(f"Gemini lesson generation failed: {exc}") from exc


def _is_retryable_gemini_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    retryable_markers = [
        "429",
        "quota",
        "rate",
        "temporarily unavailable",
        "deadline exceeded",
        "timed out",
        "timeout",
        "unavailable",
        "internal",
        "connection",
        "reset",
    ]
    return any(marker in msg for marker in retryable_markers)


async def _generate_with_retries(
    model: genai.GenerativeModel,
    payload: Any,
    *,
    model_name: str,
):
    timeout_seconds = max(10, settings.gemini_request_timeout_seconds)
    max_attempts = max(1, settings.gemini_max_retries + 1)
    backoff_seconds = max(0.25, settings.gemini_retry_backoff_seconds)
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(model.generate_content, payload),
                timeout=timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            last_error = TimeoutError(
                f"Gemini timed out after {timeout_seconds}s "
                f"(attempt {attempt}/{max_attempts}, model={model_name})."
            )
        except Exception as exc:
            if not _is_retryable_gemini_error(exc):
                raise
            last_error = RuntimeError(
                f"Gemini transient error on attempt {attempt}/{max_attempts}: {exc}"
            )

        if attempt < max_attempts:
            await asyncio.sleep(backoff_seconds * attempt)

    if last_error is not None:
        raise last_error
    raise RuntimeError("Gemini generation failed without an error object.")


async def generate_chat_response(
    problem_context: str,
    chat_history: list,
    question: str,
    course_label: str | None = None,
    course_snippets: list[dict[str, Any]] | None = None,
    adaptation: dict[str, Any] | None = None,
) -> dict:
    """Generate a tutor response to a student question."""
    try:
        prompt = _build_chat_prompt(
            problem_context=problem_context,
            chat_history=chat_history,
            question=question,
            course_label=course_label,
            course_snippets=course_snippets or [],
            adaptation=adaptation,
        )
        primary_model_name = settings.gemini_model
        result = await _generate_and_parse_chat(
            model_name=primary_model_name,
            prompt=prompt,
        )

        if _should_use_quality_fallback(primary_model_name) and _chat_needs_quality_fallback(result):
            quality_model_name = settings.gemini_quality_model
            logger.warning(
                "Primary Gemini model (%s) produced weak chat response; retrying with %s.",
                primary_model_name,
                quality_model_name,
            )
            result = await _generate_and_parse_chat(
                model_name=quality_model_name,
                prompt=prompt,
            )

        return result
    except AIServiceError:
        raise
    except Exception as exc:
        raise AIServiceError(f"Gemini chat generation failed: {exc}") from exc


async def generate_micro_lesson(
    problem_text: str,
    image_b64: str | None = None,
    subject_hint: str | None = None,
    course_label: str | None = None,
    course_snippets: list[dict[str, Any]] | None = None,
) -> dict:
    """Generate a short micro-lesson (1-3 steps) for quick reinforcement."""
    try:
        prompt = _build_micro_lesson_prompt(
            problem_text=problem_text,
            image_b64=image_b64,
            subject_hint=subject_hint,
            course_label=course_label,
            course_snippets=course_snippets or [],
        )
        primary_model_name = settings.gemini_model

        request_payload: Any = prompt
        if image_b64:
            import base64
            from io import BytesIO

            from PIL import Image

            try:
                image_data = base64.b64decode(image_b64)
                image = Image.open(BytesIO(image_data))
            except Exception as exc:
                raise AIServiceError("Uploaded image could not be decoded.") from exc

            image = image.convert("RGB")
            image.thumbnail((1024, 1024))
            request_payload = [prompt, image]

        result = await _generate_and_parse_micro(
            model_name=primary_model_name,
            payload=request_payload,
        )

        return result
    except AIServiceError:
        raise
    except Exception as exc:
        raise AIServiceError(f"Gemini micro-lesson generation failed: {exc}") from exc


def _should_use_quality_fallback(primary_model_name: str) -> bool:
    if not settings.gemini_quality_fallback_enabled:
        return False
    quality_model_name = settings.gemini_quality_model.strip()
    return bool(quality_model_name) and quality_model_name != primary_model_name


def _lesson_quality_sufficient(result: dict) -> bool:
    steps = result.get("steps")
    if not isinstance(steps, list) or len(steps) < 3:
        return False

    visual_types = {
        "write_equation",
        "write_text",
        "draw_line",
        "draw_arrow",
        "draw_rect",
        "draw_circle",
        "draw_axes",
        "plot_curve",
    }

    for step in steps:
        if not isinstance(step, dict):
            return False
        if not str(step.get("title", "")).strip():
            return False
        events = step.get("events", [])
        if not isinstance(events, list) or not events:
            return False
        has_narrate = any(
            isinstance(ev, dict) and ev.get("type") == "narrate"
            for ev in events
        )
        visual_count = sum(
            1
            for ev in events
            if isinstance(ev, dict) and ev.get("type") in visual_types
        )
        has_annotation_or_emphasis = any(
            (
                isinstance(ev, dict)
                and ev.get("type") == "annotate"
            ) or (
                isinstance(ev, dict)
                and ev.get("payload", {}).get("style", {}).get("emphasis")
                in {"key", "final"}
            )
            for ev in events
        )
        if not has_narrate or visual_count < 2 or not has_annotation_or_emphasis:
            return False
    return True


def _chat_needs_quality_fallback(result: dict) -> bool:
    message = str(result.get("message", "")).strip()
    narration = str(result.get("narration", "")).strip()
    if len(message) < 24:
        return True
    if len(narration) < 24:
        return True
    events = result.get("events")
    if isinstance(events, list) and len(events) > 8:
        return True
    return False


async def _generate_and_parse_lesson(model_name: str, payload: Any) -> dict:
    model = genai.GenerativeModel(model_name)
    response = await _generate_with_retries(model, payload, model_name=model_name)
    return _parse_lesson_response(response.text)


async def _generate_and_parse_chat(model_name: str, prompt: str) -> dict:
    model = genai.GenerativeModel(model_name)
    response = await _generate_with_retries(model, prompt, model_name=model_name)
    return _parse_chat_response(response.text)


async def _generate_and_parse_micro(model_name: str, payload: Any) -> dict:
    model = genai.GenerativeModel(model_name)
    response = await _generate_with_retries(model, payload, model_name=model_name)
    return _parse_micro_lesson_response(response.text)


def _format_course_context(
    course_label: str | None, course_snippets: list[dict[str, Any]]
) -> str:
    if not course_label:
        return ""

    header = [f"Preferred course context: {course_label}"]
    if not course_snippets:
        header.append(
            "No extracted notes snippets matched this query. Use standard instruction."
        )
        return "\n".join(header)

    header.append("Use these note excerpts as primary context:")
    for index, snippet in enumerate(course_snippets, start=1):
        filename = snippet.get("filename", "notes")
        text = str(snippet.get("text", "")).replace("\n", " ").strip()
        header.append(f"{index}. [{filename}] {text[:500]}")
    return "\n".join(header)


def _build_lesson_generation_prompt(
    problem_text: str,
    image_b64: str | None,
    subject_hint: str | None = None,
    course_label: str | None = None,
    course_snippets: list[dict[str, Any]] | None = None,
) -> str:
    """Build prompt that asks Gemini for granular whiteboard teaching choreography.

    Instead of asking for text blobs, we ask Gemini to script each step as a
    sequence of teaching actions — exactly what a professor would do at a
    whiteboard: speak, write an equation, speak again, highlight something, etc.
    """
    subject_line = subject_hint.strip() if subject_hint else "None provided"
    course_context = _format_course_context(course_label, course_snippets or [])
    return f"""You are an expert STEM professor giving a live whiteboard lesson. You TEACH by writing on a FIXED classroom whiteboard while narrating aloud.

PROBLEM: {problem_text}
Subject hint: {subject_line}

Create a step-by-step lesson. For EACH step, script teaching actions (events) with clean classroom rhythm.
The board does NOT scroll like a document. Use semantic lanes (Given/Derivation/Scratch/Final) and scene templates.

Return valid JSON (no markdown, no code blocks) with this structure:

{{
  "problem_statement": "The exact problem statement, word-for-word. If image-based, transcribe it faithfully.",
  "title": "Clear lesson title",
  "subject": "Subject area (Algebra, Calculus, Physics, etc.)",
  "steps": [
    {{
      "step_number": 1,
      "title": "Step title",
      "events": [
        {{"type": "narrate", "text": "What the professor says aloud"}},
        {{"type": "write_equation", "latex": "x^2 + 3x + 2 = 0", "display": true, "zone": "main", "anchor": "work", "lane": "derivation", "intent": "derive", "transform_chain_id": "c1", "scene_template": "derive_chain", "scene_id": "c1", "slot_role": "equation", "sync_hold_ms": 140}},
        {{"type": "write_text", "text": "Given:", "zone": "given", "anchor": "given", "intent": "introduce", "scene_template": "given_intro", "scene_id": "given-1", "slot_role": "heading", "sync_hold_ms": 120}},
        {{"type": "annotate", "target": "previous", "style": "highlight"}},
        {{"type": "draw_arrow", "x1": 1110, "y1": 180, "x2": 1360, "y2": 280, "zone": "scratch", "anchor": "scratch", "intent": "side_note", "label": "substitute"}},
        {{"type": "clear_section", "clear_target": "zone", "clear_zone": "scratch"}},
        {{"type": "pause"}}
      ]
    }}
  ]
}}

EVENT TYPES (use these to choreograph each step):
- "narrate": Professor speaks aloud; paired visuals play while narration runs
- "write_equation": Write LaTeX on board. Fields: latex, display, zone, anchor, lane, transform_chain_id, scene_template, scene_id, slot_role
- "write_text": Write short label on board. Fields: text, zone, anchor, lane, scene_template, scene_id, slot_role
- "annotate": highlight/underline/circle/box an existing target. Fields: style, target
- "draw_line": x1,y1,x2,y2
- "draw_arrow": x1,y1,x2,y2, optional label
- "draw_rect": x,y,width,height
- "draw_circle": cx,cy,r
- "draw_axes": x,y,width,height, optional x_label,y_label,ticks
- "plot_curve": points:[{{"x": 100, "y": 200}}, ...]
- "clear_section": clear board content by zone or id. Fields: clear_target ("zone"|"id"), clear_zone, clear_id
- "pause": brief pause for student

BOARD RULES:
1. Use teacher lanes in order: given -> derivation -> scratch -> final.
2. Keep derivation in a strict left-column flow with equals-sign alignment.
3. Use zone + anchor + lane together when possible:
   given=(zone:given, anchor:given, lane:given), derivation=(main,work,derivation), scratch=(scratch,scratch,scratch), final=(final,final,final)
4. Emit transform_chain_id for linked derivation equations so they stay vertically coherent.
5. Prefer lane/anchor placement. Avoid x/y/width/height unless drawing a diagram that truly needs coordinates.
6. When space is needed, clear scratch first; if still long, continue on next board page.
7. Keep given and final content persistent unless explicitly clearing.

CRITICAL CHOREOGRAPHY RULES:
1. PAIR narration WITH writing — each narrate event is followed by 1-3 visual events that play simultaneously with the audio
2. Pattern: narrate → 1-3 visuals → narrate → 1-3 visuals (alternate between speaking and writing)
3. Narration should describe what's being written in SPOKEN WORDS — say "x squared plus three x" not "x^2 + 3x"
4. write_text is for SHORT LABELS ONLY (max 10 words)
5. Use 4-8 events per step (not too few, not too many)
6. End each step's events with a brief pause
7. Narration should be conversational and natural — like a real professor talking
8. Write equations using proper LaTeX with double backslashes (\\\\)
9. For multi-part solutions, write each part as a separate visual event
10. Use annotate after key equations to draw attention to important parts
11. Keep individual narrate texts to 1-3 sentences (they'll be spoken aloud)
12. NEVER put verbatim equation text in narration — describe equations in spoken language
13. Every step must include at least: 1 narrate, 2 visual events, and 1 annotation/emphasis event
14. Use intent tags when possible: introduce, derive, emphasize, result, side_note
15. Prefer scene templates:
   - given_intro for setup
   - derive_chain for transformations
   - scratch_note for side work
   - final_result for final answer
16. Use sync_hold_ms (100-320) to keep narration and visual transitions natural.

EXAMPLE:
{{
  "step_number": 1,
  "title": "Set Up the Equation",
  "events": [
    {{"type": "narrate", "text": "Alright, let's start by writing down the equation we need to solve. We have x squared minus five x plus six equals zero."}},
    {{"type": "write_text", "text": "Given", "zone": "given", "anchor": "given", "intent": "introduce"}},
    {{"type": "write_equation", "latex": "x^2 - 5x + 6 = 0", "display": true, "zone": "main", "anchor": "work", "intent": "derive", "align": "left"}},
    {{"type": "narrate", "text": "This is a quadratic in standard form. Here a is one, b is negative five, and c is six. Let me underline those."}},
    {{"type": "annotate", "target": "previous", "style": "underline"}},
    {{"type": "pause"}}
  ]
}}

Create 4-6 steps with rich event choreography. Make it feel like a clean classroom whiteboard lesson.

{course_context}"""


def _build_micro_lesson_prompt(
    problem_text: str,
    image_b64: str | None,
    subject_hint: str | None,
    course_label: str | None,
    course_snippets: list[dict[str, Any]],
) -> str:
    """Build prompt for concise micro-lesson generation."""
    subject_line = subject_hint.strip() if subject_hint else "None provided"
    course_context = _format_course_context(course_label, course_snippets)
    return f"""You are an expert STEM tutor creating a short micro-lesson.

Task:
- Build a concise and focused lesson for this student request.
- Prioritize conceptual clarity over breadth.
- Keep it short enough for quick revision.

Problem or concept request: {problem_text}
Subject hint: {subject_line}

Return valid JSON (no markdown, no code blocks) with this exact structure:
{{
  "title": "Clear micro-lesson title",
  "subject": "Subject area",
  "introduction": "1-2 sentence setup",
  "steps": [
    {{
      "step_number": 1,
      "title": "Short step title",
      "content": "Focused explanation for this step with optional LaTeX like $x^2$",
      "key_insight": "Single key takeaway",
      "narration": "Natural spoken version of this step",
      "math_blocks": [
        {{
          "latex": "x^2 + 3x + 2 = 0",
          "display": true,
          "annotation": "What this expression represents"
        }}
      ]
    }}
  ],
  "summary": "Short recap",
  "quick_check": "One short concept-check question"
}}

Requirements:
- Generate 1 to 3 steps only.
- Keep each step concise and high-signal.
- Include at least one worked expression or equation when relevant.
- Use double backslashes in LaTeX (\\\\).
- If course context is provided, align notation, wording, and sequencing with those notes.
- If notes are missing coverage, provide a standard fallback explanation and keep it brief.

{course_context}"""


def _format_adaptation_context(adaptation: dict[str, Any] | None) -> str:
    if not isinstance(adaptation, dict):
        return ""

    level = str(adaptation.get("level", "low")).strip().lower()
    mode = str(adaptation.get("mode", "standard")).strip().lower()
    reason = str(adaptation.get("reason", "")).strip()
    signals = adaptation.get("signals", [])
    signal_text = ", ".join(signal for signal in signals if isinstance(signal, str))[:180]
    pacing = adaptation.get("recommended_pacing", "normal")
    depth = adaptation.get("recommended_depth", "standard")

    if level == "high":
        style_rules = (
            "- Slow pacing significantly and explain one micro-step at a time.\n"
            "- Begin with a quick prerequisite refresher before solving.\n"
            "- Include one analogy and one short concept check question."
        )
    elif level == "medium":
        style_rules = (
            "- Use moderate pacing with clear scaffolding.\n"
            "- Break each idea into smaller parts and confirm transitions.\n"
            "- Add one worked mini-example before moving on."
        )
    else:
        style_rules = (
            "- Keep normal pacing and concise explanations.\n"
            "- Only add extra scaffolding if the student asks for it."
        )

    return (
        "\nAdaptive tutoring policy (must follow):\n"
        f"- Confusion level: {level}\n"
        f"- Adaptation mode: {mode}\n"
        f"- Recommended pacing: {pacing}\n"
        f"- Recommended depth: {depth}\n"
        f"- Detection reason: {reason or 'n/a'}\n"
        f"- Signals: {signal_text or 'none'}\n"
        f"{style_rules}\n"
    )


def _build_chat_prompt(
    problem_context: str,
    chat_history: list,
    question: str,
    course_label: str | None = None,
    course_snippets: list[dict[str, Any]] | None = None,
    adaptation: dict[str, Any] | None = None,
) -> str:
    """Build prompt for chat response with optional mini whiteboard events."""
    history_text = ""
    for msg in chat_history:
        history_text += f"\n{msg.get('role', 'Unknown')}: {msg.get('message', '')}"

    course_context = _format_course_context(course_label, course_snippets or [])
    source_hint = (
        "Prioritize the student's uploaded course notes for this response."
        if course_label
        else "No uploaded course notes were provided."
    )
    adaptation_context = _format_adaptation_context(adaptation)

    return f"""You are a helpful math and science tutor. Answer the student's question clearly.

Original Problem: {problem_context}
Source preference: {source_hint}

Previous conversation:{history_text}

Student's new question: {question}

Respond as valid JSON (no markdown, no code blocks) with this structure:
{{
  "message": "Your clear, helpful explanation using LaTeX where appropriate",
  "narration": "What you would say aloud (keep it natural and conversational)",
  "math_blocks": [
    {{
      "latex": "your equation here",
      "display": true,
      "annotation": "Description of what this shows"
    }}
  ],
  "related_step": null,
  "events": [
    {{"type": "write_text", "text": "Quick note", "zone": "scratch", "anchor": "scratch", "intent": "side_note", "scene_template": "scratch_note", "slot_role": "explanation"}},
    {{"type": "write_equation", "latex": "x = 4", "display": true, "zone": "scratch", "anchor": "scratch", "intent": "derive", "scene_template": "scratch_note", "slot_role": "equation", "sync_hold_ms": 140}},
    {{"type": "annotate", "target": "previous", "style": "box"}}
  ]
}}

Guidelines:
- Use inline LaTeX like $x^2$ and display $$...$$
- Be encouraging and patient
- Address the student's specific question
- Use all double backslashes in LaTeX (\\\\)
- Keep narration conversational
- If course notes context is provided, match that language and sequencing.
- If notes do not cover part of the answer, state that and provide a fallback explanation.
- Include "events" only when a short whiteboard visual is helpful
- Keep events concise: at most 1 narrate + 4 visual/annotation events

{adaptation_context}
{course_context}"""


def _generate_event_id(step_number: int, event_index: int) -> str:
    """Generate a unique, deterministic event ID."""
    return f"s{step_number}_e{event_index}_{uuid.uuid4().hex[:6]}"


def _coerce_float(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _extract_style(raw: dict) -> dict | None:
    style = raw.get("event_style") or raw.get("style")
    if isinstance(style, dict):
        return {
            "color": style.get("color"),
            "stroke_width": style.get("stroke_width") or style.get("strokeWidth"),
            "emphasis": style.get("emphasis"),
        }
    return None


def _extract_points(raw: Any) -> list[dict] | None:
    if not isinstance(raw, list):
        return None
    points = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        x = _coerce_float(item.get("x"))
        y = _coerce_float(item.get("y"))
        if x is None or y is None:
            continue
        points.append({"x": x, "y": y})
    return points or None


_BOARD_WIDTH = 1600
_BOARD_HEIGHT = 900
_ALLOWED_ANCHORS = {"given", "work", "scratch", "final"}
_ALLOWED_ZONES = {"given", "main", "scratch", "final"}
_ALLOWED_INTENTS = {"introduce", "derive", "emphasize", "result", "side_note"}
_ALLOWED_LANES = {"given", "derivation", "scratch", "final"}
_ALLOWED_TEACHING_PHASES = {"setup", "derive", "checkpoint", "result"}
_ALLOWED_SCENE_TEMPLATES = {"given_intro", "derive_chain", "scratch_note", "final_result"}
_ALLOWED_SLOT_ROLES = {"heading", "equation", "explanation", "result"}
_LANE_HEIGHT_BUDGET = {
    "given": 168.0,
    "derivation": 444.0,
    "scratch": 638.0,
    "final": 132.0,
}


def _anchor_to_zone(anchor: str) -> str:
    if anchor == "work":
        return "main"
    return anchor


def _zone_to_anchor(zone: str) -> str:
    if zone == "main":
        return "work"
    return zone


def _anchor_to_lane(anchor: str) -> str:
    if anchor == "work":
        return "derivation"
    return anchor


def _lane_to_anchor(lane: str) -> str:
    if lane == "derivation":
        return "work"
    return lane


def _default_anchor_for_event(event_type: str, payload: dict) -> str:
    if payload.get("anchor") in _ALLOWED_ANCHORS:
        return payload["anchor"]
    if payload.get("zone") in _ALLOWED_ZONES:
        return _zone_to_anchor(payload["zone"])
    if event_type in {"draw_axes", "plot_curve", "draw_line", "draw_arrow", "draw_rect", "draw_circle"}:
        return "scratch"
    return "work"


def _infer_scene_template(anchor: str, event_type: str) -> str:
    if anchor == "given":
        return "given_intro"
    if anchor == "scratch":
        return "scratch_note"
    if anchor == "final":
        return "final_result"
    if event_type == "write_equation":
        return "derive_chain"
    return "derive_chain"


def _infer_slot_role(event_type: str, payload: dict, anchor: str) -> str:
    if anchor == "final" or payload.get("intent") == "result":
        return "result"
    if event_type == "write_equation":
        return "equation"
    if event_type == "write_text":
        text = str(payload.get("text", "")).strip().lower()
        if text.endswith(":") or text in {"given", "work", "scratch", "final"}:
            return "heading"
        return "explanation"
    return "explanation"


def _default_sync_hold_ms(payload: dict) -> float:
    phase = payload.get("teaching_phase")
    intent = payload.get("intent")
    if phase == "result" or intent == "result":
        return 280.0
    if phase == "checkpoint" or intent == "emphasize":
        return 220.0
    if phase == "setup":
        return 160.0
    return 120.0


def _normalize_payload_semantics(payload: dict, event_type: str) -> None:
    lane = payload.get("lane")
    if lane in _ALLOWED_LANES:
        payload["anchor"] = _lane_to_anchor(lane)

    anchor = payload.get("anchor")
    if anchor not in _ALLOWED_ANCHORS:
        anchor = _default_anchor_for_event(event_type, payload)
        payload["anchor"] = anchor

    if lane not in _ALLOWED_LANES:
        payload["lane"] = _anchor_to_lane(anchor)

    zone = payload.get("zone")
    if zone not in _ALLOWED_ZONES:
        payload["zone"] = _anchor_to_zone(anchor)
    elif "anchor" not in payload:
        payload["anchor"] = _zone_to_anchor(zone)

    if payload.get("intent") not in _ALLOWED_INTENTS:
        if payload["anchor"] == "given":
            payload["intent"] = "introduce"
        elif payload["anchor"] == "final":
            payload["intent"] = "result"
        elif payload["anchor"] == "scratch":
            payload["intent"] = "side_note"
        else:
            payload["intent"] = "derive"

    teaching_phase = payload.get("teaching_phase")
    if teaching_phase not in _ALLOWED_TEACHING_PHASES:
        intent = payload.get("intent")
        if intent == "introduce":
            payload["teaching_phase"] = "setup"
        elif intent == "result":
            payload["teaching_phase"] = "result"
        elif intent == "emphasize":
            payload["teaching_phase"] = "checkpoint"
        else:
            payload["teaching_phase"] = "derive"

    if payload.get("scene_template") not in _ALLOWED_SCENE_TEMPLATES:
        payload["scene_template"] = _infer_scene_template(payload["anchor"], event_type)

    if payload.get("slot_role") not in _ALLOWED_SLOT_ROLES:
        payload["slot_role"] = _infer_slot_role(event_type, payload, payload["anchor"])

    scene_id = payload.get("scene_id")
    if not isinstance(scene_id, str) or not scene_id.strip():
        chain = payload.get("transform_chain_id")
        if isinstance(chain, str) and chain.strip():
            payload["scene_id"] = chain.strip()
        else:
            payload["scene_id"] = f"{payload['lane']}-{payload['anchor']}"

    sync_hold_ms = payload.get("sync_hold_ms")
    if not isinstance(sync_hold_ms, (int, float)):
        payload["sync_hold_ms"] = _default_sync_hold_ms(payload)


def _clamp_payload_coordinates(payload: dict) -> None:
    if isinstance(payload.get("board_page"), (int, float)):
        payload["board_page"] = int(min(max(int(payload["board_page"]), 0), 8))
    if isinstance(payload.get("slot_index"), (int, float)):
        payload["slot_index"] = int(max(int(payload["slot_index"]), 0))
    if isinstance(payload.get("reserve_height"), (int, float)):
        payload["reserve_height"] = max(28.0, min(float(payload["reserve_height"]), 240.0))

    # Clamp direct coordinates
    if isinstance(payload.get("x"), (int, float)):
        payload["x"] = min(max(float(payload["x"]), 0.0), _BOARD_WIDTH - 20.0)
    if isinstance(payload.get("y"), (int, float)):
        payload["y"] = min(max(float(payload["y"]), 0.0), _BOARD_HEIGHT - 20.0)

    # Clamp vector coordinates
    for key, upper in (
        ("x1", _BOARD_WIDTH),
        ("x2", _BOARD_WIDTH),
        ("cx", _BOARD_WIDTH),
        ("y1", _BOARD_HEIGHT),
        ("y2", _BOARD_HEIGHT),
        ("cy", _BOARD_HEIGHT),
    ):
        if isinstance(payload.get(key), (int, float)):
            payload[key] = min(max(float(payload[key]), 0.0), float(upper))

    if isinstance(payload.get("width"), (int, float)):
        payload["width"] = max(40.0, min(float(payload["width"]), _BOARD_WIDTH))
    if isinstance(payload.get("height"), (int, float)):
        payload["height"] = max(24.0, min(float(payload["height"]), _BOARD_HEIGHT))
    if isinstance(payload.get("r"), (int, float)):
        payload["r"] = max(10.0, min(float(payload["r"]), 420.0))


def _build_common_payload(raw: dict) -> dict:
    payload: dict[str, Any] = {}
    zone = raw.get("zone") or raw.get("board_zone")
    if zone in {"given", "main", "scratch", "final"}:
        payload["zone"] = zone
    anchor = raw.get("anchor") or raw.get("board_anchor")
    if anchor in _ALLOWED_ANCHORS:
        payload["anchor"] = anchor
    lane = raw.get("lane")
    if lane in _ALLOWED_LANES:
        payload["lane"] = lane
    board_page = raw.get("board_page")
    if board_page is None:
        board_page = raw.get("boardPage")
    if isinstance(board_page, int):
        payload["board_page"] = board_page
    slot_index = raw.get("slot_index")
    if slot_index is None:
        slot_index = raw.get("slotIndex")
    if isinstance(slot_index, int):
        payload["slot_index"] = slot_index
    reserve_height_raw = raw.get("reserve_height")
    if reserve_height_raw is None:
        reserve_height_raw = raw.get("reserveHeight")
    reserve_height = _coerce_float(reserve_height_raw)
    if reserve_height is not None:
        payload["reserve_height"] = reserve_height
    transform_chain_id = raw.get("transform_chain_id") or raw.get("transformChainId")
    if isinstance(transform_chain_id, str) and transform_chain_id.strip():
        payload["transform_chain_id"] = transform_chain_id.strip()
    is_page_turn_marker = raw.get("is_page_turn_marker")
    if is_page_turn_marker is None:
        is_page_turn_marker = raw.get("isPageTurnMarker")
    if isinstance(is_page_turn_marker, bool):
        payload["is_page_turn_marker"] = is_page_turn_marker
    align = raw.get("align")
    if align in {"left", "center", "right"}:
        payload["align"] = align
    group_id = raw.get("group_id") or raw.get("groupId")
    if isinstance(group_id, str) and group_id.strip():
        payload["group_id"] = group_id.strip()
    intent = raw.get("intent")
    if intent in _ALLOWED_INTENTS:
        payload["intent"] = intent
    temporary = raw.get("temporary")
    if isinstance(temporary, bool):
        payload["temporary"] = temporary
    focus_target = raw.get("focus_target") or raw.get("focusTarget")
    if isinstance(focus_target, str) and focus_target.strip():
        payload["focus_target"] = focus_target.strip()
    teaching_phase = raw.get("teaching_phase") or raw.get("teachingPhase")
    if teaching_phase in _ALLOWED_TEACHING_PHASES:
        payload["teaching_phase"] = teaching_phase
    scene_template = raw.get("scene_template") or raw.get("sceneTemplate")
    if scene_template in _ALLOWED_SCENE_TEMPLATES:
        payload["scene_template"] = scene_template
    scene_id = raw.get("scene_id") or raw.get("sceneId")
    if isinstance(scene_id, str) and scene_id.strip():
        payload["scene_id"] = scene_id.strip()
    slot_role = raw.get("slot_role") or raw.get("slotRole")
    if slot_role in _ALLOWED_SLOT_ROLES:
        payload["slot_role"] = slot_role
    sync_hold_ms_raw = raw.get("sync_hold_ms")
    if sync_hold_ms_raw is None:
        sync_hold_ms_raw = raw.get("syncHoldMs")
    sync_hold_ms = _coerce_float(sync_hold_ms_raw)
    if sync_hold_ms is not None:
        payload["sync_hold_ms"] = max(0.0, min(sync_hold_ms, 1200.0))
    render_order = raw.get("render_order")
    if render_order is None:
        render_order = raw.get("renderOrder")
    if isinstance(render_order, int):
        payload["render_order"] = max(render_order, 0)
    layout_locked = raw.get("layout_locked")
    if layout_locked is None:
        layout_locked = raw.get("layoutLocked")
    if isinstance(layout_locked, bool):
        payload["layout_locked"] = layout_locked
    for key in ("x", "y", "width", "height", "x1", "y1", "x2", "y2", "cx", "cy", "r"):
        val = _coerce_float(raw.get(key))
        if val is not None:
            payload[key] = val
    label = raw.get("label")
    if isinstance(label, str):
        payload["label"] = label
    x_label = raw.get("x_label") or raw.get("xLabel")
    if isinstance(x_label, str):
        payload["x_label"] = x_label
    y_label = raw.get("y_label") or raw.get("yLabel")
    if isinstance(y_label, str):
        payload["y_label"] = y_label
    ticks = raw.get("ticks")
    if isinstance(ticks, int):
        payload["ticks"] = ticks
    points = _extract_points(raw.get("points"))
    if points:
        payload["points"] = points
    style = _extract_style(raw)
    if style:
        payload["style"] = style
    _clamp_payload_coordinates(payload)
    return payload


def _estimate_event_duration_ms(event_type: str, raw: dict) -> int:
    if event_type == "narrate":
        text = str(raw.get("text", ""))
        word_count = len(text.split())
        return max(1500, int(word_count / 2.5 * 1000))
    if event_type == "write_equation":
        return max(1200, len(str(raw.get("latex", ""))) * 50)
    if event_type == "write_text":
        return max(800, len(str(raw.get("text", ""))) * 30)
    if event_type in {"draw_line", "draw_arrow"}:
        return 900
    if event_type in {"draw_rect", "draw_circle"}:
        return 1000
    if event_type == "draw_axes":
        return 1300
    if event_type == "plot_curve":
        points = _extract_points(raw.get("points")) or []
        return max(1000, 450 + len(points) * 80)
    if event_type == "annotate":
        return 600
    if event_type == "clear_section":
        return 400
    if event_type == "pause":
        return 1200
    return 800


def _latex_complexity_score(latex: str) -> float:
    operators = sum(latex.count(op) for op in ("=", "+", "-", "*", "/"))
    radicals = latex.count("\\sqrt")
    fractions = latex.count("\\frac")
    return len(latex) * 0.55 + operators * 5.0 + radicals * 8.0 + fractions * 10.0


def _default_reserve_height(event_type: str, raw: dict) -> float | None:
    if event_type == "write_equation":
        complexity = _latex_complexity_score(str(raw.get("latex", "")))
        return max(56.0, min(150.0, 56.0 + complexity * 0.14))
    if event_type == "write_text":
        text_len = len(str(raw.get("text", "")))
        return max(34.0, min(90.0, 34.0 + text_len * 0.24))
    if event_type in {"draw_line", "draw_arrow"}:
        return 64.0
    if event_type in {"draw_rect", "draw_circle"}:
        return 96.0
    if event_type in {"draw_axes", "plot_curve"}:
        return 220.0
    return None


def _is_visual_event(event_type: str) -> bool:
    return event_type in {
        "write_equation",
        "write_text",
        "draw_line",
        "draw_arrow",
        "draw_rect",
        "draw_circle",
        "draw_axes",
        "plot_curve",
    }


def _process_event_stream(
    raw_events: list[dict],
    *,
    step_number: int | None,
    step_title: str | None = None,
    with_step_marker: bool = False,
    id_prefix: str,
) -> list[dict]:
    processed: list[dict] = []
    event_index_offset = 0
    derivation_chain_id: str | None = None

    if with_step_marker and step_number is not None:
        processed.append({
            "id": _generate_event_id(step_number, 0),
            "type": "step_marker",
            "duration": 300,
            "payload": {
                "step_number": step_number,
                "step_title": step_title or f"Step {step_number}",
            },
        })
        event_index_offset = 1

    for i, raw in enumerate(raw_events):
        if not isinstance(raw, dict):
            continue
        event_type = str(raw.get("type", "narrate"))
        event_id = (
            _generate_event_id(step_number, i + event_index_offset)
            if step_number is not None
            else f"{id_prefix}_{i}_{uuid.uuid4().hex[:6]}"
        )
        payload = _build_common_payload(raw)

        if step_number is not None:
            payload["step_number"] = step_number

        if event_type == "narrate":
            payload["text"] = str(raw.get("text", ""))
        elif event_type == "write_equation":
            payload["latex"] = str(raw.get("latex", ""))
            payload["display"] = bool(raw.get("display", True))
            # Width/height hints from model are often low-confidence for LaTeX;
            # planner should measure rendered size instead.
            payload.pop("width", None)
            payload.pop("height", None)
            _normalize_payload_semantics(payload, event_type)
        elif event_type == "write_text":
            payload["text"] = str(raw.get("text", ""))
            payload.pop("width", None)
            payload.pop("height", None)
            _normalize_payload_semantics(payload, event_type)
        elif event_type == "annotate":
            payload["annotation_type"] = raw.get("style", "highlight")
            if payload.get("intent") not in _ALLOWED_INTENTS:
                payload["intent"] = "emphasize"
            target = raw.get("target")
            if target == "previous":
                for prev in reversed(processed):
                    if _is_visual_event(prev["type"]):
                        payload["target_id"] = prev["id"]
                        break
            elif isinstance(target, str):
                payload["target_id"] = target
        elif event_type == "clear_section":
            clear_target = raw.get("clear_target") or raw.get("clearTarget")
            clear_zone = raw.get("clear_zone") or raw.get("clearZone")
            clear_id = raw.get("clear_id") or raw.get("clearId")
            if clear_target in {"zone", "id"}:
                payload["clear_target"] = clear_target
            if clear_zone in {"given", "main", "scratch", "final"}:
                payload["clear_zone"] = clear_zone
            if isinstance(clear_id, str):
                payload["clear_id"] = clear_id
            if "clear_target" not in payload and "clear_zone" in payload:
                payload["clear_target"] = "zone"
        elif event_type == "pause":
            pass
        elif event_type in {
            "draw_line",
            "draw_arrow",
            "draw_rect",
            "draw_circle",
            "draw_axes",
            "plot_curve",
        }:
            _normalize_payload_semantics(payload, event_type)
        else:
            logger.warning("Unknown event type from model: %s", event_type)
            continue

        if _is_visual_event(event_type):
            if payload.get("reserve_height") is None:
                reserve = _default_reserve_height(event_type, raw)
                if reserve is not None:
                    payload["reserve_height"] = reserve
            if payload.get("lane") == "derivation" and event_type in {"write_equation", "write_text"}:
                if not payload.get("transform_chain_id"):
                    if derivation_chain_id is None:
                        chain_step = step_number if step_number is not None else 0
                        derivation_chain_id = f"{id_prefix}_chain_{chain_step}"
                    payload["transform_chain_id"] = derivation_chain_id
                else:
                    derivation_chain_id = str(payload["transform_chain_id"])
            elif event_type != "annotate":
                derivation_chain_id = None

        processed.append({
            "id": event_id,
            "type": event_type,
            "duration": _estimate_event_duration_ms(event_type, raw),
            "payload": payload,
        })

    return processed


def _process_gemini_events(step: dict) -> list[dict]:
    """Normalize lesson events from Gemini output."""
    step_number = int(step.get("step_number", 1))
    raw_events = step.get("events", [])
    if not isinstance(raw_events, list):
        raw_events = []
    return _process_event_stream(
        raw_events,
        step_number=step_number,
        step_title=step.get("title", f"Step {step_number}"),
        with_step_marker=True,
        id_prefix=f"s{step_number}",
    )


def _apply_preplanned_board_metadata(events: list[dict]) -> None:
    page = 0
    derivation_chain_id: str | None = None
    render_order = 0
    lane_cursor = {
        "given": 8.0,
        "derivation": 8.0,
        "scratch": 8.0,
        "final": 8.0,
    }
    lane_slot = {
        "given": 0,
        "derivation": 0,
        "scratch": 0,
        "final": 0,
    }

    for event in events:
        payload = event.get("payload", {})
        if not isinstance(payload, dict):
            continue
        event_type = str(event.get("type", ""))
        if event_type == "clear_section":
            payload.setdefault("board_page", page)
            continue
        if not _is_visual_event(event_type):
            continue

        _normalize_payload_semantics(payload, event_type)
        lane = payload.get("lane", "derivation")
        reserve_height = float(payload.get("reserve_height") or _default_reserve_height(event_type, payload) or 72.0)

        if lane == "derivation" and event_type in {"write_equation", "write_text"}:
            if not payload.get("transform_chain_id"):
                if derivation_chain_id is None:
                    derivation_chain_id = f"step_chain_{payload.get('step_number', 0)}"
                payload["transform_chain_id"] = derivation_chain_id
            else:
                derivation_chain_id = str(payload["transform_chain_id"])
        else:
            derivation_chain_id = None

        explicit_page = payload.get("board_page")
        if isinstance(explicit_page, int):
            page = min(max(explicit_page, 0), 8)
        else:
            would_overflow = lane_cursor[lane] + reserve_height > _LANE_HEIGHT_BUDGET[lane]
            if would_overflow:
                page = min(page + 1, 8)
                lane_cursor = {k: 8.0 for k in lane_cursor}
                lane_slot = {k: 0 for k in lane_slot}
                payload["is_page_turn_marker"] = True
            payload["board_page"] = page

        payload.setdefault("slot_index", lane_slot[lane])
        payload["reserve_height"] = reserve_height
        payload["render_order"] = render_order
        payload["layout_locked"] = True
        render_order += 1
        lane_slot[lane] += 1
        lane_cursor[lane] += reserve_height + 14.0


def _repair_step_events(events: list[dict], step_number: int, step_title: str) -> list[dict]:
    repaired = [dict(event) for event in events]

    visual_types = {
        "write_equation",
        "write_text",
        "draw_line",
        "draw_arrow",
        "draw_rect",
        "draw_circle",
        "draw_axes",
        "plot_curve",
    }

    # Ensure there is at least one narrate event.
    if not any(event.get("type") == "narrate" for event in repaired):
        repaired.insert(1 if repaired and repaired[0].get("type") == "step_marker" else 0, {
            "id": _generate_event_id(step_number, 900),
            "type": "narrate",
            "duration": 1800,
            "payload": {
                "text": f"Let's work through {step_title}.",
                "step_number": step_number,
            },
        })

    first_content_index = 1 if repaired and repaired[0].get("type") == "step_marker" else 0
    if first_content_index < len(repaired) and repaired[first_content_index].get("type") != "narrate":
        repaired.insert(first_content_index, {
            "id": _generate_event_id(step_number, 905),
            "type": "narrate",
            "duration": 1700,
            "payload": {
                "text": f"First, we set up {step_title.lower()}.",
                "step_number": step_number,
                "teaching_phase": "setup",
            },
        })

    # Ensure at least two visual events for teaching rhythm.
    visual_count = sum(1 for event in repaired if event.get("type") in visual_types)
    if visual_count < 2:
        repaired.append({
            "id": _generate_event_id(step_number, 910),
            "type": "write_text",
            "duration": 1100,
            "payload": {
                "text": "Set up the next transformation.",
                "step_number": step_number,
                "zone": "main",
                "anchor": "work",
                "intent": "derive",
            },
        })

    # Ensure at least one annotation/emphasis action.
    has_annotation = any(event.get("type") == "annotate" for event in repaired)
    if not has_annotation:
        for event in reversed(repaired):
            if event.get("type") in visual_types:
                repaired.append({
                    "id": _generate_event_id(step_number, 920),
                    "type": "annotate",
                    "duration": 600,
                    "payload": {
                        "annotation_type": "highlight",
                        "target_id": event.get("id"),
                        "step_number": step_number,
                        "intent": "emphasize",
                    },
                })
                break

    has_checkpoint_narrate = any(
        event.get("type") == "narrate"
        and isinstance(event.get("payload"), dict)
        and event.get("payload", {}).get("teaching_phase") == "checkpoint"
        for event in repaired
    )
    if not has_checkpoint_narrate:
        insert_at = len(repaired)
        for idx, event in enumerate(repaired):
            if event.get("type") == "annotate":
                insert_at = idx + 1
                break
        repaired.insert(insert_at, {
            "id": _generate_event_id(step_number, 930),
            "type": "narrate",
            "duration": 1500,
            "payload": {
                "text": "Notice this transformation and why it keeps the equation consistent.",
                "step_number": step_number,
                "teaching_phase": "checkpoint",
            },
        })

    # Ensure step ends with a pause.
    if not repaired or repaired[-1].get("type") != "pause":
        repaired.append({
            "id": _generate_event_id(step_number, 999),
            "type": "pause",
            "duration": 900,
            "payload": {"step_number": step_number},
        })

    # Normalize payload semantics/coodinates for visual events.
    for event in repaired:
        payload = event.get("payload", {})
        if not isinstance(payload, dict):
            continue
        if event.get("type") in visual_types:
            _normalize_payload_semantics(payload, str(event.get("type")))
        if event.get("type") == "narrate" and payload.get("teaching_phase") not in _ALLOWED_TEACHING_PHASES:
            text = str(payload.get("text", "")).lower()
            if "final" in text or "answer" in text:
                payload["teaching_phase"] = "result"
            elif "notice" in text or "check" in text:
                payload["teaching_phase"] = "checkpoint"
            elif "first" in text or "given" in text:
                payload["teaching_phase"] = "setup"
            else:
                payload["teaching_phase"] = "derive"
        _clamp_payload_coordinates(payload)

    _apply_preplanned_board_metadata(repaired)

    return repaired


def _mark_chat_events_temporary(events: list[dict]) -> list[dict]:
    group_id = f"chat_{uuid.uuid4().hex[:8]}"
    repaired: list[dict] = []
    visual_ids: list[str] = []
    narrate_count = 0
    visual_count = 0

    for event in events:
        event_type = event.get("type")
        if event_type == "step_marker":
            continue
        if event_type == "narrate":
            if narrate_count >= 1:
                continue
            narrate_count += 1
        elif event_type in {"write_equation", "write_text", "draw_line", "draw_arrow", "draw_rect", "draw_circle", "draw_axes", "plot_curve", "annotate"}:
            if visual_count >= 4:
                continue
            visual_count += 1
        elif event_type == "pause":
            continue

        payload = dict(event.get("payload", {}))
        payload["temporary"] = True
        payload["group_id"] = group_id
        if event_type in {"write_equation", "write_text", "draw_line", "draw_arrow", "draw_rect", "draw_circle", "draw_axes", "plot_curve"}:
            payload["lane"] = "scratch"
            payload["anchor"] = "scratch"
            payload["zone"] = "scratch"
            payload.setdefault("intent", "side_note")
            _normalize_payload_semantics(payload, str(event_type))
            if payload.get("reserve_height") is None:
                reserve = _default_reserve_height(str(event_type), payload)
                if reserve is not None:
                    payload["reserve_height"] = reserve
            if isinstance(event.get("id"), str):
                visual_ids.append(event.get("id"))

        repaired.append({
            "id": event.get("id"),
            "type": event_type,
            "duration": event.get("duration", 700),
            "payload": payload,
        })

    # Auto-cleanup temporary overlay visuals after the interruption micro-lesson.
    cleanup_index = 0
    for visual_id in visual_ids:
        cleanup_index += 1
        repaired.append({
            "id": f"{group_id}_clear_{cleanup_index}",
            "type": "clear_section",
            "duration": 220,
            "payload": {
                "clear_target": "id",
                "clear_id": visual_id,
                "temporary": True,
                "group_id": group_id,
            },
        })

    if repaired and repaired[-1].get("type") != "pause":
        repaired.append({
            "id": f"{group_id}_pause",
            "type": "pause",
            "duration": 450,
            "payload": {
                "temporary": True,
                "group_id": group_id,
            },
        })

    return repaired


def _build_content_from_events(events: list[dict]) -> str:
    """Build a backward-compatible content string from events.

    Combines narrate text and equations into a markdown string
    so older frontends can still render something.
    """
    parts = []
    for ev in events:
        if ev["type"] == "narrate":
            parts.append(ev["payload"].get("text", ""))
        elif ev["type"] == "write_equation":
            latex = ev["payload"].get("latex", "")
            if ev["payload"].get("display"):
                parts.append(f"$${latex}$$")
            else:
                parts.append(f"${latex}$")
        elif ev["type"] == "write_text":
            parts.append(ev["payload"].get("text", ""))
    return "\n\n".join(parts)


def _build_narration_from_events(events: list[dict]) -> str:
    """Build a full narration string from all narrate events in a step."""
    return " ".join(
        ev["payload"].get("text", "")
        for ev in events
        if ev["type"] == "narrate"
    )


def _parse_lesson_response(response_text: str) -> dict:
    """Parse lesson generation response from Gemini.

    Handles the new event-based format.
    """
    try:
        json_str = response_text.strip()

        # Remove markdown code block if present
        if json_str.startswith("```"):
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
            json_str = json_str.strip()

        data = json.loads(json_str)

        if not all(k in data for k in ["title", "subject", "steps"]):
            raise ValueError("Gemini lesson response missing required fields: title/subject/steps.")

        # Process each step's events
        processed_steps = []
        for step in data.get("steps", []):
            if not all(k in step for k in ["step_number", "title"]):
                logger.warning("Invalid step structure, skipping")
                continue

            # Process Gemini's raw events into full AnimationEvent format
            if "events" in step and step["events"]:
                events = _process_gemini_events(step)
            else:
                # Gemini didn't return events — fall back to generating from content
                events = _generate_events_from_content(step)
            events = _repair_step_events(events, int(step["step_number"]), str(step["title"]))

            # Build backward-compat fields from events
            content = step.get("content") or _build_content_from_events(events)
            narration = step.get("narration") or _build_narration_from_events(events)

            # Extract math_blocks from events for backward compat
            math_blocks = step.get("math_blocks", [])
            if not math_blocks:
                math_blocks = [
                    {"latex": ev["payload"]["latex"], "display": ev["payload"].get("display", True)}
                    for ev in events
                    if ev["type"] == "write_equation" and ev["payload"].get("latex")
                ]

            processed_steps.append({
                "step_number": step["step_number"],
                "title": step["title"],
                "content": content,
                "narration": narration,
                "math_blocks": math_blocks,
                "hint": step.get("hint"),
                "events": events,
            })

        if not processed_steps:
            raise ValueError("Gemini lesson response contained no valid steps.")

        return {
            "problem_statement": str(data.get("problem_statement", "")).strip(),
            "title": data["title"],
            "subject": data["subject"],
            "steps": processed_steps,
        }

    except json.JSONDecodeError as e:
        preview = response_text.strip().replace("\n", " ")[:300]
        raise ValueError(
            f"Gemini returned non-JSON lesson output. Preview: {preview}"
        ) from e
    except Exception as e:
        raise ValueError(f"Failed to parse Gemini lesson response: {e}") from e


def _parse_micro_lesson_response(response_text: str) -> dict:
    data = _parse_lesson_response(response_text)
    raw_steps = data.get("steps", [])
    if not isinstance(raw_steps, list) or not raw_steps:
        raise ValueError("Gemini returned an invalid micro-lesson response.")

    compact_steps: list[dict[str, Any]] = []
    for index, step in enumerate(raw_steps[:3], start=1):
        if not isinstance(step, dict):
            continue
        compact_step = dict(step)
        compact_step["step_number"] = index
        compact_step["title"] = (
            str(compact_step.get("title", f"Step {index}")).strip() or f"Step {index}"
        )
        compact_step["content"] = str(compact_step.get("content", "")).strip()
        compact_step["narration"] = (
            str(compact_step.get("narration", "")).strip()
            or compact_step["content"]
            or compact_step["title"]
        )
        if not isinstance(compact_step.get("math_blocks"), list):
            compact_step["math_blocks"] = []
        compact_steps.append(compact_step)

    if not compact_steps:
        raise ValueError("Gemini returned empty micro-lesson steps.")

    data["steps"] = compact_steps
    if "summary" not in data or not str(data.get("summary", "")).strip():
        data["summary"] = "Quick recap complete. Ask a follow-up to go deeper."
    return data


def _generate_events_from_content(step: dict) -> list[dict]:
    """Fallback: Generate events from a flat text step (old format).

    Used when Gemini returns steps without events arrays.
    """
    step_number = step.get("step_number", 1)
    events = []

    # Step marker
    events.append({
        "id": _generate_event_id(step_number, 0),
        "type": "step_marker",
        "duration": 300,
        "payload": {
            "step_number": step_number,
            "step_title": step.get("title", f"Step {step_number}"),
        },
    })

    # Narrate the step title
    title_text = f"Step {step_number}: {step.get('title', '')}"
    events.append({
        "id": _generate_event_id(step_number, 1),
        "type": "narrate",
        "duration": max(1500, len(title_text.split()) / 2.5 * 1000),
        "payload": {
            "text": title_text,
            "step_number": step_number,
            "zone": "given",
            "anchor": "given",
            "intent": "introduce",
        },
    })

    # Write content as text
    content = step.get("content", "")
    if content:
        events.append({
            "id": _generate_event_id(step_number, 2),
            "type": "write_text",
            "duration": max(800, len(content) * 20),
            "payload": {
                "text": content,
                "step_number": step_number,
                "zone": "main",
                "anchor": "work",
                "lane": "derivation",
                "align": "left",
                "intent": "derive",
            },
        })

    # Write math blocks
    for j, mb in enumerate(step.get("math_blocks", [])):
        events.append({
            "id": _generate_event_id(step_number, 3 + j),
            "type": "write_equation",
            "duration": max(1200, len(mb.get("latex", "")) * 50),
            "payload": {
                "latex": mb.get("latex", ""),
                "display": mb.get("display", True),
                "step_number": step_number,
                "zone": "main",
                "anchor": "work",
                "lane": "derivation",
                "align": "left",
                "intent": "derive",
                "transform_chain_id": f"s{step_number}_fallback_chain",
            },
        })

    # End with pause
    events.append({
        "id": _generate_event_id(step_number, 99),
        "type": "pause",
        "duration": 1200,
        "payload": {"step_number": step_number},
    })

    return events


def _parse_chat_response(response_text: str) -> dict:
    """Parse chat response from Gemini."""
    try:
        json_str = response_text.strip()

        if json_str.startswith("```"):
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
            json_str = json_str.strip()

        data = json.loads(json_str)

        if "message" not in data:
            raise ValueError("Gemini chat response missing required field: message.")

        if "narration" not in data:
            data["narration"] = data.get("message", "")
        if "math_blocks" not in data:
            data["math_blocks"] = []

        raw_events = data.get("events", [])
        if isinstance(raw_events, list) and raw_events:
            parsed_events = _process_event_stream(
                raw_events,
                step_number=None,
                step_title=None,
                with_step_marker=False,
                id_prefix="chat",
            )
            data["events"] = _mark_chat_events_temporary(parsed_events)
        else:
            data["events"] = []

        return data

    except json.JSONDecodeError as e:
        preview = response_text.strip().replace("\n", " ")[:300]
        raise ValueError(
            f"Gemini returned non-JSON chat output. Preview: {preview}"
        ) from e
    except Exception as e:
        raise ValueError(f"Failed to parse Gemini chat response: {e}") from e
