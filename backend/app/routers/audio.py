"""Audio serving endpoint."""

import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()


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

    return FileResponse(file_path, media_type="audio/mpeg")
