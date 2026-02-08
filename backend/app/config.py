from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    """Application settings loaded from .env file."""

    # Gemini API
    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"
    gemini_quality_model: str = "gemini-2.5-pro"
    gemini_quality_fallback_enabled: bool = True

    # ElevenLabs API
    elevenlabs_api_key: str
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_model: str = "eleven_multilingual_v2"

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
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Get CORS origins as a list."""
        if isinstance(self.cors_origins, str):
            return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        return self.cors_origins


# Load settings once at module import
settings = Settings()
