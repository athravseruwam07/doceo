"""Session storage — async SQLAlchemy backed.

All functions are async and require a db session + user_id.
The original in-memory dict has been replaced.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import TutoringSession


def _new_cuid() -> str:
    """Generate a cuid-like id (using uuid4 for simplicity)."""
    return str(uuid.uuid4()).replace("-", "")[:25]


def _short_id() -> str:
    """Generate an 8-char session slug for URLs."""
    return str(uuid.uuid4())[:8]


async def create_session(
    db: AsyncSession,
    user_id: str,
    title: str,
    subject: str,
    problem_text: str = "",
    image_b64: str | None = None,
    step_count: int = 5,
) -> dict:
    session_id = _short_id()
    row = TutoringSession(
        id=_new_cuid(),
        session_id=session_id,
        user_id=user_id,
        title=title,
        subject=subject,
        problem_text=problem_text,
        image_b64=image_b64,
        step_count=step_count,
        status="processing",
        voice_status="unknown",
        build_stage="received",
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _row_to_dict(row)


async def get_session(db: AsyncSession, session_id: str, user_id: str | None = None) -> Optional[dict]:
    stmt = select(TutoringSession).where(TutoringSession.session_id == session_id)
    if user_id:
        stmt = stmt.where(TutoringSession.user_id == user_id)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return _row_to_dict(row)


async def update_session(db: AsyncSession, session_id: str, **kwargs) -> Optional[dict]:
    # Map simple keys to column attributes
    col_map = {
        "title": TutoringSession.title,
        "subject": TutoringSession.subject,
        "problem_text": TutoringSession.problem_text,
        "image_b64": TutoringSession.image_b64,
        "step_count": TutoringSession.step_count,
        "status": TutoringSession.status,
        "voice_status": TutoringSession.voice_status,
        "build_stage": TutoringSession.build_stage,
        "audio_status": TutoringSession.audio_status,
        "steps": TutoringSession.steps_json,
        "chat_log": TutoringSession.chat_log_json,
        "exam_materials": TutoringSession.exam_materials_json,
        "exam_cram": TutoringSession.exam_cram_json,
    }

    values = {}
    for key, val in kwargs.items():
        if key in col_map:
            values[col_map[key]] = val

    values[TutoringSession.updated_at] = datetime.now(timezone.utc)

    if values:
        stmt = sa_update(TutoringSession).where(TutoringSession.session_id == session_id).values(values)
        await db.execute(stmt)
        await db.commit()

    return await get_session(db, session_id)


async def list_sessions(db: AsyncSession, user_id: str) -> list[dict]:
    stmt = (
        select(TutoringSession)
        .where(TutoringSession.user_id == user_id)
        .order_by(TutoringSession.updated_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [_row_to_dict(row) for row in rows]


def _row_to_dict(row: TutoringSession) -> dict:
    """Convert a TutoringSession ORM row to the dict format the rest of the app expects."""
    return {
        "id": row.id,
        "session_id": row.session_id,
        "user_id": row.user_id,
        "title": row.title,
        "subject": row.subject,
        "problem_text": row.problem_text,
        "image_b64": row.image_b64,
        "step_count": row.step_count,
        "status": row.status,
        "voice_status": row.voice_status,
        "build_stage": row.build_stage,
        "audio_status": row.audio_status,
        "steps": row.steps_json or [],
        "chat_log": row.chat_log_json or [],
        "exam_materials": row.exam_materials_json or [],
        "exam_cram": row.exam_cram_json,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
