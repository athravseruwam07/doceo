from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import get_session, update_session
from app.services.voice_service import get_voice_service


async def handle_message(session_id: str, message: str, db: AsyncSession, context: dict | None = None) -> dict:
    """Process a student chat message and return the tutor's response."""
    session = await get_session(db, session_id)
    if session is None:
        return None

    chat_log = session.get("chat_log", [])
    chat_log.append({"role": "student", "message": message})

    context_suffix = ""
    if context:
        context_suffix = (
            f"\n\nCurrent Lesson Context:\n"
            f"- Step: {context.get('current_step')}\n"
            f"- Step title: {context.get('current_step_title')}\n"
            f"- Active event: {context.get('current_event_type')}\n"
            f"- Active narration: {context.get('active_narration')}\n"
        )

    from app.services.ai_service import generate_chat_response

    response = await generate_chat_response(
        problem_context=session.get("problem_text", ""),
        chat_history=chat_log,
        question=f"{message}{context_suffix}",
    )

    voice_service = get_voice_service()
    narration = response.get("narration", response.get("message", ""))
    audio_data = await voice_service.generate_narration_audio(narration)

    response["role"] = "tutor"
    response["audio_url"] = audio_data.get("audio_url")
    response["audio_duration"] = audio_data.get("duration", 0)
    if not response["audio_url"] and audio_data.get("error_code") == "missing_tts_permission":
        print(
            "[ChatService] Voice provider key is missing text_to_speech permission. "
            "Returning chat response without narration audio."
        )

    chat_log.append(response)
    await update_session(db, session_id, chat_log=chat_log)

    return response
