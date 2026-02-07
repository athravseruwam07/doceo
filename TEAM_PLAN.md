# Doceo Team Plan — 3 Person Sprint

## Why It Feels Like a Chatbot Right Now

The app currently works like this:
```
Backend generates 5 steps of text → Frontend displays them one by one with fake timing → Audio exists but plays independently
```

A real professor works like this:
```
Speaks "Let's look at this equation..." → WHILE writing it on the board → Pauses to let it sink in → Circles the key part → Continues speaking
```

**The core problems:**
1. **Audio and animation are completely disconnected** — two independent timers
2. **Backend sends text blobs, not teaching events** — no "write this, then pause, then circle that"
3. **All timing is fake** — `text.length * 35ms` instead of matching actual audio duration
4. **Chat is a sidebar afterthought** — questions don't connect back to the lesson
5. **No annotations** — a professor circles, underlines, points. We just reveal text.

---

## The Three Roles

### Person A — Backend: Animation Event Engine
**Branch:** `feature/animation-engine`
**Goal:** Make the backend think like a professor, not a textbook

### Person B — Frontend: Whiteboard + Voice Sync
**Branch:** `feature/whiteboard-voice-sync`
**Goal:** Make the whiteboard feel like watching someone teach live

### Person C — Frontend: UX, Chat Integration, Polish
**Branch:** `feature/ux-chat-polish`
**Goal:** Make everything feel seamless, polished, and interactive

---

## File Ownership (NO CONFLICTS)

### Person A OWNS (backend only)
```
backend/app/services/ai_service.py        ← Redesign Gemini prompts
backend/app/services/lesson_service.py     ← New streaming architecture
backend/app/schemas/lesson.py              ← New event schemas
backend/app/routers/lessons.py             ← Enhanced SSE stream
backend/app/mock/responses.py              ← Update mocks to match new format
backend/app/services/voice_service.py      ← Audio timing metadata
```

### Person B OWNS (player engine)
```
frontend/src/hooks/useAnimationPlayer.ts   ← Audio-driven timing engine
frontend/src/lib/timeline.ts               ← Consume new backend events
frontend/src/lib/audioPlayer.ts            ← Sync bridge
frontend/src/contexts/VoiceContext.tsx      ← Wire to player
frontend/src/hooks/useVoicePlayer.ts       ← Integration with animation
frontend/src/components/player/WhiteboardCanvas.tsx  ← Annotations, split view
frontend/src/components/player/AnimatedEquation.tsx  ← Audio-synced reveal
frontend/src/components/player/AnimatedText.tsx      ← Audio-synced typing
frontend/src/components/player/PlayerShell.tsx       ← Orchestration
```

### Person C OWNS (UX + chat)
```
frontend/src/components/chat/ChatSidebar.tsx    ← Contextual chat
frontend/src/components/chat/ChatMessage.tsx    ← Rich message display
frontend/src/components/chat/ChatInput.tsx      ← Input improvements
frontend/src/components/player/PlayerControls.tsx  ← Voice toggle, theme toggle
frontend/src/components/player/SidePanelWork.tsx   ← Animated chat responses
frontend/src/components/player/LessonSummary.tsx   ← Summary redesign
frontend/src/components/ui/LoadingOverlay.tsx       ← Generation loading UX
frontend/src/app/page.tsx                      ← Home page polish
frontend/src/app/lesson/[sessionId]/page.tsx   ← Lesson page integration
frontend/src/app/globals.css                   ← All styling
frontend/src/contexts/ThemeContext.tsx          ← Theme system
frontend/src/hooks/useTheme.ts                 ← Theme hook
frontend/src/hooks/useChat.ts                  ← Chat logic
backend/app/services/chat_service.py           ← Contextual responses
backend/app/routers/chat.py                    ← Chat endpoint
backend/app/schemas/chat.py                    ← Chat schema
```

### SHARED FILE (coordinate together)
```
frontend/src/lib/types.ts  ← All three must agree on interfaces
```

**Rule:** Person A defines the new types FIRST (day 1 morning). Person B and C consume them. Any changes to types.ts go through a quick group chat message.

---

## Shared Contract: types.ts

**All three people must agree on this before starting.** This is the interface between all roles.

```typescript
// === BACKEND → FRONTEND EVENT FORMAT ===

export type AnimationEventType =
  | "step_marker"     // New step beginning
  | "narrate"         // Professor speaking (has audio)
  | "write_equation"  // Write math on board
  | "write_text"      // Write explanation text
  | "annotate"        // Circle, underline, highlight something
  | "pause"           // Deliberate pause for comprehension
  | "clear_section"   // Erase part of board
  | "transition";     // Visual transition between sections

export interface AnimationEvent {
  id: string;
  type: AnimationEventType;
  duration: number;  // milliseconds — driven by audio duration when voice exists
  payload: {
    text?: string;
    latex?: string;
    display?: boolean;
    position?: "top" | "center" | "bottom" | "side";
    annotationType?: "highlight" | "underline" | "circle" | "box";
    targetId?: string;     // which previous event to annotate
    stepNumber?: number;
    stepTitle?: string;
    // Audio fields — Person A generates, Person B consumes
    audioUrl?: string;
    audioDuration?: number;  // actual audio length in seconds
  };
}

export interface LessonStep {
  step_number: number;
  title: string;
  content: string;
  math_blocks: MathBlock[];
  hint?: string;
  narration?: string;
  audio_url?: string;
  audio_duration?: number;
  // NEW: Person A adds these
  events?: AnimationEvent[];  // granular events for this step
}

export interface PlayerState {
  status: "loading" | "playing" | "paused" | "interrupted" | "complete";
  currentEventIndex: number;
  progress: number;
  speed: number;
  currentStep: number;
  totalSteps: number;
  voiceEnabled: boolean;
  // NEW: Person B adds
  currentAudioTime?: number;
  isAudioPlaying?: boolean;
}

export interface ChatMessage {
  role: "user" | "tutor";
  message: string;
  math_blocks?: MathBlock[];
  related_step?: number;     // which step this answer is about
  narration?: string;
  audio_url?: string;
  audio_duration?: number;
  // NEW: Person C adds
  events?: AnimationEvent[];  // animated response for side panel
}
```

---

## Person A — Backend: Animation Event Engine

### Branch: `feature/animation-engine`

### Problem You're Solving
The backend currently sends flat text steps. A professor doesn't dump a paragraph — they **speak while writing**, **pause**, **annotate**, **build up** equations piece by piece.

### Task 1: Redesign the Gemini Prompt
**File:** `backend/app/services/ai_service.py`

Current prompt asks for steps with content. New prompt must ask Gemini to think like a teacher:

```
For each step, provide a sequence of "teaching events" in order:
1. narrate: What you'd SAY aloud
2. write_equation: What you'd WRITE on the board (LaTeX)
3. write_text: Short text you'd write (not speak)
4. annotate: Circle/underline/highlight a previous equation
5. pause: A deliberate pause for the student to absorb

Example output for one step:
{
  "step_number": 1,
  "title": "Identify the equation type",
  "events": [
    {"type": "narrate", "text": "Let's start by looking at what kind of equation we have."},
    {"type": "write_equation", "latex": "x^2 - 5x + 6 = 0", "display": true},
    {"type": "narrate", "text": "This is a quadratic equation — see the x squared term?"},
    {"type": "annotate", "annotation_type": "circle", "target": "x^2"},
    {"type": "pause", "duration": 1.5},
    {"type": "narrate", "text": "We can solve this by factoring."}
  ]
}
```

### Task 2: Generate Audio + Attach Timing
**File:** `backend/app/services/lesson_service.py`

After Gemini returns events, for every `narrate` event:
1. Send narration text to ElevenLabs
2. Get back audio URL + actual duration
3. Set the event's `duration` to match the actual audio length
4. For non-narrate events (write_equation, annotate), set reasonable durations

```python
async def create_lesson(session_id: str) -> None:
    # 1. Get Gemini response with events
    result = await analyze_problem(problem_text=...)

    # 2. For each step, process events
    for step in result["steps"]:
        for event in step.get("events", []):
            if event["type"] == "narrate":
                audio = await voice_service.generate_narration_audio(event["text"])
                event["audio_url"] = audio["audio_url"]
                event["audio_duration"] = audio["duration"]
                event["duration"] = audio["duration"] * 1000  # ms
            elif event["type"] == "write_equation":
                event["duration"] = 2000  # 2 seconds to write
            elif event["type"] == "annotate":
                event["duration"] = 800
            elif event["type"] == "pause":
                event["duration"] = event.get("duration", 1.5) * 1000

    # 3. Store in session
    update_session(session_id, steps=result["steps"], ...)
```

### Task 3: Stream Events Granularly
**File:** `backend/app/routers/lessons.py`

Currently streams one step at a time with 2s delay. Change to stream individual events:

```python
async def stream_lesson_steps(session_id: str):
    # ... get session ...
    for step in steps:
        # Send step marker
        yield {"event": "step_marker", "data": json(step_number, title)}

        # Send each granular event
        for event in step.get("events", []):
            yield {"event": "animation_event", "data": json(event)}
            # Small delay so frontend can process
            await asyncio.sleep(0.05)

    yield {"event": "complete", "data": json(message, total_steps)}
```

### Task 4: Update Schemas
**File:** `backend/app/schemas/lesson.py`

Add schemas for the new event-based format.

### Deliverable
When Person A is done, the SSE stream should emit:
```
event: step_marker
data: {"step_number": 1, "title": "Identify the equation"}

event: animation_event
data: {"id": "ev1", "type": "narrate", "duration": 3200, "payload": {"text": "Let's start...", "audioUrl": "/audio/abc.mp3", "audioDuration": 3.2}}

event: animation_event
data: {"id": "ev2", "type": "write_equation", "duration": 2000, "payload": {"latex": "x^2 - 5x + 6 = 0", "display": true}}

event: animation_event
data: {"id": "ev3", "type": "annotate", "duration": 800, "payload": {"annotationType": "circle", "targetId": "ev2"}}

event: complete
data: {"message": "Lesson complete!", "total_steps": 5}
```

---

## Person B — Frontend: Whiteboard + Voice Sync

### Branch: `feature/whiteboard-voice-sync`

### Problem You're Solving
Animation and audio are two completely independent systems. When the professor says "look at this equation", the equation should be appearing ON the board at that moment, not 2 seconds later.

### Task 1: Audio-Driven Animation Engine
**File:** `frontend/src/hooks/useAnimationPlayer.ts`

The animation player currently uses `setTimeout` with estimated durations. Rewrite it so:
- When voice is ON: audio duration drives event timing
- When voice is OFF: use the event's `duration` field (which backend set from audio duration)
- Speed control applies to BOTH audio playback rate AND animation speed

```typescript
// Pseudocode for the new advance logic:
async function advanceToNextEvent() {
  const event = events[currentIndex];

  if (event.type === "narrate" && voiceEnabled && event.payload.audioUrl) {
    // Audio DRIVES the timing
    await audioPlayer.playSegment(event.id, event.payload.audioUrl);
    // Audio finished → move to next event
  } else {
    // Use duration from event (which was set from audio duration by backend)
    await wait(event.duration / speed);
  }

  currentIndex++;
  advanceToNextEvent();
}
```

### Task 2: Consume Backend Events Directly
**File:** `frontend/src/lib/timeline.ts`

Currently `stepsToTimeline()` generates fake events from step content. Two options:
- If backend sends `events[]` per step → use them directly
- If backend sends old format → keep current fallback logic

```typescript
export function stepsToTimeline(steps: LessonStep[]): AnimationEvent[] {
  const events: AnimationEvent[] = [];

  for (const step of steps) {
    if (step.events && step.events.length > 0) {
      // NEW: Backend sent granular events — use them directly
      events.push(...step.events);
    } else {
      // FALLBACK: Old format — generate events client-side (existing code)
      events.push(...generateEventsFromStep(step));
    }
  }

  return events;
}
```

### Task 3: Wire Voice to Animation
**File:** `frontend/src/hooks/useVoicePlayer.ts` + `frontend/src/lib/audioPlayer.ts`

Make the audio player a first-class part of the animation loop:
- Preload next 2-3 audio segments ahead
- When pausing animation → pause audio
- When resuming → resume audio from same position
- Speed change → update `audio.playbackRate`

### Task 4: Annotation Rendering
**File:** `frontend/src/components/player/WhiteboardCanvas.tsx`

Add visual annotations that a professor would make:
- `circle`: Draw a circle around a target equation/text
- `underline`: Underline part of an equation
- `highlight`: Yellow highlight on text
- Use CSS animations or SVG overlays

```tsx
// When rendering an annotate event:
if (event.type === "annotate" && event.payload.targetId) {
  const targetEl = document.getElementById(event.payload.targetId);
  // Render annotation overlay on target element
}
```

### Task 5: Sync PlayerShell Orchestration
**File:** `frontend/src/components/player/PlayerShell.tsx`

Wire together:
- Voice context → animation player
- Audio preloading on step receive
- M key for mute/unmute
- Pass `voiceEnabled` state down to controls

### Deliverable
When Person B is done:
- Voice narration plays IN SYNC with animations
- Equation appears on screen as professor says "write this down"
- Pausing stops both audio and animation at same point
- Speed control affects both proportionally
- Annotations (circle, underline) visually appear on the board

---

## Person C — Frontend: UX, Chat Integration, Polish

### Branch: `feature/ux-chat-polish`

### Problem You're Solving
The UI is functional but feels disconnected. Chat is an afterthought. Loading states are basic. The experience needs to feel cohesive and polished.

### Task 1: Loading Experience During AI Generation
**File:** `frontend/src/app/lesson/[sessionId]/page.tsx` + `frontend/src/components/ui/LoadingOverlay.tsx`

When Gemini + ElevenLabs generate (10-30 seconds), show a meaningful loading experience:
- Phase 1: "Analyzing your problem..." (0-5s)
- Phase 2: "Creating lesson plan..." (5-15s)
- Phase 3: "Generating voice narration..." (15-25s)
- Animated progress with skeleton content
- Don't just show a spinner — show anticipation

### Task 2: Contextual Chat Responses
**Files:** `frontend/src/hooks/useChat.ts` + `backend/app/services/chat_service.py`

When student asks a question during a lesson:
1. Send the current step number + event context with the question
2. Backend includes `related_step` in response
3. Frontend highlights which step the answer refers to
4. Show response in side panel with animated equations

Update chat_service.py to include step context:
```python
async def handle_message(session_id: str, message: str, current_step: int = None):
    # Include current step context in prompt to Gemini
    # So tutor knows EXACTLY what student is looking at
```

### Task 3: Side Panel for Question Responses
**File:** `frontend/src/components/player/SidePanelWork.tsx`

When the tutor responds to a question, don't just show text in chat. Show animated work in the side panel:
- Parse math_blocks from response
- Animate them appearing (reuse AnimatedEquation)
- Connect visually to the main board ("Your question about Step 2:")
- Narration plays for the response too

### Task 4: Polish PlayerControls
**File:** `frontend/src/components/player/PlayerControls.tsx`

- Wire the voice toggle to actual state (voiceEnabled from PlayerState)
- Add theme toggle to lesson view (not just home page)
- Glassmorphism style: `backdrop-blur-lg bg-white/80`
- Better progress bar with hover preview
- Keyboard shortcut hints on hover

### Task 5: Theme + Styling Polish
**File:** `frontend/src/app/globals.css` + component files

- Ensure dark mode works perfectly across ALL components
- Add subtle whiteboard grid lines
- Improve chat message styling (speech bubbles, timestamps)
- Add entrance animations for chat messages
- Smooth all transitions

### Task 6: Home Page Polish
**File:** `frontend/src/app/page.tsx`

- Better example problems shown
- Subject hints/tags
- Recent problems (if any in localStorage)
- Cleaner input area

### Deliverable
When Person C is done:
- Beautiful loading experience during AI generation
- Chat questions reference specific lesson steps
- Tutor answers appear with animated math in side panel
- All controls wired and functional
- Dark mode flawless everywhere
- Professional, cohesive visual experience

---

## Integration Order (CRITICAL)

### Day 1 Morning: Define Contract
All three meet for 15 minutes:
- Agree on types.ts interfaces (above)
- Person A commits updated types.ts to main
- Everyone pulls and branches from there

### During Development: Independent Work
- Person A works entirely in backend/
- Person B works in frontend player/hooks/lib
- Person C works in frontend chat/ui/app/css
- **No overlapping files**

### Merge Order:
```
1. Person A merges FIRST (backend changes)
   - New SSE format
   - Audio timing data
   - PR → review → merge to main

2. Person B merges SECOND (consumes A's events)
   - Rebase on main (gets A's changes)
   - Voice sync + animation engine
   - PR → review → merge to main

3. Person C merges LAST (consumes B's player state)
   - Rebase on main (gets A + B)
   - UX polish + chat integration
   - PR → review → merge to main
```

### If Someone Finishes Early:
- Help review PRs
- Write tests
- Work on stretch goals (below)

---

## Stretch Goals (If Time Permits)

### Person A Stretch:
- Image problem analysis (Gemini multimodal) with better prompts
- Generate "recap" events at end of lesson
- Rate limiting / cost tracking

### Person B Stretch:
- Smooth handwriting-style equation reveal (SVG path animation)
- Whiteboard "eraser" animation for clear_section events
- Audio waveform visualizer during narration

### Person C Stretch:
- Speech-to-text for voice questions (Web Speech API)
- Lesson bookmarking / progress saving to localStorage
- Share lesson URL
- PDF export of completed lesson

---

## Quick Reference: Who Touches What

| File | A | B | C |
|------|---|---|---|
| `backend/app/services/ai_service.py` | ✏️ | | |
| `backend/app/services/lesson_service.py` | ✏️ | | |
| `backend/app/services/voice_service.py` | ✏️ | | |
| `backend/app/schemas/lesson.py` | ✏️ | | |
| `backend/app/routers/lessons.py` | ✏️ | | |
| `backend/app/mock/responses.py` | ✏️ | | |
| `backend/app/services/chat_service.py` | | | ✏️ |
| `backend/app/routers/chat.py` | | | ✏️ |
| `backend/app/schemas/chat.py` | | | ✏️ |
| `frontend/src/lib/types.ts` | 📝 | 👀 | 👀 |
| `frontend/src/hooks/useAnimationPlayer.ts` | | ✏️ | |
| `frontend/src/lib/timeline.ts` | | ✏️ | |
| `frontend/src/lib/audioPlayer.ts` | | ✏️ | |
| `frontend/src/contexts/VoiceContext.tsx` | | ✏️ | |
| `frontend/src/hooks/useVoicePlayer.ts` | | ✏️ | |
| `frontend/src/components/player/WhiteboardCanvas.tsx` | | ✏️ | |
| `frontend/src/components/player/AnimatedEquation.tsx` | | ✏️ | |
| `frontend/src/components/player/AnimatedText.tsx` | | ✏️ | |
| `frontend/src/components/player/PlayerShell.tsx` | | ✏️ | |
| `frontend/src/components/chat/*` | | | ✏️ |
| `frontend/src/components/player/PlayerControls.tsx` | | | ✏️ |
| `frontend/src/components/player/SidePanelWork.tsx` | | | ✏️ |
| `frontend/src/components/player/LessonSummary.tsx` | | | ✏️ |
| `frontend/src/components/ui/LoadingOverlay.tsx` | | | ✏️ |
| `frontend/src/app/page.tsx` | | | ✏️ |
| `frontend/src/app/lesson/[sessionId]/page.tsx` | | | ✏️ |
| `frontend/src/app/globals.css` | | | ✏️ |
| `frontend/src/contexts/ThemeContext.tsx` | | | ✏️ |
| `frontend/src/hooks/useTheme.ts` | | | ✏️ |
| `frontend/src/hooks/useChat.ts` | | | ✏️ |

✏️ = owns and edits | 📝 = defines first | 👀 = reads, does not edit

---

## Testing the Integration

After all three merge:

1. Type: "Solve x² + 3x - 10 = 0"
2. See loading overlay with phases
3. Lesson starts — professor voice says "Let's look at this equation"
4. WHILE speaking, the equation appears on the board
5. Voice pauses — professor circles the x² term
6. Voice says "This is quadratic because of the squared term"
7. Press Space — both audio and animation pause together
8. Change speed to 1.5x — both speed up proportionally
9. Click "Ask a question" — lesson pauses
10. Type "Why do we factor?"
11. Side panel shows animated explanation with voice
12. Click Continue — main lesson resumes exactly where it left off
13. Lesson completes — summary shows key equations
14. Toggle dark mode — everything looks perfect

**THAT is what a professor feels like. Not a chatbot.**
