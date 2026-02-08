from typing import Optional
import uuid

_sessions: dict[str, dict] = {}


def create_session(
    title: str,
    subject: str,
    problem_text: str = "",
    image_b64: str | None = None,
    step_count: int = 5,
) -> dict:
    session_id = str(uuid.uuid4())[:8]
    session = {
        "session_id": session_id,
        "title": title,
        "subject": subject,
        "problem_text": problem_text,
        "image_b64": image_b64,
        "step_count": step_count,
        "status": "processing",
        "voice_status": "unknown",
        "build_stage": "received",
        "steps": [],
        "chat_log": [],
    }
    _sessions[session_id] = session
    return session


def get_session(session_id: str) -> Optional[dict]:
    return _sessions.get(session_id)


def update_session(session_id: str, **kwargs) -> Optional[dict]:
    if session_id in _sessions:
        _sessions[session_id].update(kwargs)
        return _sessions[session_id]
    return None
