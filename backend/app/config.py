from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from .env file."""

    # Gemini API
    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"
    gemini_quality_model: str = "gemini-2.5-pro"
    gemini_quality_fallback_enabled: bool = True
    gemini_tts_model: str = "gemini-2.5-flash-preview-tts"
    gemini_tts_voice: str = "Kore"
    gemini_tts_style: str = "Speak naturally, warm and clear, like a helpful teacher."
    gemini_tts_sample_rate_hz: int = 24000

    # Voice provider (Gemini-only)
    voice_provider: str = "gemini"
    # Deprecated legacy env keys kept for backward-compatible env parsing.
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_voice_id: Optional[str] = None
    elevenlabs_model: Optional[str] = None

    # Database
    database_url: str = "postgresql+asyncpg://doceo:doceo@localhost:5432/doceo"

    # Auth
    nextauth_secret: str = ""

    # Application
    environment: str = "development"
    cors_origins: str = "http://localhost:3000"  # Store as string, convert to list in property

    # Optional: Rate limiting
    max_requests_per_minute: int = 10
    cache_audio_hours: int = 24

    # Gemini request control
    gemini_request_timeout_seconds: int = 120
    gemini_max_retries: int = 1
    gemini_retry_backoff_seconds: float = 1.5

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Get CORS origins as a list."""
        if isinstance(self.cors_origins, str):
            return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        return self.cors_origins


# Load settings once at module import
settings = Settings()
