# Doceo Setup Guide — 5 Minutes to Running

## Prerequisites

- Python 3.11+ installed
- Node.js 18+ installed
- 2 API keys: Gemini + ElevenLabs

## Step 1: Get API Keys (2 minutes)

### Google Gemini API Key
1. Go to https://ai.google.dev
2. Click "Get API Key"
3. Create new project
4. Enable Generative AI API
5. Create API key
6. Copy the key

### ElevenLabs API Key
1. Go to https://elevenlabs.io
2. Sign up / login
3. Go to Account Settings
4. Copy API Key
5. Copy a Voice ID (default: `21m00Tcm4TlvDq8ikWAM`)

## Step 2: Setup Backend (2 minutes)

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate
# On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

Edit `backend/.env` and add your API keys:
```bash
GEMINI_API_KEY=your_gemini_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

Start backend:
```bash
uvicorn app.main:app --reload
```

✅ Backend running at http://localhost:8000

## Step 3: Setup Frontend (1 minute)

In a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Create env if needed
cp .env.example .env.local

# Start dev server
npm run dev
```

✅ Frontend running at http://localhost:3000

## Step 4: Add Course Notes (Optional, 1 minute)

1. Open http://localhost:3000
2. In **Course Notes Library**, create a course label (for example `Math` or `Science`)
3. Select the course from the dropdown
4. Upload your notes/syllabus file (`.txt`, `.md`, `.pdf`, `.docx`)
5. Start a lesson with that course selected to prioritize your uploaded notes

## Step 5: Test It Out!

1. Open http://localhost:3000
2. Type a problem: `"Find the derivative of f(x) = x^2 + 3x + 1"`
3. Click "Start lesson"
4. **Wait 10-30 seconds** (Gemini + ElevenLabs generating)
5. See lesson appear with voice narration!

## Troubleshooting

### Backend won't start
```
Error: "ModuleNotFoundError: No module named 'google'"
```
→ Make sure you ran `pip install -r requirements.txt`

### No audio playing
→ Check your ELEVENLABS_API_KEY is correct
→ Check browser console for errors
→ Try toggling voice button off/on

### Lesson generation times out
→ Check GEMINI_API_KEY is correct
→ Try a shorter problem description
→ Wait a bit longer (first call can be slow)

### CORS error when fetching API
→ Make sure backend is running on port 8000
→ Check NEXT_PUBLIC_API_URL=http://localhost:8000 in .env.local

### Port already in use
```bash
# Backend (8000):
lsof -i :8000
kill -9 <PID>

# Frontend (3000):
lsof -i :3000
kill -9 <PID>
```

## Features to Try

✅ **Theme Toggle** - Click sun/moon icon top right
✅ **Voice Toggle** - Click speaker icon in controls
✅ **Speed Control** - Change playback speed (0.5x - 2x)
✅ **Ask Question** - Click "Ask a question" during lesson
✅ **Pause/Resume** - Press Space bar
✅ **Dark Mode** - Toggle theme to see dark mode

## Next Steps

1. Customize the tutor voice - change `ELEVENLABS_VOICE_ID`
2. Adjust lesson generation - edit prompts in `backend/app/services/ai_service.py`
3. Customize colors - edit `frontend/src/app/globals.css`
4. Deploy to production - update API URLs and domains

## Need Help?

- Check `README.md` for full documentation
- Check `IMPLEMENTATION_SUMMARY.md` for technical details
- Check backend logs: `uvicorn app.main:app --reload` output
- Check frontend logs: Browser DevTools Console

Enjoy! 🎓✨
