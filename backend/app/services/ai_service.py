"""AI service using Google Gemini API for lesson generation and tutoring."""

import json
import logging
import uuid
from typing import Any

import google.generativeai as genai

from app.config import settings
from app.mock.responses import (
    MOCK_CHAT_RESPONSES,
    MOCK_LESSON_STEPS,
    MOCK_SESSION_SUBJECT,
    MOCK_SESSION_TITLE,
)

# Configure Gemini
genai.configure(api_key=settings.gemini_api_key)

logger = logging.getLogger(__name__)


async def analyze_problem(
    problem_text: str, image_b64: str | None = None
) -> dict:
    """Analyze a problem and return lesson plan with granular teaching events.

    Args:
        problem_text: Text description of the problem
        image_b64: Optional base64-encoded image of the problem

    Returns:
        Dict with title, subject, and steps array (each step has events)
    """
    try:
        prompt = _build_lesson_generation_prompt(problem_text, image_b64)

        model = genai.GenerativeModel(settings.gemini_model)

        if image_b64:
            import base64
            from io import BytesIO

            from PIL import Image

            image_data = base64.b64decode(image_b64)
            image = Image.open(BytesIO(image_data))
            response = model.generate_content([prompt, image])
        else:
            response = model.generate_content(prompt)

        result = _parse_lesson_response(response.text)
        return result

    except Exception as e:
        logger.error(f"Error analyzing problem with Gemini: {e}")
        return {
            "title": MOCK_SESSION_TITLE,
            "subject": MOCK_SESSION_SUBJECT,
            "steps": MOCK_LESSON_STEPS,
        }


async def generate_chat_response(
    problem_context: str, chat_history: list, question: str
) -> dict:
    """Generate a tutor response to a student question."""
    try:
        prompt = _build_chat_prompt(problem_context, chat_history, question)
        model = genai.GenerativeModel(settings.gemini_model)
        response = model.generate_content(prompt)
        result = _parse_chat_response(response.text)
        return result

    except Exception as e:
        logger.error(f"Error generating chat response: {e}")
        question_lower = question.lower()
        for keyword in ["why", "how", "example"]:
            if keyword in question_lower:
                return MOCK_CHAT_RESPONSES[keyword]
        return MOCK_CHAT_RESPONSES["default"]


def _build_lesson_generation_prompt(problem_text: str, image_b64: str | None) -> str:
    """Build prompt that asks Gemini for granular whiteboard teaching choreography.

    Instead of asking for text blobs, we ask Gemini to script each step as a
    sequence of teaching actions — exactly what a professor would do at a
    whiteboard: speak, write an equation, speak again, highlight something, etc.
    """
    return f"""You are an expert STEM professor giving a live whiteboard lesson. You don't just explain — you TEACH by writing on a whiteboard while narrating aloud, exactly like a real classroom.

PROBLEM: {problem_text}

Create a step-by-step lesson. For EACH step, script the exact sequence of teaching actions (events) as if you were at a whiteboard. Think about what you'd SAY, what you'd WRITE, and when you'd PAUSE.

Return valid JSON (no markdown, no code blocks) with this structure:

{{
  "title": "Clear lesson title",
  "subject": "Subject area (Algebra, Calculus, Physics, etc.)",
  "steps": [
    {{
      "step_number": 1,
      "title": "Step title",
      "events": [
        {{"type": "narrate", "text": "What the professor says aloud (conversational, natural)"}},
        {{"type": "write_equation", "latex": "x^2 + 3x + 2 = 0", "display": true}},
        {{"type": "narrate", "text": "Now let me explain what this means..."}},
        {{"type": "write_text", "text": "Key insight or note written on the board"}},
        {{"type": "annotate", "target": "previous", "style": "highlight"}},
        {{"type": "pause"}}
      ]
    }}
  ]
}}

EVENT TYPES (use these to choreograph each step):
- "narrate": Professor speaks aloud. Use natural, conversational language. This is what the student HEARS. The "text" should be what the professor says word-for-word.
- "write_equation": Professor writes a math equation on the board. Use LaTeX in "latex" field. Set "display": true for centered display math, false for inline.
- "write_text": Professor writes plain text/notes on the board (not equations). Used for labels, key points, definitions.
- "annotate": Professor circles, highlights, or underlines something already on the board. Set "style" to "highlight", "underline", "circle", or "box". Set "target" to "previous" to annotate the last written element.
- "pause": Brief pause for the student to absorb. Use between major ideas.

CRITICAL CHOREOGRAPHY RULES:
1. ALWAYS narrate BEFORE writing — the professor explains what they're about to write, then writes it
2. After writing a complex equation, narrate to explain what it means
3. Use 4-8 events per step (not too few, not too many)
4. Alternate between narrating and writing — never have 3+ narrate events in a row without writing something
5. End each step's events with a brief pause
6. Narration should be conversational and natural — like a real professor talking, not a textbook
7. Write equations using proper LaTeX with double backslashes (\\\\)
8. For multi-part solutions, write each part as a separate write_equation event
9. Use annotate after key equations to draw attention to important parts
10. Keep individual narrate texts to 1-3 sentences (they'll be spoken aloud)

EXAMPLE of good step choreography:
{{
  "step_number": 1,
  "title": "Set Up the Equation",
  "events": [
    {{"type": "narrate", "text": "Alright, let's start by writing down the equation we need to solve."}},
    {{"type": "write_equation", "latex": "x^2 - 5x + 6 = 0", "display": true}},
    {{"type": "narrate", "text": "This is a quadratic equation. Notice it's in the standard form a x squared plus b x plus c equals zero."}},
    {{"type": "write_text", "text": "Standard form: ax² + bx + c = 0"}},
    {{"type": "narrate", "text": "Here, a is 1, b is negative 5, and c is 6. Let me highlight those coefficients."}},
    {{"type": "annotate", "target": "previous", "style": "underline"}},
    {{"type": "pause"}}
  ]
}}

Create 4-6 steps with rich event choreography. Make it feel like watching a real professor teach."""


def _build_chat_prompt(
    problem_context: str, chat_history: list, question: str
) -> str:
    """Build prompt for chat response with teaching events."""
    history_text = ""
    for msg in chat_history:
        history_text += f"\n{msg.get('role', 'Unknown')}: {msg.get('message', '')}"

    return f"""You are a helpful math and science tutor. Answer the student's question clearly.

Original Problem: {problem_context}

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
  "related_step": null
}}

Guidelines:
- Use inline LaTeX like $x^2$ and display $$...$$
- Be encouraging and patient
- Address the student's specific question
- Use all double backslashes in LaTeX (\\\\)
- Keep narration conversational"""


def _generate_event_id(step_number: int, event_index: int) -> str:
    """Generate a unique, deterministic event ID."""
    return f"s{step_number}_e{event_index}_{uuid.uuid4().hex[:6]}"


def _process_gemini_events(step: dict) -> list[dict]:
    """Process raw Gemini events into the full AnimationEvent format.

    Gemini returns simplified events. This function:
    1. Assigns unique IDs
    2. Sets initial duration estimates (overwritten later by audio durations for narrate)
    3. Structures the payload correctly
    4. Prepends a step_marker event
    """
    step_number = step.get("step_number", 1)
    raw_events = step.get("events", [])
    processed = []

    # Prepend step_marker
    processed.append({
        "id": _generate_event_id(step_number, 0),
        "type": "step_marker",
        "duration": 300,
        "payload": {
            "step_number": step_number,
            "step_title": step.get("title", f"Step {step_number}"),
        },
    })

    for i, raw in enumerate(raw_events):
        event_type = raw.get("type", "narrate")
        event_id = _generate_event_id(step_number, i + 1)

        if event_type == "narrate":
            text = raw.get("text", "")
            # Initial duration estimate based on speech rate (~150 words/min = 2.5 words/sec)
            word_count = len(text.split())
            estimated_ms = max(1500, int(word_count / 2.5 * 1000))
            processed.append({
                "id": event_id,
                "type": "narrate",
                "duration": estimated_ms,
                "payload": {
                    "text": text,
                    "step_number": step_number,
                },
            })

        elif event_type == "write_equation":
            latex = raw.get("latex", "")
            display = raw.get("display", True)
            # Duration based on equation complexity
            duration = max(1200, len(latex) * 50)
            processed.append({
                "id": event_id,
                "type": "write_equation",
                "duration": duration,
                "payload": {
                    "latex": latex,
                    "display": display,
                    "step_number": step_number,
                },
            })

        elif event_type == "write_text":
            text = raw.get("text", "")
            duration = max(800, len(text) * 30)
            processed.append({
                "id": event_id,
                "type": "write_text",
                "duration": duration,
                "payload": {
                    "text": text,
                    "step_number": step_number,
                },
            })

        elif event_type == "annotate":
            style = raw.get("style", "highlight")
            # Find the target: "previous" means the last visual event
            target_id = None
            if raw.get("target") == "previous":
                for prev in reversed(processed):
                    if prev["type"] in ("write_equation", "write_text"):
                        target_id = prev["id"]
                        break
            processed.append({
                "id": event_id,
                "type": "annotate",
                "duration": 600,
                "payload": {
                    "annotation_type": style,
                    "target_id": target_id,
                    "step_number": step_number,
                },
            })

        elif event_type == "pause":
            processed.append({
                "id": event_id,
                "type": "pause",
                "duration": 1200,
                "payload": {
                    "step_number": step_number,
                },
            })

        elif event_type == "clear_section":
            processed.append({
                "id": event_id,
                "type": "clear_section",
                "duration": 400,
                "payload": {
                    "step_number": step_number,
                },
            })

    return processed


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

    Handles the new event-based format. Falls back to mock data on failure.
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
            logger.warning("Missing required fields in lesson response")
            return _fallback_response()

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
            logger.warning("No valid steps parsed")
            return _fallback_response()

        return {
            "title": data["title"],
            "subject": data["subject"],
            "steps": processed_steps,
        }

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse lesson JSON: {e}")
        return _fallback_response()
    except Exception as e:
        logger.error(f"Unexpected error parsing lesson response: {e}")
        return _fallback_response()


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
        "payload": {"text": title_text, "step_number": step_number},
    })

    # Write content as text
    content = step.get("content", "")
    if content:
        events.append({
            "id": _generate_event_id(step_number, 2),
            "type": "write_text",
            "duration": max(800, len(content) * 20),
            "payload": {"text": content, "step_number": step_number},
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


def _fallback_response() -> dict:
    """Return mock data as fallback."""
    return {
        "title": MOCK_SESSION_TITLE,
        "subject": MOCK_SESSION_SUBJECT,
        "steps": MOCK_LESSON_STEPS,
    }


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
            logger.warning("Missing 'message' field in chat response")
            return MOCK_CHAT_RESPONSES["default"]

        if "narration" not in data:
            data["narration"] = data.get("message", "")
        if "math_blocks" not in data:
            data["math_blocks"] = []

        return data

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse chat JSON: {e}")
        return MOCK_CHAT_RESPONSES["default"]
    except Exception as e:
        logger.error(f"Unexpected error parsing chat response: {e}")
        return MOCK_CHAT_RESPONSES["default"]
