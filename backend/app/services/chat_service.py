from app.models.session import get_session, update_session
from app.services.ai_service import generate_chat_response


async def handle_message(session_id: str, message: str) -> dict:
    """Process a student chat message and return the tutor's response.

    Stores both the user message and tutor response in the session's chat_log.
    """
    session = get_session(session_id)
    if session is None:
        return None

    # Store user message
    chat_log = session.get("chat_log", [])
    chat_log.append({"role": "student", "message": message})

    # Generate tutor response
    response = await generate_chat_response(
        problem_context=session.get("problem_text", ""),
        chat_history=chat_log,
        question=message,
    )

    # Store tutor response
    chat_log.append(response)
    update_session(session_id, chat_log=chat_log)

    return response
