"""ElevenLabs voice narration service."""

import asyncio
import hashlib
import os
from datetime import datetime, timedelta
from typing import Any

from elevenlabs.client import ElevenLabs

from app.config import settings


class VoiceService:
    """Service for generating and caching audio narrations."""

    def __init__(self):
        """Initialize ElevenLabs client."""
        self.client = ElevenLabs(api_key=settings.elevenlabs_api_key)
        self.cache_dir = "audio_cache"
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
            return {
                "audio_url": f"/audio/{os.path.basename(cache_path)}",
                "duration": duration,
                "cached": False,
            }
        except Exception as e:
            print(f"Error generating audio: {e}")
            return {
                "audio_url": None,
                "duration": 0,
                "error": str(e),
            }

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
