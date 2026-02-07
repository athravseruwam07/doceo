"""AI service using Google Gemini API for lesson generation and tutoring."""

import json
import logging
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
    """Analyze a problem and return lesson plan metadata.

    Args:
        problem_text: Text description of the problem
        image_b64: Optional base64-encoded image of the problem

    Returns:
        Dict with title, subject, and steps array
    """
    try:
        # Build the prompt for Gemini
        prompt = _build_lesson_generation_prompt(problem_text, image_b64)

        # Call Gemini API
        model = genai.GenerativeModel(settings.gemini_model)

        if image_b64:
            # Multimodal: text + image
            import base64

            from PIL import Image
            from io import BytesIO

            image_data = base64.b64decode(image_b64)
            image = Image.open(BytesIO(image_data))
            response = model.generate_content([prompt, image])
        else:
            # Text only
            response = model.generate_content(prompt)

        # Parse response
        result = _parse_lesson_response(response.text)
        return result

    except Exception as e:
        logger.error(f"Error analyzing problem with Gemini: {e}")
        # Fallback to mock data
        return {
            "title": MOCK_SESSION_TITLE,
            "subject": MOCK_SESSION_SUBJECT,
            "steps": MOCK_LESSON_STEPS,
        }


async def generate_chat_response(
    problem_context: str, chat_history: list, question: str
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
        prompt = _build_chat_prompt(problem_context, chat_history, question)

        # Call Gemini API
        model = genai.GenerativeModel(settings.gemini_model)
        response = model.generate_content(prompt)

        # Parse response
        result = _parse_chat_response(response.text)
        return result

    except Exception as e:
        logger.error(f"Error generating chat response: {e}")
        # Fallback to mock data based on question
        question_lower = question.lower()
        for keyword in ["why", "how", "example"]:
            if keyword in question_lower:
                return MOCK_CHAT_RESPONSES[keyword]
        return MOCK_CHAT_RESPONSES["default"]


def _build_lesson_generation_prompt(problem_text: str, image_b64: str | None) -> str:
    """Build prompt for lesson generation."""
    return f"""You are an expert STEM tutor who explains concepts clearly and thoroughly.

Analyze this problem and create a step-by-step lesson plan to solve or explain it.

Problem: {problem_text}

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
- Content is accurate and mathematically rigorous"""


def _build_chat_prompt(
    problem_context: str, chat_history: list, question: str
) -> str:
    """Build prompt for chat response."""
    history_text = ""
    for msg in chat_history:
        history_text += f"\n{msg.get('role', 'Unknown')}: {msg.get('message', '')}"

    return f"""You are a helpful math and science tutor. Answer the student's question in a clear, patient way.

Original Problem: {problem_context}

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
- Keep narration conversational"""


def _parse_lesson_response(response_text: str) -> dict:
    """Parse lesson generation response from Gemini.

    Args:
        response_text: Raw response text from Gemini

    Returns:
        Parsed lesson data or mock data on failure
    """
    try:
        # Try to extract JSON from response
        json_str = response_text.strip()

        # Remove markdown code block if present
        if json_str.startswith("```"):
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
            json_str = json_str.strip()

        # Parse JSON
        data = json.loads(json_str)

        # Validate required fields
        if not all(k in data for k in ["title", "subject", "steps"]):
            logger.warning("Missing required fields in lesson response")
            return {
                "title": MOCK_SESSION_TITLE,
                "subject": MOCK_SESSION_SUBJECT,
                "steps": MOCK_LESSON_STEPS,
            }

        # Validate steps structure
        for step in data.get("steps", []):
            if not all(k in step for k in ["step_number", "title", "content"]):
                logger.warning("Invalid step structure")
                return {
                    "title": MOCK_SESSION_TITLE,
                    "subject": MOCK_SESSION_SUBJECT,
                    "steps": MOCK_LESSON_STEPS,
                }

            # Ensure narration exists
            if "narration" not in step:
                step["narration"] = step.get("content", "")

        return data

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse lesson JSON: {e}")
        return {
            "title": MOCK_SESSION_TITLE,
            "subject": MOCK_SESSION_SUBJECT,
            "steps": MOCK_LESSON_STEPS,
        }
    except Exception as e:
        logger.error(f"Unexpected error parsing lesson response: {e}")
        return {
            "title": MOCK_SESSION_TITLE,
            "subject": MOCK_SESSION_SUBJECT,
            "steps": MOCK_LESSON_STEPS,
        }


def _parse_chat_response(response_text: str) -> dict:
    """Parse chat response from Gemini.

    Args:
        response_text: Raw response text from Gemini

    Returns:
        Parsed chat response or mock data on failure
    """
    try:
        # Try to extract JSON from response
        json_str = response_text.strip()

        # Remove markdown code block if present
        if json_str.startswith("```"):
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
            json_str = json_str.strip()

        # Parse JSON
        data = json.loads(json_str)

        # Validate required fields
        if "message" not in data:
            logger.warning("Missing 'message' field in chat response")
            return MOCK_CHAT_RESPONSES["default"]

        # Ensure narration exists
        if "narration" not in data:
            data["narration"] = data.get("message", "")

        # Ensure math_blocks exists
        if "math_blocks" not in data:
            data["math_blocks"] = []

        return data

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse chat JSON: {e}")
        return MOCK_CHAT_RESPONSES["default"]
    except Exception as e:
        logger.error(f"Unexpected error parsing chat response: {e}")
        return MOCK_CHAT_RESPONSES["default"]
