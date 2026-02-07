from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import sessions, lessons, chat, export

app = FastAPI(title="Doceo API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(lessons.router, prefix="/sessions", tags=["lessons"])
app.include_router(chat.router, prefix="/sessions", tags=["chat"])
app.include_router(export.router, prefix="/sessions", tags=["export"])


@app.get("/health")
async def health():
    return {"status": "ok"}
