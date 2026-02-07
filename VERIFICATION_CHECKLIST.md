# Doceo Implementation Verification Checklist

Use this checklist to verify all features are working correctly.

## Prerequisites ✅
- [ ] Python 3.11+ installed
- [ ] Node.js 18+ installed
- [ ] Gemini API key obtained and added to `.env`
- [ ] ElevenLabs API key obtained and added to `.env`
- [ ] Backend dependencies installed (`pip install -r requirements.txt`)
- [ ] Frontend dependencies installed (`npm install`)

## Backend Verification

### Configuration
- [ ] `.env` file exists in `backend/` with API keys
- [ ] `.env` file is in `.gitignore`
- [ ] `backend/app/config.py` exists and loads environment variables
- [ ] `CORS_ORIGINS` includes `http://localhost:3000`

### AI Integration
- [ ] Backend starts without errors: `uvicorn app.main:app --reload`
- [ ] Health check works: `curl http://localhost:8000/health`
- [ ] `/audio` router registered and working

### Gemini Integration
- [ ] `backend/app/services/ai_service.py` has real Gemini API calls
- [ ] Test lesson generation:
  ```bash
  curl -X POST http://localhost:8000/sessions \
    -H "Content-Type: application/json" \
    -d '{"problem_text":"Find the derivative of x^2"}'
  ```
- [ ] Response includes `session_id`, `title`, `subject`
- [ ] No "TODO" comments left in ai_service.py

### Voice Integration
- [ ] `backend/app/services/voice_service.py` exists
- [ ] ElevenLabs client initializes without errors
- [ ] Audio files generated in `audio_cache/` directory
- [ ] Test audio serving:
  ```bash
  ls audio_cache/
  # Should see .mp3 files
  curl http://localhost:8000/audio/filename.mp3 -o test.mp3
  ```

### Lesson Streaming
- [ ] Lesson steps include `audio_url` and `audio_duration`
- [ ] Test SSE stream:
  ```bash
  curl http://localhost:8000/sessions/SESSION_ID/lesson/stream
  # Should stream JSON events with audio data
  ```

### Chat Integration
- [ ] Chat endpoint returns responses with `audio_url`
- [ ] Test chat:
  ```bash
  curl -X POST http://localhost:8000/sessions/SESSION_ID/chat \
    -H "Content-Type: application/json" \
    -d '{"message":"Why does this work?"}'
  ```

## Frontend Verification

### Environment
- [ ] `.env.local` file exists with `NEXT_PUBLIC_API_URL=http://localhost:8000`
- [ ] `.env.local` is in `.gitignore`
- [ ] Frontend starts without errors: `npm run dev`
- [ ] No console errors on page load

### Theme System
- [ ] Theme toggle button appears (sun/moon icon top-right)
- [ ] Clicking toggle switches between light and dark mode
- [ ] Theme preference persists on page reload
- [ ] Dark mode colors are legible (good contrast)
- [ ] All components respect theme colors

### Voice System
- [ ] Voice toggle button appears in player controls (speaker icon)
- [ ] VoiceContext initialized without errors
- [ ] Audio player utility loads without errors
- [ ] Voice preference saves to localStorage

### Lesson Player
- [ ] Create a session with test problem
- [ ] Wait for lesson to generate (show loading overlay)
- [ ] Lesson appears on whiteboard
- [ ] Step animations play smoothly

### Voice Playback
- [ ] Audio preloads during lesson generation
- [ ] Audio plays when step animations play
- [ ] Audio pauses when animation pauses
- [ ] Audio resumes when animation resumes
- [ ] Pressing Space pauses/resumes both audio and animation

### Speed Control
- [ ] Speed buttons (0.5x, 1x, 1.5x, 2x) appear and work
- [ ] Changing speed affects both animation and audio
- [ ] Speed changes apply immediately
- [ ] Audio pitch increases with speed (expected behavior)

### Chat Functionality
- [ ] "Ask a question" button appears
- [ ] Clicking opens chat sidebar (desktop) or overlay (mobile)
- [ ] Can type and submit questions
- [ ] Tutor responds with context from lesson
- [ ] Response plays with audio narration
- [ ] Close chat and continue lesson works

### UI Polish
- [ ] Loading overlay shows during AI generation
- [ ] Progress bar animates during loading
- [ ] Helpful message: "This usually takes 10-30 seconds"
- [ ] All text colors visible in both themes
- [ ] Smooth transitions when opening/closing chat
- [ ] No layout shifts or jank

## End-to-End Test

### Complete Flow Test
1. [ ] Navigate to http://localhost:3000
2. [ ] See home page with input options
3. [ ] Type a problem: "Solve x^2 - 5x + 6 = 0"
4. [ ] Click "Start lesson"
5. [ ] See loading overlay (10-30 seconds)
6. [ ] Lesson title and problem appear
7. [ ] First step animates onto whiteboard
8. [ ] Audio narration plays automatically
9. [ ] Step indicator shows "Step 1 of N"
10. [ ] Animation and audio stay in sync

### Playback Control Test
- [ ] Press Space → animation pauses, audio pauses
- [ ] Press Space again → both resume
- [ ] Click speed buttons → both speed up/down
- [ ] Click voice toggle (mute) → audio stops, animation continues
- [ ] Click voice toggle (unmute) → audio plays again from current point

### Question Interruption Test
- [ ] Click "Ask a question" mid-lesson
- [ ] Chat sidebar opens with history
- [ ] Type question: "Why does the quadratic formula work?"
- [ ] Submit question
- [ ] Loading indicator shows
- [ ] Tutor response appears with audio
- [ ] Click "Continue lesson"
- [ ] Lesson resumes from where it paused

### Theme Test
- [ ] Click theme toggle (moon icon)
- [ ] All colors change to dark mode
- [ ] Text is still legible
- [ ] Emerald accent still visible
- [ ] Shadows adjusted appropriately
- [ ] Reload page → dark mode persists
- [ ] Click again → back to light mode

### Error Handling
- [ ] Try very long problem text → handles gracefully
- [ ] Test with invalid Gemini key → shows error, uses mock data
- [ ] Test with network offline → shows error message
- [ ] Try refreshing during audio playback → no crashes

## Mobile Testing

- [ ] Open on phone/tablet at http://localhost:3000
- [ ] Interface adapts to smaller screen
- [ ] Theme toggle still accessible
- [ ] Voice toggle still accessible
- [ ] Chat opens as overlay (not sidebar)
- [ ] All buttons easily tappable (touch targets ≥ 44px)
- [ ] Whiteboard readable on small screen

## Performance Checks

- [ ] Lesson generation: 10-30 seconds (reasonable wait)
- [ ] Audio preloading: No lag before playback
- [ ] Theme toggle: Instant (no lag)
- [ ] Animations: Smooth 60 FPS
- [ ] No memory leaks in browser (DevTools Memory tab)
- [ ] Bundle size reasonable (< 500KB main JS)

## Code Quality

### Backend
- [ ] No "TODO" comments in ai_service.py
- [ ] No print statements (use logging)
- [ ] Error messages helpful and logged
- [ ] Config properly validated
- [ ] No hardcoded API keys in code
- [ ] audio_cache/.gitignore to prevent tracking

### Frontend
- [ ] No console errors or warnings
- [ ] TypeScript strict mode (no `any` types)
- [ ] Components properly memoized where needed
- [ ] No infinite loops in useEffect
- [ ] Proper cleanup in useEffect (return cleanup function)

## Documentation

- [ ] README.md complete with setup instructions
- [ ] README.md includes troubleshooting section
- [ ] API reference section complete
- [ ] Environment variables documented
- [ ] IMPLEMENTATION_SUMMARY.md written
- [ ] SETUP_GUIDE.md written
- [ ] Comments in complex functions

## Git & Version Control

- [ ] All changes committed to git
- [ ] Commit messages are clear and descriptive
- [ ] `.env` files in `.gitignore`
- [ ] `audio_cache/` in `.gitignore`
- [ ] `node_modules/` in `.gitignore`
- [ ] `__pycache__/` in `.gitignore`
- [ ] No large files committed

## Deployment Readiness

### Configuration
- [ ] `.env.example` template complete
- [ ] No secrets in version control
- [ ] CORS properly configured
- [ ] Frontend API URL configurable

### Error Handling
- [ ] Graceful fallback if Gemini fails (uses mock data)
- [ ] Graceful fallback if ElevenLabs fails (continues without audio)
- [ ] User-friendly error messages
- [ ] No stack traces shown to users

### Security
- [ ] API keys not exposed in frontend code
- [ ] Audio endpoint validates file paths (no directory traversal)
- [ ] CORS whitelist prevents unauthorized requests
- [ ] No XSS vulnerabilities in dynamic content rendering

## Sign-Off

### Final Verification
- [ ] All checks above passed ✅
- [ ] Lesson generation works with real Gemini ✅
- [ ] Voice narration plays and syncs ✅
- [ ] Theme system working ✅
- [ ] Chat with context working ✅
- [ ] No errors in console ✅
- [ ] No errors in backend logs ✅

### Ready for Production?
- [ ] All critical features working
- [ ] Error handling in place
- [ ] Documentation complete
- [ ] Performance acceptable
- [ ] Ready to add API keys and deploy

---

## Test Problems to Try

Use these problems to verify functionality:

### Easy (Algebra)
- "Solve x + 3 = 7"
- "What is 2x - 5 = 11?"
- "Expand (x + 2)(x + 3)"

### Medium (Calculus/Algebra)
- "Find the derivative of f(x) = 3x^2 - 2x + 1"
- "Integrate x^3 dx"
- "Solve x^2 - 5x + 6 = 0 using the quadratic formula"

### Hard (Physics/Chemistry)
- "Calculate the force needed to accelerate a 50kg object at 2 m/s^2"
- "Balance the equation: C6H12O6 + O2 → CO2 + H2O"

### With Images
- Upload a photo of a handwritten math problem
- Add optional text description

## Notes

- First lesson generation may be slower (API warmup)
- Audio caching speeds up subsequent lessons
- Dark mode colors tested against WCAG AA contrast standards
- All keyboard shortcuts working: Space (pause), Escape (close chat)

---

Good luck! Mark boxes as you go. Should take ~30 minutes total. 🚀
