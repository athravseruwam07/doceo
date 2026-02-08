# Doceo - AI STEM Tutor

Doceo turns STEM problems into interactive, step-by-step lessons with synchronized narration, live derivation playback, quick interruptions, exam-cram planning, and session history.

## What Doceo does

- Converts typed prompts or uploaded screenshots into structured lessons
- Plays a guided derivation flow line-by-line (with live auto-scroll)
- Supports quick in-lesson questions without losing context
- Generates narration with **Gemini TTS** (single-provider voice path)
- Includes **Exam Cram** planning from user materials
- Saves **history** so users can revisit prior sessions

## Current stack

- Frontend: Next.js 16, React, TypeScript, Framer Motion, KaTeX
- Backend: FastAPI, Pydantic, SSE lesson streaming
- AI: Google Gemini (lesson generation + chat + TTS)

## Monorepo structure

- `frontend/` - app UI, lesson player, cram mode, history pages
- `backend/` - APIs, lesson orchestration, Gemini services, session storage

## Quick start

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`.

### 2) Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend runs at `http://localhost:3000`.

## Required environment variables

### `backend/.env`

Use `backend/.env.example` as source of truth. Minimum required:

```bash
GEMINI_API_KEY=your_key
VOICE_PROVIDER=gemini
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts
GEMINI_TTS_VOICE=Kore
CORS_ORIGINS=http://localhost:3000
```

### `frontend/.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WHITEBOARD_V2=true
```

`NEXT_PUBLIC_WHITEBOARD_V2=true` enables the current interactive lesson experience.

## Main user flows

1. Home -> submit text/image problem
2. Lesson player -> step playback + narration + quick ask
3. Exam Cram -> generate focused study plan from uploaded materials
4. History -> revisit prior lesson sessions

## API overview

- `POST /sessions` - create lesson session
- `GET /sessions/{session_id}` - session details
- `GET /sessions/{session_id}/lesson/stream` - SSE step stream
- `POST /sessions/{session_id}/chat` - in-lesson chat
- `GET /sessions` - list session history
- `POST /exam-cram/upload` - generate cram plan from notes/files

## Testing / validation

### Frontend

```bash
cd frontend
npm run lint
npm run build
```

### Backend

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest -q
```

## Hackathon notes

- Voice is Gemini-only in current implementation.
- Exam-cram fallback output is material-grounded (not canned generic text).
- UI has Home/Cram/History navigation and interactive lesson playback.

## License

MIT
