from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import sessions, lessons, chat, export, audio, voice

app = FastAPI(title="Doceo API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(lessons.router, prefix="/sessions", tags=["lessons"])
app.include_router(chat.router, prefix="/sessions", tags=["chat"])
app.include_router(export.router, prefix="/sessions", tags=["export"])
app.include_router(audio.router, prefix="/audio", tags=["audio"])
app.include_router(voice.router, prefix="/sessions", tags=["voice"])


@app.get("/health")
async def health():
    return {"status": "ok"}
