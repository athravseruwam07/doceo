"""Realtime voice websocket channel."""

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.models.session import get_session, update_session

router = APIRouter()


def _append_voice_event(
    session_id: str,
    event_type: str,
    payload: dict[str, Any] | None = None,
) -> None:
    session = get_session(session_id)
    if session is None:
        return

    events = session.get("voice_events", [])
    events.append(
        {
            "type": event_type,
            "payload": payload or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )

    # Keep bounded in-memory history.
    update_session(session_id, voice_events=events[-500:])


@router.websocket("/{session_id}/voice/stream")
async def voice_stream(session_id: str, websocket: WebSocket):
    """Receive low-latency voice interaction events from the frontend.

    Message format (JSON):
    - {"type": "speech_start"}
    - {"type": "speech_end"}
    - {"type": "transcript", "text": "...", "is_final": true}
    - {"type": "ping"}
    """
    session = get_session(session_id)
    if session is None:
        await websocket.close(code=4404, reason="Session not found")
        return

    await websocket.accept()
    _append_voice_event(session_id, "socket_connected")
    await websocket.send_json({"type": "connected", "session_id": session_id})

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "message": "Invalid JSON payload"}
                )
                continue

            event_type = data.get("type")
            if event_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if event_type == "speech_start":
                _append_voice_event(session_id, "speech_start")
                await websocket.send_json({"type": "ack", "event": "speech_start"})
                continue

            if event_type == "speech_end":
                _append_voice_event(session_id, "speech_end")
                await websocket.send_json({"type": "ack", "event": "speech_end"})
                continue

            if event_type == "transcript":
                text = str(data.get("text", "")).strip()
                is_final = bool(data.get("is_final", False))
                if text:
                    _append_voice_event(
                        session_id,
                        "transcript",
                        {"text": text, "is_final": is_final},
                    )
                await websocket.send_json(
                    {
                        "type": "ack",
                        "event": "transcript",
                        "is_final": is_final,
                        "accepted": bool(text),
                    }
                )
                continue

            await websocket.send_json(
                {"type": "error", "message": f"Unknown event type: {event_type}"}
            )

    except WebSocketDisconnect:
        _append_voice_event(session_id, "socket_disconnected")
