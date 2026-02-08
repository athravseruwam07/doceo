# Doceo — AI-Powered STEM Tutoring

Interactive AI tutor that teaches STEM problems step-by-step on an animated whiteboard with voice narration and real-time interaction.

## Features

✨ **Real-time AI Lesson Generation**: Uses Google Gemini API to analyze any math/science problem and create custom step-by-step lessons
🎙️ **Voice Narration**: Gemini text-to-speech synced with whiteboard animations
🖊️ **Interactive Whiteboard**: Animated equations and annotations reveal naturally
💬 **Ask Questions Mid-Lesson**: Interrupt the tutor, ask clarifying questions, and get instant contextual answers
🌓 **Light/Dark Theme**: Beautiful theme system with dark mode support
📱 **Responsive Design**: Works on desktop, tablet, and mobile
⚡ **Fast Generation**: Lessons generated in 10-30 seconds

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Google Gemini API key ([get one here](https://ai.google.dev))

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your API keys
cp .env.example .env
# Edit .env and add:
# GEMINI_API_KEY=your_key_here

# Start server
uvicorn app.main:app --reload
```

The backend will be available at `http://localhost:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local if not present
cp .env.example .env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

### Backend Environment Variables

Create `backend/.env` based on `backend/.env.example`:

```bash
# Required: Google Gemini API
GEMINI_API_KEY=sk-xxxxxxxxxxxxx
GEMINI_MODEL=gemini-1.5-pro  # or gemini-1.5-flash for faster responses

# Application
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:3000

# Optional: Rate limiting
MAX_REQUESTS_PER_MINUTE=10
CACHE_AUDIO_HOURS=24
```

### Frontend Environment Variables

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
# For production: NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

## Architecture

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS + KaTeX + Framer Motion
- **Backend**: Python FastAPI with SSE streaming
- **AI**: Google Gemini 1.5 Pro for lesson generation and tutoring
- **Voice**: Gemini tts for realistic text-to-speech

## Key Files

### Backend

| File | Purpose |
|------|---------|
| `app/services/ai_service.py` | Gemini API integration for lesson generation and chat |
| `app/services/voice_service.py` | Gemini TTS integration for audio generation and caching |
| `app/services/lesson_service.py` | Lesson streaming and voice integration |
| `app/routers/audio.py` | Audio file serving endpoint |
| `app/config.py` | Environment configuration with pydantic-settings |

### Frontend

| File | Purpose |
|------|---------|
| `src/contexts/ThemeContext.tsx` | Light/dark mode theme management |
| `src/contexts/VoiceContext.tsx` | Global voice state and audio player |
| `src/hooks/useVoicePlayer.ts` | Hook for voice playback control |
| `src/lib/audioPlayer.ts` | Audio synchronization utility class |
| `src/components/player/` | Whiteboard, controls, animations |
| `src/components/ui/LoadingOverlay.tsx` | AI generation loading states |

## API Reference

### Create Lesson Session

**POST** `/sessions`

```json
{
  "problem_text": "Find the derivative of f(x) = 3x^2 - 2x + 1",
  "subject_hint": "Calculus"
}
```

Response:
```json
{
  "session_id": "abc123",
  "title": "Derivatives: Power Rule",
  "subject": "Calculus"
}
```

### Stream Lesson Steps

**GET** `/sessions/{session_id}/lesson/stream`

Server-Sent Events stream of lesson steps with audio URLs:

```json
{
  "event": "step",
  "data": {
    "step_number": 1,
    "title": "Recall the power rule",
    "content": "The power rule states that...",
    "narration": "Let's recall the power rule...",
    "audio_url": "/audio/voice_abc123.mp3",
    "audio_duration": 5.2,
    "math_blocks": [...]
  }
}
```

### Send Chat Message

**POST** `/sessions/{session_id}/chat`

```json
{
  "message": "Why does the power rule work this way?"
}
```

Response:
```json
{
  "role": "tutor",
  "message": "Great question! The power rule works because...",
  "narration": "Great question! The power rule works because...",
  "audio_url": "/audio/response_def456.mp3",
  "audio_duration": 8.3,
  "math_blocks": [...]
}
```

## Development

### Adding New AI Prompts

Edit `backend/app/services/ai_service.py`:

- Modify `_build_lesson_generation_prompt()` to change lesson generation
- Modify `_build_chat_prompt()` to change tutor response style

### Theme Customization

Edit `frontend/src/app/globals.css`:

- Update CSS variables in `:root` for light mode
- Update CSS variables in `[data-theme="dark"]` for dark mode

## Performance

- **Lesson Generation**: 10-30 seconds (Gemini API)
- **Audio Generation**: 1-5 seconds per step (Gemini TTS)
- **Page Load**: < 2 seconds (Next.js optimization)
- **Animation**: 60 FPS (Framer Motion)

## Known Limitations

- Audio cache stored on disk (no automatic cleanup yet)
- Session data in-memory (lost on server restart) — migrate to Redis/PostgreSQL for production
- Single voice model (configurable but not switchable in UI)
- Rate limiting not enforced (add guard in production)

## Future Enhancements

- [ ] Speech-to-text for voice questions
- [ ] Multiple voice options in UI
- [ ] Collaborative lessons (WebRTC)
- [ ] Progress tracking and lesson history
- [ ] PDF export with full lesson content
- [ ] Adaptive difficulty based on student questions
- [ ] Multi-language support
- [ ] Interactive quizzes during lessons
- [ ] Offline support with service workers

## Troubleshooting

### Audio not playing
1. Check browser allows audio autoplay (some require user interaction first)
2. Check network tab for audio file requests
3. Try toggling voice off/on

### Lesson generation timeout
1. Check GEMINI_API_KEY is valid
2. Ensure problem description is clear (try shorter/simpler problems)
3. Check rate limits haven't been exceeded
4. Network latency — try again

### Theme not persisting
1. Check browser localStorage is enabled
2. Check for errors in browser console
3. Try clearing browser cache

## License

MIT

## Support

For issues or questions, open an issue on GitHub or contact the development team.
