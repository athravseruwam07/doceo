# Doceo

Interactive AI tutor that teaches STEM problems step-by-step on a whiteboard-style interface.

## Quick Start

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture

- **Frontend**: Next.js + TypeScript + Tailwind CSS + KaTeX + Framer Motion
- **Backend**: Python FastAPI with SSE streaming
- **AI**: Gemini API (mock responses included for development)

## Teammate Handoff

| Area | File(s) | Description |
|------|---------|-------------|
| Gemini Integration | `backend/app/services/ai_service.py` | Replace mock with real Gemini SDK calls |
| PDF Export | `backend/app/services/export_service.py` | Generate formatted PDF from session data |
| UI Features | `frontend/src/components/` | Dark mode, bookmarks, formula copy |
