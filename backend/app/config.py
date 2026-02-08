import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Ensure backend/.env is loaded when running uvicorn from any directory.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_ROOT / ".env")


def _to_int(value: str | None, default: int) -> int:
    try:
        return int(value) if value is not None else default
    except Exception:
        return default


@dataclass(frozen=True)
class Settings:
    """Application settings loaded from backend/.env."""

    gemini_api_key: str
    gemini_model: str
    elevenlabs_api_key: str
    elevenlabs_voice_id: str
    elevenlabs_model: str
    environment: str
    cors_origins: str
    max_requests_per_minute: int
    cache_audio_hours: int

    @property
    def cors_origins_list(self) -> list[str]:
        if isinstance(self.cors_origins, str):
            return [
                origin.strip()
                for origin in self.cors_origins.split(",")
                if origin.strip()
            ]
        return []


def _load_settings() -> Settings:
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-pro"),
        elevenlabs_api_key=os.getenv("ELEVENLABS_API_KEY", ""),
        elevenlabs_voice_id=os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),
        elevenlabs_model=os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
        environment=os.getenv("ENVIRONMENT", "development"),
        cors_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000"),
        max_requests_per_minute=_to_int(os.getenv("MAX_REQUESTS_PER_MINUTE"), 10),
        cache_audio_hours=_to_int(os.getenv("CACHE_AUDIO_HOURS"), 24),
    )


settings = _load_settings()
