from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import sessions, lessons, chat, export, audio, courses

app = FastAPI(title="Doceo API", version="0.1.0")

development_origin_regex = (
    r"^https?://("
    r"localhost|127\.0\.0\.1|0\.0\.0\.0|"
    r"10\.\d+\.\d+\.\d+|"
    r"172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|"
    r"192\.168\.\d+\.\d+"
    r")(:\d+)?$"
)
allow_origin_regex = (
    development_origin_regex if settings.environment.lower() == "development" else None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(lessons.router, prefix="/sessions", tags=["lessons"])
app.include_router(chat.router, prefix="/sessions", tags=["chat"])
app.include_router(export.router, prefix="/sessions", tags=["export"])
app.include_router(audio.router, prefix="/audio", tags=["audio"])
app.include_router(courses.router, prefix="/courses", tags=["courses"])


@app.get("/health")
async def health():
    return {"status": "ok"}
