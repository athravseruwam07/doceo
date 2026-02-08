"""AI service using Google Gemini API for lesson generation and tutoring."""

import asyncio
import json
import logging
import uuid
from functools import lru_cache
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)
_genai_module = None
_genai_configured = False


@lru_cache(maxsize=1)
def _get_mock_payloads() -> dict[str, Any]:
    """Lazy-load mock payloads so startup is not blocked by large constants."""
    from app.mock.responses import (
        MOCK_CHAT_RESPONSES,
        MOCK_LESSON_STEPS,
        MOCK_SESSION_SUBJECT,
        MOCK_SESSION_TITLE,
    )

    return {
        "chat": MOCK_CHAT_RESPONSES,
        "lesson_steps": MOCK_LESSON_STEPS,
        "session_subject": MOCK_SESSION_SUBJECT,
        "session_title": MOCK_SESSION_TITLE,
    }


def _get_generative_model():
    """Lazy-load Gemini SDK to avoid slow import during app startup."""
    global _genai_module, _genai_configured

    if _genai_module is None:
        import google.generativeai as genai  # Lazy import

        _genai_module = genai

    if not _genai_configured:
        _genai_module.configure(api_key=settings.gemini_api_key)
        _genai_configured = True

    return _genai_module.GenerativeModel(settings.gemini_model)


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

        model = _get_generative_model()

        if image_b64:
            import base64
            from io import BytesIO

            from PIL import Image

            image_data = base64.b64decode(image_b64)
            image = Image.open(BytesIO(image_data))
            response = await asyncio.to_thread(
                model.generate_content, [prompt, image]
            )
        else:
            response = await asyncio.to_thread(model.generate_content, prompt)

        result = _parse_lesson_response(response.text)
        return result

    except Exception as e:
        logger.error(f"Error analyzing problem with Gemini: {e}")
        mock = _get_mock_payloads()
        return {
            "title": mock["session_title"],
            "subject": mock["session_subject"],
            "steps": mock["lesson_steps"],
        }


async def generate_chat_response(
    problem_context: str, chat_history: list, question: str
) -> dict:
    """Generate a tutor response to a student question."""
    try:
        prompt = _build_chat_prompt(problem_context, chat_history, question)
        model = _get_generative_model()
        response = await asyncio.to_thread(model.generate_content, prompt)
        result = _parse_chat_response(response.text)
        return result

    except Exception as e:
        logger.error(f"Error generating chat response: {e}")
        mock = _get_mock_payloads()["chat"]
        question_lower = question.lower()
        for keyword in ["why", "how", "example"]:
            if keyword in question_lower:
                return mock[keyword]
        return mock["default"]


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
    mock = _get_mock_payloads()
    return {
        "title": mock["session_title"],
        "subject": mock["session_subject"],
        "steps": mock["lesson_steps"],
    }


def _parse_chat_response(response_text: str) -> dict:
    """Parse chat response from Gemini."""
    try:
        json_str = response_text.strip()
        mock_chat = _get_mock_payloads()["chat"]

        if json_str.startswith("```"):
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
            json_str = json_str.strip()

        data = json.loads(json_str)

        if "message" not in data:
            logger.warning("Missing 'message' field in chat response")
            return mock_chat["default"]

        if "narration" not in data:
            data["narration"] = data.get("message", "")
        if "math_blocks" not in data:
            data["math_blocks"] = []

        return data

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse chat JSON: {e}")
        return _get_mock_payloads()["chat"]["default"]
    except Exception as e:
        logger.error(f"Unexpected error parsing chat response: {e}")
        return _get_mock_payloads()["chat"]["default"]


async def generate_exam_cram_plan(
    subject_hint: str,
    exam_name: str | None,
    materials: list[dict[str, str]],
    top_terms: list[str] | None = None,
) -> dict:
    """Generate a predictive exam-cram plan from uploaded materials."""
    try:
        model = _get_generative_model()
        prompt = _build_exam_cram_prompt(
            subject_hint=subject_hint,
            exam_name=exam_name,
            materials=materials,
            top_terms=top_terms or [],
        )
        response = await asyncio.to_thread(model.generate_content, prompt)
        return _parse_exam_cram_response(response.text, subject_hint, top_terms or [])
    except Exception as e:
        logger.error(f"Error generating exam cram plan: {e}")
        return _fallback_exam_cram_response(subject_hint, top_terms or [])


def _build_exam_cram_prompt(
    subject_hint: str,
    exam_name: str | None,
    materials: list[dict[str, str]],
    top_terms: list[str],
) -> str:
    material_blocks: list[str] = []
    for idx, item in enumerate(materials, start=1):
        material_blocks.append(
            (
                f"Material {idx}\n"
                f"Name: {item.get('name', f'Material {idx}')}\n"
                f"Type: {item.get('source_type', 'text')}\n"
                f"Content:\n{item.get('content', '')}"
            )
        )

    materials_text = "\n\n---\n\n".join(material_blocks)
    top_terms_text = ", ".join(top_terms[:15]) if top_terms else "None"
    exam_label = exam_name or "Upcoming Exam"

    return f"""You are a predictive STEM exam prep assistant.

Subject hint: {subject_hint}
Exam: {exam_label}
Frequent terms extracted from the corpus: {top_terms_text}

Materials:
{materials_text}

Task:
1) Identify recurring question patterns and high-frequency concepts.
2) Predict the highest-likelihood topics for the next exam.
3) Produce focused lesson targets and realistic practice questions.
4) Keep the output concise and actionable for a student with limited study time.

Return valid JSON only with this exact shape:
{{
  "subject": "Detected subject",
  "recurring_patterns": [
    "Pattern description"
  ],
  "prioritized_topics": [
    {{
      "topic": "Topic name",
      "likelihood": 0.0,
      "why": "Why this is likely",
      "evidence": ["Signals from materials"],
      "study_actions": ["Specific study action"]
    }}
  ],
  "focused_lessons": [
    {{
      "title": "Lesson title",
      "objective": "What student should master",
      "key_points": ["Point 1", "Point 2"],
      "estimated_minutes": 20
    }}
  ],
  "practice_questions": [
    {{
      "question": "Exam-style question",
      "difficulty": "easy",
      "concept": "Core concept",
      "answer_outline": "Concise marking-scheme style outline"
    }}
  ]
}}

Rules:
- likelihood must be between 0 and 1
- Include 5 to 8 prioritized topics
- Include 4 to 6 focused lessons
- Include 8 to 12 practice questions
- difficulty must be one of: easy, medium, hard
- Use realistic STEM exam language, no fluff
"""


def _clamp_likelihood(value: Any) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except Exception:
        return 0.5


def _parse_exam_cram_response(
    response_text: str, subject_hint: str, top_terms: list[str]
) -> dict:
    try:
        json_str = response_text.strip()

        if json_str.startswith("```"):
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
            json_str = json_str.strip()

        data = json.loads(json_str)

        subject = data.get("subject") or subject_hint
        recurring_patterns = data.get("recurring_patterns", [])

        prioritized_topics = []
        for topic in data.get("prioritized_topics", [])[:8]:
            if not isinstance(topic, dict):
                continue
            name = str(topic.get("topic", "")).strip()
            if not name:
                continue
            prioritized_topics.append(
                {
                    "topic": name,
                    "likelihood": _clamp_likelihood(topic.get("likelihood", 0.5)),
                    "why": str(topic.get("why", "")).strip() or "Commonly recurring in provided materials.",
                    "evidence": [
                        str(x).strip()
                        for x in (topic.get("evidence", []) or [])
                        if str(x).strip()
                    ][:4],
                    "study_actions": [
                        str(x).strip()
                        for x in (topic.get("study_actions", []) or [])
                        if str(x).strip()
                    ][:4],
                }
            )

        focused_lessons = []
        for lesson in data.get("focused_lessons", [])[:6]:
            if not isinstance(lesson, dict):
                continue
            title = str(lesson.get("title", "")).strip()
            objective = str(lesson.get("objective", "")).strip()
            if not title or not objective:
                continue
            try:
                estimated = int(lesson.get("estimated_minutes", 20))
            except Exception:
                estimated = 20
            focused_lessons.append(
                {
                    "title": title,
                    "objective": objective,
                    "key_points": [
                        str(x).strip()
                        for x in (lesson.get("key_points", []) or [])
                        if str(x).strip()
                    ][:5],
                    "estimated_minutes": max(5, min(60, estimated)),
                }
            )

        practice_questions = []
        for item in data.get("practice_questions", [])[:12]:
            if not isinstance(item, dict):
                continue
            question = str(item.get("question", "")).strip()
            concept = str(item.get("concept", "")).strip()
            outline = str(item.get("answer_outline", "")).strip()
            difficulty = str(item.get("difficulty", "medium")).strip().lower()
            if difficulty not in {"easy", "medium", "hard"}:
                difficulty = "medium"
            if not question or not concept:
                continue
            practice_questions.append(
                {
                    "question": question,
                    "difficulty": difficulty,
                    "concept": concept,
                    "answer_outline": outline or "Outline key formulas, substitutions, and final result.",
                }
            )

        if not prioritized_topics or not focused_lessons or not practice_questions:
            return _fallback_exam_cram_response(subject_hint, top_terms)

        return {
            "subject": subject,
            "recurring_patterns": [
                str(x).strip() for x in recurring_patterns if str(x).strip()
            ][:8],
            "prioritized_topics": prioritized_topics,
            "focused_lessons": focused_lessons,
            "practice_questions": practice_questions,
        }
    except Exception as e:
        logger.error(f"Failed to parse exam cram response: {e}")
        return _fallback_exam_cram_response(subject_hint, top_terms)


def _fallback_exam_cram_response(subject_hint: str, top_terms: list[str]) -> dict:
    seed_topics = top_terms[:6] or ["core concepts", "problem types", "derivations"]
    prioritized_topics = []
    for idx, topic in enumerate(seed_topics, start=1):
        likelihood = max(0.35, min(0.9, 0.85 - (idx * 0.08)))
        prioritized_topics.append(
            {
                "topic": topic.title(),
                "likelihood": round(likelihood, 2),
                "why": "Appears frequently in the provided study materials.",
                "evidence": [f"Repeated references to '{topic}'"],
                "study_actions": [
                    f"Solve 3 timed questions focused on {topic}.",
                    f"Review one worked solution and identify common mistakes in {topic}.",
                ],
            }
        )

    focused_lessons = [
        {
            "title": "High-Frequency Concept Review",
            "objective": "Consolidate the most repeated exam concepts first.",
            "key_points": ["Definitions", "Core formulas", "Typical exam traps"],
            "estimated_minutes": 20,
        },
        {
            "title": "Pattern-Based Problem Solving",
            "objective": "Recognize recurring problem formats quickly.",
            "key_points": ["Prompt cues", "Method selection", "Checkpoints"],
            "estimated_minutes": 25,
        },
        {
            "title": "Timed Mixed Practice",
            "objective": "Improve speed and exam accuracy under constraints.",
            "key_points": ["Time budgeting", "Partial-credit strategy", "Error review"],
            "estimated_minutes": 30,
        },
        {
            "title": "Final Weak-Spot Drill",
            "objective": "Target remaining low-confidence areas before exam day.",
            "key_points": ["Weak-topic quiz", "Formula recall", "Last-pass fixes"],
            "estimated_minutes": 15,
        },
    ]

    practice_questions = []
    for i, topic in enumerate(seed_topics[:8], start=1):
        difficulty = "easy" if i <= 2 else "medium" if i <= 5 else "hard"
        practice_questions.append(
            {
                "question": f"Exam-style question {i}: apply {topic} in a multi-step setting.",
                "difficulty": difficulty,
                "concept": topic.title(),
                "answer_outline": "State assumptions, apply the core method, show key steps, and verify final answer.",
            }
        )

    return {
        "subject": subject_hint or "General STEM",
        "recurring_patterns": [
            "Core concepts repeat across multiple materials.",
            "Exam questions emphasize method selection under time pressure.",
        ],
        "prioritized_topics": prioritized_topics,
        "focused_lessons": focused_lessons,
        "practice_questions": practice_questions,
    }
