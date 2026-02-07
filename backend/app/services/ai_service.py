# TODO: Replace with real Gemini API calls
# This file is the ONLY file a teammate needs to modify for Gemini integration

from app.mock.responses import (
    MOCK_LESSON_STEPS,
    MOCK_CHAT_RESPONSES,
    MOCK_SESSION_TITLE,
    MOCK_SESSION_SUBJECT,
)


async def analyze_problem(
    problem_text: str, image_b64: str | None = None
) -> dict:
    """Analyze a problem and return lesson plan metadata.

    TODO: Replace with real Gemini call:
    - Send problem_text and/or image to Gemini
    - Ask it to identify the subject and create a lesson plan
    - Return structured response
    """
    return {
        "title": MOCK_SESSION_TITLE,
        "subject": MOCK_SESSION_SUBJECT,
        "steps": MOCK_LESSON_STEPS,
    }


async def generate_chat_response(
    problem_context: str, chat_history: list, question: str
) -> dict:
    """Generate a tutor response to a student question.

    TODO: Replace with real Gemini call:
    - Send problem context, chat history, and new question to Gemini
    - Ask it to respond as a helpful tutor
    - Return structured response with LaTeX where appropriate
    """
    question_lower = question.lower()
    for keyword in ["why", "how", "example"]:
        if keyword in question_lower:
            return MOCK_CHAT_RESPONSES[keyword]
    return MOCK_CHAT_RESPONSES["default"]
