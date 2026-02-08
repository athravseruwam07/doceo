"""Audio serving endpoint."""

import mimetypes
import os

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.services.voice_service import get_voice_service

router = APIRouter()


@router.get("/health")
async def voice_health(force: bool = Query(default=False)):
    """Return voice provider capability status."""
    service = get_voice_service()
    health = await service.get_health(force=force)
    return health


@router.get("/{filename}")
async def serve_audio(filename: str):
    """Serve cached audio files.

    Args:
        filename: Name of the audio file to serve

    Returns:
        FileResponse with audio file
    """
    # Security: only allow serving files from audio_cache directory
    file_path = os.path.join("audio_cache", filename)

    # Prevent directory traversal attacks
    if not os.path.abspath(file_path).startswith(os.path.abspath("audio_cache")):
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    media_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    return FileResponse(file_path, media_type=media_type)
