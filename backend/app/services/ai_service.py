"""AI service using Google Gemini API for lesson generation and tutoring."""

import json
import logging
import re
from typing import Any

import google.generativeai as genai

from app.config import settings

# Configure Gemini
genai.configure(api_key=settings.gemini_api_key)

logger = logging.getLogger(__name__)
JSON_GENERATION_CONFIG = {"response_mime_type": "application/json"}


class AIServiceError(Exception):
    """Raised when AI generation fails or returns malformed content."""


def _generate_content_as_json(model: Any, contents: Any) -> Any:
    """Request JSON output with a safe fallback for older/unsupported model settings."""
    try:
        return model.generate_content(contents, generation_config=JSON_GENERATION_CONFIG)
    except Exception as exc:
        logger.warning(
            "Falling back to default Gemini output mode after JSON-mode error: %s",
            exc,
        )
        return model.generate_content(contents)


def _response_to_text(response: Any) -> str:
    """Extract text from Gemini response, including candidates fallback."""
    text = getattr(response, "text", None)
    if isinstance(text, str) and text.strip():
        return text

    fragments: list[str] = []
    candidates = getattr(response, "candidates", None)
    if isinstance(candidates, list):
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", None)
            if not isinstance(parts, list):
                continue
            for part in parts:
                part_text = getattr(part, "text", None)
                if isinstance(part_text, str) and part_text.strip():
                    fragments.append(part_text)

    return "\n".join(fragments).strip()


def _extract_json_object(text: str) -> str:
    """Extract the first balanced JSON object from model output text."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        fenced_parts = cleaned.split("```")
        if len(fenced_parts) >= 2:
            cleaned = fenced_parts[1].strip()
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()
        else:
            cleaned = cleaned.strip("`").strip()

    start = cleaned.find("{")
    if start < 0:
        return cleaned

    depth = 0
    in_string = False
    escaped = False

    for idx in range(start, len(cleaned)):
        ch = cleaned[idx]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return cleaned[start : idx + 1]

    return cleaned[start:]


def _sanitize_json_text(text: str) -> str:
    cleaned = text
    cleaned = cleaned.replace("“", '"').replace("”", '"')
    cleaned = cleaned.replace("‘", "'").replace("’", "'")
    cleaned = re.sub(r",(\s*[}\]])", r"\1", cleaned)
    return cleaned


def _load_json_response(response_text: str) -> dict[str, Any]:
    if not response_text.strip():
        raise AIServiceError("Gemini returned an empty response.")

    json_candidate = _extract_json_object(response_text)
    try:
        payload = json.loads(json_candidate)
    except json.JSONDecodeError as first_error:
        repaired = _sanitize_json_text(json_candidate)
        try:
            payload = json.loads(repaired)
        except json.JSONDecodeError as second_error:
            logger.error(
                "Failed to parse Gemini JSON. first=%s second=%s preview=%s",
                first_error,
                second_error,
                response_text[:500],
            )
            raise AIServiceError("Gemini returned malformed JSON.") from second_error

    if not isinstance(payload, dict):
        raise AIServiceError("Gemini returned a non-object JSON response.")
    return payload


async def analyze_problem(
    problem_text: str,
    image_b64: str | None = None,
    subject_hint: str | None = None,
    course_label: str | None = None,
    course_snippets: list[dict[str, Any]] | None = None,
) -> dict:
    """Analyze a problem and return lesson plan metadata.

    Args:
        problem_text: Text description of the problem
        image_b64: Optional base64-encoded image of the problem

    Returns:
        Dict with title, subject, and steps array
    """
    try:
        # Build the prompt for Gemini
        prompt = _build_lesson_generation_prompt(
            problem_text=problem_text,
            image_b64=image_b64,
            subject_hint=subject_hint,
            course_label=course_label,
            course_snippets=course_snippets or [],
        )

        # Call Gemini API
        model = genai.GenerativeModel(settings.gemini_model)

        if image_b64:
            # Multimodal: text + image
            import base64

            from PIL import Image
            from io import BytesIO

            image_data = base64.b64decode(image_b64)
            image = Image.open(BytesIO(image_data))
            response = _generate_content_as_json(model, [prompt, image])
        else:
            # Text only
            response = _generate_content_as_json(model, prompt)

        # Parse response
        result = _parse_lesson_response(_response_to_text(response))
        return result

    except Exception as e:
        logger.error(f"Error analyzing problem with Gemini: {e}")
        raise AIServiceError(
            f"Gemini request failed: {e}. "
            "Check GEMINI_API_KEY and model access, then retry."
        ) from e


async def generate_micro_lesson(
    problem_text: str,
    image_b64: str | None = None,
    subject_hint: str | None = None,
    course_label: str | None = None,
    course_snippets: list[dict[str, Any]] | None = None,
) -> dict:
    """Generate a short micro-lesson (1-3 steps) for quick concept reinforcement."""
    try:
        prompt = _build_micro_lesson_prompt(
            problem_text=problem_text,
            image_b64=image_b64,
            subject_hint=subject_hint,
            course_label=course_label,
            course_snippets=course_snippets or [],
        )

        model = genai.GenerativeModel(settings.gemini_model)

        if image_b64:
            import base64
            from io import BytesIO

            from PIL import Image

            image_data = base64.b64decode(image_b64)
            image = Image.open(BytesIO(image_data))
            response = _generate_content_as_json(model, [prompt, image])
        else:
            response = _generate_content_as_json(model, prompt)

        return _parse_micro_lesson_response(_response_to_text(response))
    except Exception as e:
        logger.error(f"Error generating micro lesson with Gemini: {e}")
        raise AIServiceError(
            f"Gemini micro-lesson request failed: {e}. "
            "Check GEMINI_API_KEY and model access, then retry."
        ) from e


async def generate_chat_response(
    problem_context: str,
    chat_history: list,
    question: str,
    course_label: str | None = None,
    course_snippets: list[dict[str, Any]] | None = None,
    adaptation: dict[str, Any] | None = None,
) -> dict:
    """Generate a tutor response to a student question.

    Args:
        problem_context: The original problem being solved
        chat_history: List of previous messages
        question: The student's new question

    Returns:
        Dict with tutor response and metadata
    """
    try:
        # Build conversation context
        prompt = _build_chat_prompt(
            problem_context=problem_context,
            chat_history=chat_history,
            question=question,
            course_label=course_label,
            course_snippets=course_snippets or [],
            adaptation=adaptation,
        )

        # Call Gemini API
        model = genai.GenerativeModel(settings.gemini_model)
        response = _generate_content_as_json(model, prompt)

        # Parse response
        result = _parse_chat_response(_response_to_text(response))
        return result

    except Exception as e:
        logger.error(f"Error generating chat response: {e}")
        raise AIServiceError(
            f"Gemini chat request failed: {e}. "
            "Check GEMINI_API_KEY and model access, then retry."
        ) from e


def _format_course_context(
    course_label: str | None, course_snippets: list[dict[str, Any]]
) -> str:
    if not course_label:
        return ""

    header = [f"Preferred Course Context: {course_label}"]
    if not course_snippets:
        header.append(
            "No extracted notes snippets were found for this query. Use standard teaching."
        )
        return "\n".join(header)

    header.append("Use these note excerpts as the primary teaching source:")
    for index, snippet in enumerate(course_snippets, start=1):
        filename = snippet.get("filename", "notes")
        text = str(snippet.get("text", "")).replace("\n", " ").strip()
        header.append(f"{index}. [{filename}] {text[:500]}")

    return "\n".join(header)


def _build_lesson_generation_prompt(
    problem_text: str,
    image_b64: str | None,
    subject_hint: str | None,
    course_label: str | None,
    course_snippets: list[dict[str, Any]],
) -> str:
    """Build prompt for lesson generation."""
    course_context = _format_course_context(course_label, course_snippets)
    subject_line = subject_hint.strip() if subject_hint else "None provided"

    return f"""You are an expert STEM tutor who explains concepts clearly and thoroughly.

Analyze this problem and create a step-by-step lesson plan to solve or explain it.

Problem: {problem_text}
Subject hint: {subject_line}

Create a comprehensive lesson with clear steps. Return your response as valid JSON (no markdown, no code blocks) with this exact structure:
{{
  "title": "Clear title of the lesson",
  "subject": "Subject area (e.g., Algebra, Calculus, Physics, Chemistry)",
  "introduction": "Brief introduction to the problem",
  "steps": [
    {{
      "step_number": 1,
      "title": "Step title",
      "content": "Explanation with inline LaTeX like $x^2$ and display math $$x = \\\\frac{{-b \\\\pm \\\\sqrt{{b^2 - 4ac}}}}{{2a}}$$",
      "key_insight": "The key insight for this step",
      "narration": "What you would say aloud when teaching this step (keep it natural and conversational)",
      "math_blocks": [
        {{
          "latex": "x^2 + 3x + 2 = 0",
          "display": true,
          "annotation": "This is the equation we need to solve"
        }}
      ]
    }}
  ],
  "summary": "Summary of what was learned"
}}

Ensure:
- Each step has clear narration text (what a tutor would say)
- All LaTeX uses double backslashes (\\\\)
- Math blocks are properly formatted
- Steps are logical and build on each other
- Content is accurate and mathematically rigorous
- If course context is provided, prefer that terminology, notation style, and method order.
- If notes are incomplete, fill gaps with standard explanations but explicitly keep the note's style.

{course_context}"""


def _build_micro_lesson_prompt(
    problem_text: str,
    image_b64: str | None,
    subject_hint: str | None,
    course_label: str | None,
    course_snippets: list[dict[str, Any]],
) -> str:
    """Build prompt for short micro-lesson generation."""
    course_context = _format_course_context(course_label, course_snippets)
    subject_line = subject_hint.strip() if subject_hint else "None provided"

    return f"""You are an expert STEM tutor creating an instant micro-lesson.

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


def _build_chat_prompt(
    problem_context: str,
    chat_history: list,
    question: str,
    course_label: str | None,
    course_snippets: list[dict[str, Any]],
    adaptation: dict[str, Any] | None = None,
) -> str:
    """Build prompt for chat response."""
    history_text = ""
    for msg in chat_history:
        history_text += f"\n{msg.get('role', 'Unknown')}: {msg.get('message', '')}"

    course_context = _format_course_context(course_label, course_snippets)
    source_hint = (
        "Prioritize the student's uploaded course notes for this response."
        if course_label
        else "No uploaded course notes were provided."
    )
    adaptation_context = _format_adaptation_context(adaptation)

    return f"""You are a helpful math and science tutor. Answer the student's question in a clear, patient way.

Original Problem: {problem_context}
Source preference: {source_hint}

Previous conversation:{history_text}

Student's new question: {question}

Respond as valid JSON (no markdown, no code blocks) with this exact structure:
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
  "related_step": null
}}

Guidelines:
- Use inline LaTeX like $x^2$ and display $$...$$
- Be encouraging and patient
- Address the student's specific question
- Use all double backslashes in LaTeX (\\\\)
- Keep narration conversational
- If course notes context is provided, match that language and sequencing.
- If notes do not cover part of the answer, state that and provide a standard fallback explanation.

{adaptation_context}
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


def _parse_lesson_response(response_text: str) -> dict:
    """Parse lesson generation response from Gemini.

    Args:
        response_text: Raw response text from Gemini

    Returns:
        Parsed lesson data or mock data on failure
    """
    try:
        data = _load_json_response(response_text)

        # Validate required fields
        if not all(k in data for k in ["title", "subject", "steps"]):
            logger.warning("Missing required fields in lesson response")
            raise AIServiceError("Gemini returned an incomplete lesson response.")

        # Validate steps structure
        steps = data.get("steps")
        if not isinstance(steps, list) or not steps:
            raise AIServiceError("Gemini returned a lesson with no valid steps.")

        for index, step in enumerate(steps):
            if not isinstance(step, dict):
                raise AIServiceError("Gemini returned an invalid lesson step structure.")
            if not all(k in step for k in ["step_number", "title", "content"]):
                logger.warning("Invalid step structure")
                raise AIServiceError("Gemini returned an invalid lesson step structure.")

            if not isinstance(step.get("step_number"), int):
                step["step_number"] = index + 1
            if not isinstance(step.get("math_blocks"), list):
                step["math_blocks"] = []

            # Ensure narration exists
            if "narration" not in step:
                step["narration"] = step.get("content", "")

        return data

    except AIServiceError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error parsing lesson response: {e}")
        raise AIServiceError("Failed to parse Gemini lesson response.") from e


def _parse_micro_lesson_response(response_text: str) -> dict:
    data = _parse_lesson_response(response_text)
    raw_steps = data.get("steps", [])
    if not isinstance(raw_steps, list) or not raw_steps:
        raise AIServiceError("Gemini returned an invalid micro-lesson response.")

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
        raise AIServiceError("Gemini returned empty micro-lesson steps.")

    data["steps"] = compact_steps
    if "summary" not in data or not str(data.get("summary", "")).strip():
        data["summary"] = "Quick recap complete. Ask a follow-up to go deeper."
    return data


def _parse_chat_response(response_text: str) -> dict:
    """Parse chat response from Gemini.

    Args:
        response_text: Raw response text from Gemini

    Returns:
        Parsed chat response or mock data on failure
    """
    try:
        data = _load_json_response(response_text)

        # Validate required fields
        if "message" not in data:
            logger.warning("Missing 'message' field in chat response")
            raise AIServiceError("Gemini chat response was missing message content.")

        # Ensure narration exists
        if "narration" not in data:
            data["narration"] = data.get("message", "")

        # Ensure math_blocks exists
        if "math_blocks" not in data:
            data["math_blocks"] = []
        elif not isinstance(data["math_blocks"], list):
            data["math_blocks"] = []

        return data

    except AIServiceError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error parsing chat response: {e}")
        raise AIServiceError("Failed to parse Gemini chat response.") from e
