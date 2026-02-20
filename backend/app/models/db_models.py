"""SQLAlchemy models mirroring the Prisma schema.

Column names use the same snake_case mapping defined in schema.prisma so both
ORMs read/write the same physical columns.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


# ── NextAuth tables (read-only from backend) ────────────────────────


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=True)
    email = Column(String, unique=True, nullable=True)
    emailVerified = Column("emailVerified", DateTime, nullable=True)
    image = Column(String, nullable=True)
    passwordHash = Column("passwordHash", String, nullable=True)

    createdAt = Column("createdAt", DateTime, default=lambda: datetime.now(timezone.utc))
    updatedAt = Column("updatedAt", DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    tutoring_sessions = relationship("TutoringSession", back_populates="user")


# ── Application tables ───────────────────────────────────────────────


class TutoringSession(Base):
    __tablename__ = "tutoring_sessions"

    id = Column(String, primary_key=True)
    session_id = Column("session_id", String, unique=True, nullable=False)
    user_id = Column("user_id", String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    problem_text = Column("problem_text", Text, nullable=True)
    image_b64 = Column("image_b64", Text, nullable=True)
    step_count = Column("step_count", Integer, default=0)
    status = Column(String, default="processing")
    voice_status = Column("voice_status", String, default="unknown")
    build_stage = Column("build_stage", String, default="received")
    audio_status = Column("audio_status", String, nullable=True)

    # JSON columns for easy migration from in-memory dict
    steps_json = Column("steps_json", JSON, default=list)
    chat_log_json = Column("chat_log_json", JSON, default=list)
    exam_materials_json = Column("exam_materials_json", JSON, default=list)
    exam_cram_json = Column("exam_cram_json", JSON, nullable=True)

    created_at = Column("created_at", DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column("updated_at", DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="tutoring_sessions")
    lesson_steps = relationship("LessonStep", back_populates="tutoring_session", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="tutoring_session", cascade="all, delete-orphan")
    exam_crams = relationship("ExamCram", back_populates="tutoring_session", cascade="all, delete-orphan")


class LessonStep(Base):
    __tablename__ = "lesson_steps"

    id = Column(String, primary_key=True)
    tutoring_session_id = Column("tutoring_session_id", String, ForeignKey("tutoring_sessions.id", ondelete="CASCADE"), nullable=False)
    step_number = Column("step_number", Integer, nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    hint = Column(Text, nullable=True)
    narration = Column(Text, nullable=True)
    audio_url = Column("audio_url", String, nullable=True)
    audio_duration = Column("audio_duration", Float, nullable=True)
    events = Column(JSON, default=list)

    created_at = Column("created_at", DateTime, default=lambda: datetime.now(timezone.utc))

    tutoring_session = relationship("TutoringSession", back_populates="lesson_steps")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True)
    tutoring_session_id = Column("tutoring_session_id", String, ForeignKey("tutoring_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    narration = Column(Text, nullable=True)
    audio_url = Column("audio_url", String, nullable=True)
    audio_duration = Column("audio_duration", Float, nullable=True)
    events = Column(JSON, default=list)

    created_at = Column("created_at", DateTime, default=lambda: datetime.now(timezone.utc))

    tutoring_session = relationship("TutoringSession", back_populates="chat_messages")


class ExamCram(Base):
    __tablename__ = "exam_crams"

    id = Column(String, primary_key=True)
    tutoring_session_id = Column("tutoring_session_id", String, ForeignKey("tutoring_sessions.id", ondelete="CASCADE"), nullable=False)
    subject = Column(String, nullable=False)
    exam_name = Column("exam_name", String, nullable=True)
    payload = Column(JSON, nullable=False)

    created_at = Column("created_at", DateTime, default=lambda: datetime.now(timezone.utc))

    tutoring_session = relationship("TutoringSession", back_populates="exam_crams")
