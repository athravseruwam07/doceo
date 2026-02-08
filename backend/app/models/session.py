import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

_sessions: dict[str, dict[str, Any]] = {}
_backend_root = Path(__file__).resolve().parents[2]
_data_dir = _backend_root / "data"
_sessions_file = _data_dir / "sessions.json"


def _utc_now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _ensure_storage() -> None:
    _data_dir.mkdir(parents=True, exist_ok=True)
    if not _sessions_file.exists():
        _sessions_file.write_text("{}", encoding="utf-8")


def _load_sessions() -> None:
    global _sessions
    _ensure_storage()
    try:
        payload = json.loads(_sessions_file.read_text(encoding="utf-8"))
    except Exception:
        payload = {}

    if isinstance(payload, dict):
        _sessions = payload
    else:
        _sessions = {}


def _serializable_copy(session: dict[str, Any]) -> dict[str, Any]:
    # Persist derived lesson artifacts and metadata; skip raw upload image payload.
    copy = dict(session)
    copy["image_b64"] = None
    return copy


def _save_sessions() -> None:
    _ensure_storage()
    payload = {
        session_id: _serializable_copy(session)
        for session_id, session in _sessions.items()
    }
    _sessions_file.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def _normalize_session(session: dict[str, Any]) -> dict[str, Any]:
    created_at = session.get("created_at")
    if not isinstance(created_at, str) or not created_at.strip():
        session["created_at"] = _utc_now_iso()

    if "steps" not in session or not isinstance(session.get("steps"), list):
        session["steps"] = []
    if "chat_log" not in session or not isinstance(session.get("chat_log"), list):
        session["chat_log"] = []
    if "status" not in session or not isinstance(session.get("status"), str):
        session["status"] = "processing"
    if "step_count" not in session or not isinstance(session.get("step_count"), int):
        session["step_count"] = len(session.get("steps", []))

    return session


def create_session(
    title: str,
    subject: str,
    problem_text: str = "",
    image_b64: str | None = None,
    step_count: int = 5,
    course_id: str | None = None,
    course_label: str | None = None,
) -> dict[str, Any]:
    session_id = str(uuid.uuid4())[:8]
    session = {
        "session_id": session_id,
        "title": title,
        "subject": subject,
        "problem_text": problem_text,
        "image_b64": image_b64,
        "step_count": step_count,
        "status": "processing",
        "steps": [],
        "chat_log": [],
        "course_id": course_id,
        "course_label": course_label,
        "created_at": _utc_now_iso(),
    }
    _sessions[session_id] = _normalize_session(session)
    _save_sessions()
    return _sessions[session_id]


def get_session(session_id: str) -> Optional[dict[str, Any]]:
    session = _sessions.get(session_id)
    if session is None:
        return None
    return _normalize_session(session)


def update_session(session_id: str, **kwargs) -> Optional[dict[str, Any]]:
    if session_id not in _sessions:
        return None

    _sessions[session_id].update(kwargs)
    _normalize_session(_sessions[session_id])
    _save_sessions()
    return _sessions[session_id]


def list_sessions_for_course(
    course_id: str, limit: int = 20
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for session in _sessions.values():
        if session.get("course_id") != course_id:
            continue

        normalized = _normalize_session(session)
        problem_preview = str(normalized.get("problem_text", "")).strip()
        if len(problem_preview) > 180:
            problem_preview = problem_preview[:177].rstrip() + "..."

        rows.append(
            {
                "session_id": normalized.get("session_id"),
                "title": normalized.get("title"),
                "subject": normalized.get("subject"),
                "status": normalized.get("status"),
                "step_count": normalized.get("step_count", 0),
                "created_at": normalized.get("created_at"),
                "problem_preview": problem_preview,
            }
        )

    rows.sort(key=lambda row: str(row.get("created_at", "")), reverse=True)
    return rows[:limit]


def delete_sessions_for_course(course_id: str) -> int:
    to_remove = [
        session_id
        for session_id, session in _sessions.items()
        if session.get("course_id") == course_id
    ]
    if not to_remove:
        return 0

    for session_id in to_remove:
        _sessions.pop(session_id, None)
    _save_sessions()
    return len(to_remove)


_load_sessions()
