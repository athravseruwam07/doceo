"""Voice narration service (Gemini TTS only)."""

import asyncio
import base64
import hashlib
import io
import json
import logging
import os
import wave
from datetime import datetime, timedelta
from typing import Any, Tuple
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

from app.config import settings

logger = logging.getLogger(__name__)


class VoiceService:
    """Service for generating and caching audio narrations."""

    def __init__(self):
        self.provider = "gemini"
        self.cache_dir = "audio_cache"
        self._health_ttl_seconds = 180
        self._health_status = "unknown"
        self._health_detail: str | None = None
        self._health_checked_at: datetime | None = None
        self._ensure_cache_dir()

    def _ensure_cache_dir(self) -> None:
        os.makedirs(self.cache_dir, exist_ok=True)

    def _get_cache_path(self, text: str, voice_key: str, extension: str) -> str:
        text_hash = hashlib.md5(text.encode("utf-8")).hexdigest()
        filename = f"{voice_key}_{text_hash}.{extension}"
        return os.path.join(self.cache_dir, filename)

    def _is_cache_valid(self, cache_path: str) -> bool:
        if not os.path.exists(cache_path):
            return False

        file_age = datetime.now() - datetime.fromtimestamp(os.path.getmtime(cache_path))
        max_age = timedelta(hours=settings.cache_audio_hours)
        return file_age < max_age

    async def generate_narration_audio(
        self, text: str, voice_id: str | None = None
    ) -> dict[str, Any]:
        """Generate narration audio for text using configured provider."""
        if not text.strip():
            return {"audio_url": None, "duration": 0, "error_code": "bad_request"}
        _ = voice_id
        cache_key = f"gemini_{settings.gemini_tts_model}_{settings.gemini_tts_voice}"
        cache_path = self._get_cache_path(text, cache_key, "wav")

        if self._is_cache_valid(cache_path):
            duration = self._get_audio_duration(cache_path)
            return {
                "audio_url": f"/audio/{os.path.basename(cache_path)}",
                "duration": duration,
                "cached": True,
                "provider": self.provider,
            }

        try:
            audio_bytes = await asyncio.to_thread(self._generate_gemini_audio_sync, text)

            with open(cache_path, "wb") as audio_file:
                audio_file.write(audio_bytes)

            duration = self._get_audio_duration(cache_path)
            self._set_health("ok", None)
            return {
                "audio_url": f"/audio/{os.path.basename(cache_path)}",
                "duration": duration,
                "cached": False,
                "provider": self.provider,
            }
        except Exception as exc:  # pragma: no cover - exercised in integration behavior
            raw_error = str(exc)
            error_code = self._classify_error(raw_error)
            friendly = self._friendly_error_message(error_code, raw_error)
            self._set_health(error_code, friendly)
            logger.error("%s TTS failed (%s): %s", self.provider, error_code, friendly)
            return {
                "audio_url": None,
                "duration": 0,
                "error": friendly,
                "error_code": error_code,
                "provider": self.provider,
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

    async def get_health(self, force: bool = False) -> dict[str, Any]:
        if not force and self._health_is_fresh():
            return {
                "provider": self.provider,
                "status": self._health_status,
                "detail": self._health_detail,
                "checked_at": self._health_checked_at.isoformat() if self._health_checked_at else None,
            }

        status, detail = await asyncio.to_thread(self._probe_health_sync)
        self._set_health(status, detail)
        return {
            "provider": self.provider,
            "status": status,
            "detail": detail,
            "checked_at": self._health_checked_at.isoformat() if self._health_checked_at else None,
        }

    def _probe_health_sync(self) -> tuple[str, str | None]:
        return self._probe_gemini_health_sync()

    def _probe_gemini_health_sync(self) -> tuple[str, str | None]:
        if not settings.gemini_api_key:
            return "unauthorized", "GEMINI_API_KEY is missing."

        model_name = urllib_parse.quote(settings.gemini_tts_model, safe="")
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}"
            f"?key={urllib_parse.quote(settings.gemini_api_key, safe='')}"
        )
        request = urllib_request.Request(url=url, method="GET")
        try:
            with urllib_request.urlopen(request, timeout=settings.gemini_request_timeout_seconds) as response:
                if response.status >= 400:
                    body = response.read().decode("utf-8", errors="ignore")
                    code = self._classify_error(f"http_status:{response.status}; {body}")
                    return code, self._friendly_error_message(code, body)
            return "ok", None
        except urllib_error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            message = f"http_status:{exc.code}; {body}"
            code = self._classify_error(message)
            return code, self._friendly_error_message(code, message)
        except Exception as exc:  # pragma: no cover - defensive
            message = str(exc)
            code = self._classify_error(message)
            return code, self._friendly_error_message(code, message)

    def _generate_gemini_audio_sync(self, text: str) -> bytes:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is missing.")

        model_name = urllib_parse.quote(settings.gemini_tts_model, safe="")
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
            f"?key={urllib_parse.quote(settings.gemini_api_key, safe='')}"
        )

        prompt_text = (
            f"{settings.gemini_tts_style}\n\n"
            f"Narrate the following lesson text:\n{text}"
        )
        payload = {
            "contents": [{"parts": [{"text": prompt_text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {"voiceName": settings.gemini_tts_voice}
                    }
                },
            },
        }
        request_data = json.dumps(payload).encode("utf-8")
        request = urllib_request.Request(
            url=url,
            data=request_data,
            method="POST",
            headers={"Content-Type": "application/json"},
        )

        try:
            with urllib_request.urlopen(request, timeout=settings.gemini_request_timeout_seconds) as response:
                response_body = response.read()
        except urllib_error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"http_status:{exc.code}; {body}") from exc

        parsed = json.loads(response_body.decode("utf-8"))
        audio_b64, mime_type = self._extract_gemini_audio_part(parsed)
        raw_audio = base64.b64decode(audio_b64)

        if "wav" in mime_type.lower():
            return raw_audio
        return self._pcm_to_wav(raw_audio, settings.gemini_tts_sample_rate_hz)

    @staticmethod
    def _extract_gemini_audio_part(response: dict[str, Any]) -> Tuple[str, str]:
        candidates = response.get("candidates", [])
        for candidate in candidates:
            content = candidate.get("content", {})
            parts = content.get("parts", [])
            for part in parts:
                inline_data = part.get("inlineData") or part.get("inline_data")
                if not inline_data:
                    continue
                data = inline_data.get("data")
                if not data:
                    continue
                mime_type = inline_data.get("mimeType") or inline_data.get("mime_type") or "audio/L16"
                return data, mime_type
        raise RuntimeError("Gemini TTS returned no audio data.")

    @staticmethod
    def _pcm_to_wav(raw_pcm: bytes, sample_rate: int) -> bytes:
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(raw_pcm)
        return buffer.getvalue()

    def _classify_error(self, error_message: str) -> str:
        lowered = error_message.lower()

        if "missing_permissions" in lowered and "text_to_speech" in lowered:
            return "missing_tts_permission"
        if "http_status:401" in lowered or "http_status:403" in lowered:
            return "unauthorized"
        if "status_code: 401" in lowered:
            return "unauthorized"
        if "http_status:429" in lowered or "status_code: 429" in lowered or "quota" in lowered:
            return "rate_limited"
        if "http_status:400" in lowered or "status_code: 400" in lowered:
            return "bad_request"
        return "unknown"

    def _friendly_error_message(self, error_code: str, raw_error: str) -> str:
        provider_name = "Gemini"
        if error_code == "missing_tts_permission":
            return (
                f"{provider_name} key does not have text-to-speech permission for this project."
            )
        if error_code == "unauthorized":
            return f"{provider_name} rejected the current API key."
        if error_code == "rate_limited":
            return f"{provider_name} rate limit reached. Try again shortly."
        if error_code == "bad_request":
            return f"{provider_name} rejected the TTS request payload."
        return raw_error

    def _get_audio_duration(self, file_path: str) -> float:
        try:
            if file_path.endswith(".wav"):
                with wave.open(file_path, "rb") as wav_file:
                    frames = wav_file.getnframes()
                    rate = wav_file.getframerate()
                    if rate > 0:
                        return max(frames / float(rate), 0.5)
            file_size = os.path.getsize(file_path)
            duration = file_size / 16000
            return max(duration, 0.5)
        except Exception:
            return 2.0

    async def cleanup_old_cache(self) -> None:
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
                except Exception as exc:  # pragma: no cover - cleanup safety
                    logger.warning("Error removing %s: %s", file_path, exc)


# Global instance
_voice_service = None


def get_voice_service() -> VoiceService:
    """Get or create voice service instance."""
    global _voice_service
    if _voice_service is None:
        _voice_service = VoiceService()
    return _voice_service
