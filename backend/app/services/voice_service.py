"""ElevenLabs voice narration service."""

import asyncio
import hashlib
import logging
import os
from datetime import datetime, timedelta
from typing import Any

from elevenlabs.client import ElevenLabs

from app.config import settings

logger = logging.getLogger(__name__)


class VoiceService:
    """Service for generating and caching audio narrations."""

    def __init__(self):
        """Initialize ElevenLabs client."""
        self.client = ElevenLabs(api_key=settings.elevenlabs_api_key)
        self.cache_dir = "audio_cache"
        self._health_ttl_seconds = 180
        self._health_status = "unknown"
        self._health_detail: str | None = None
        self._health_checked_at: datetime | None = None
        self._ensure_cache_dir()

    def _ensure_cache_dir(self) -> None:
        """Ensure audio cache directory exists."""
        os.makedirs(self.cache_dir, exist_ok=True)

    def _get_cache_path(self, text: str, voice_id: str) -> str:
        """Get cache file path for given text and voice."""
        text_hash = hashlib.md5(text.encode()).hexdigest()
        filename = f"{voice_id}_{text_hash}.mp3"
        return os.path.join(self.cache_dir, filename)

    def _is_cache_valid(self, cache_path: str) -> bool:
        """Check if cached file exists and is not too old."""
        if not os.path.exists(cache_path):
            return False

        file_age = datetime.now() - datetime.fromtimestamp(os.path.getmtime(cache_path))
        max_age = timedelta(hours=settings.cache_audio_hours)
        return file_age < max_age

    async def generate_narration_audio(
        self, text: str, voice_id: str | None = None
    ) -> dict[str, Any]:
        """Generate narration audio for text.

        Args:
            text: Text to convert to speech
            voice_id: ElevenLabs voice ID (uses default if None)

        Returns:
            Dict with audio_url and duration
        """
        voice_id = voice_id or settings.elevenlabs_voice_id

        # Check cache first
        cache_path = self._get_cache_path(text, voice_id)
        if self._is_cache_valid(cache_path):
            duration = self._get_audio_duration(cache_path)
            return {
                "audio_url": f"/audio/{os.path.basename(cache_path)}",
                "duration": duration,
                "cached": True,
            }

        # Generate audio using ElevenLabs
        try:
            audio_data = await asyncio.to_thread(
                self._generate_audio_sync,
                text,
                voice_id,
            )

            # Save to cache
            with open(cache_path, "wb") as f:
                f.write(audio_data)

            duration = self._get_audio_duration(cache_path)
            self._set_health("ok", None)
            return {
                "audio_url": f"/audio/{os.path.basename(cache_path)}",
                "duration": duration,
                "cached": False,
            }
        except Exception as e:
            error_message = str(e)
            error_code = self._classify_error(error_message)
            friendly = self._friendly_error_message(error_code, error_message)
            self._set_health(error_code, friendly)
            logger.error("ElevenLabs TTS failed (%s): %s", error_code, friendly)
            return {
                "audio_url": None,
                "duration": 0,
                "error": friendly,
                "error_code": error_code,
            }

    def _set_health(self, status: str, detail: str | None) -> None:
        self._health_status = status
        self._health_detail = detail
        self._health_checked_at = datetime.now()

    def _health_is_fresh(self) -> bool:
        if not self._health_checked_at:
            return False
        age = (datetime.now() - self._health_checked_at).total_seconds()
        return age <= self._health_ttl_seconds

    def _probe_health_sync(self) -> tuple[str, str | None]:
        """Probe ElevenLabs auth + TTS capability."""
        try:
            # Validates key/workspace access.
            self.client.user.get()
        except Exception as exc:
            message = str(exc)
            code = self._classify_error(message)
            return code, self._friendly_error_message(code, message)

        try:
            # Small probe to validate text_to_speech permission.
            stream = self.client.text_to_speech.convert(
                voice_id=settings.elevenlabs_voice_id,
                text="Voice health check.",
                model_id=settings.elevenlabs_model,
            )
            for _chunk in stream:
                break
            return "ok", None
        except Exception as exc:
            message = str(exc)
            code = self._classify_error(message)
            return code, self._friendly_error_message(code, message)

    async def get_health(self, force: bool = False) -> dict[str, Any]:
        if not force:
            return {
                "status": self._health_status,
                "detail": self._health_detail,
                "checked_at": self._health_checked_at.isoformat() if self._health_checked_at else None,
            }

        status, detail = await asyncio.to_thread(self._probe_health_sync)
        self._set_health(status, detail)
        return {
            "status": status,
            "detail": detail,
            "checked_at": self._health_checked_at.isoformat() if self._health_checked_at else None,
        }

    @staticmethod
    def _classify_error(error_message: str) -> str:
        lowered = error_message.lower()
        if "missing_permissions" in lowered and "text_to_speech" in lowered:
            return "missing_tts_permission"
        if "status_code: 401" in lowered:
            return "unauthorized"
        if "status_code: 429" in lowered or "quota" in lowered:
            return "rate_limited"
        if "status_code: 400" in lowered:
            return "bad_request"
        return "unknown"

    @staticmethod
    def _friendly_error_message(error_code: str, raw_error: str) -> str:
        if error_code == "missing_tts_permission":
            return (
                "ElevenLabs API key does not have text_to_speech permission. "
                "Enable TTS permissions for this key in ElevenLabs dashboard."
            )
        if error_code == "unauthorized":
            return "ElevenLabs rejected the API key (401 unauthorized)."
        if error_code == "rate_limited":
            return "ElevenLabs rate limit hit. Try again shortly."
        if error_code == "bad_request":
            return "ElevenLabs rejected the TTS request payload."
        return raw_error

    def _generate_audio_sync(self, text: str, voice_id: str) -> bytes:
        """Synchronous wrapper for ElevenLabs audio generation."""
        audio_generator = self.client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id=settings.elevenlabs_model,
        )

        # Collect audio chunks
        audio_data = b""
        for chunk in audio_generator:
            if chunk:
                audio_data += chunk

        return audio_data

    def _get_audio_duration(self, file_path: str) -> float:
        """Estimate audio duration from file size (MP3).

        MP3 bitrate estimation: 128 kbps = 16 KB/s
        Duration (seconds) ≈ file_size / 16000
        """
        try:
            file_size = os.path.getsize(file_path)
            # Rough estimation: 128kbps MP3
            duration = file_size / 16000
            return max(duration, 0.5)  # Minimum 0.5 seconds
        except Exception:
            return 2.0  # Default fallback

    async def cleanup_old_cache(self) -> None:
        """Remove audio files older than cache_audio_hours."""
        if not os.path.exists(self.cache_dir):
            return

        now = datetime.now()
        max_age = timedelta(hours=settings.cache_audio_hours)

        for filename in os.listdir(self.cache_dir):
            file_path = os.path.join(self.cache_dir, filename)
            if not os.path.isfile(file_path):
                continue

            file_age = now - datetime.fromtimestamp(os.path.getmtime(file_path))
            if file_age > max_age:
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Error removing {file_path}: {e}")


# Global instance
_voice_service = None


def get_voice_service() -> VoiceService:
    """Get or create voice service instance."""
    global _voice_service
    if _voice_service is None:
        _voice_service = VoiceService()
    return _voice_service
