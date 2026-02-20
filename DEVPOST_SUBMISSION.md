# Devpost Submission Draft - Doceo

## Project name
Doceo - AI STEM Tutor

## Elevator pitch
Doceo turns any STEM problem into an interactive, step-by-step lesson with clear derivations, adaptive pacing, and realistic AI narration so students learn faster and retain more.

## Inspiration
Most AI tutors either output a wall of text or jump straight to answers. We wanted a product that actually teaches the way a tutor does: break down a problem, move through each transformation clearly, and let the student interrupt and ask questions in context.

## What it does
Doceo accepts a typed STEM problem or screenshot and generates a live interactive lesson. Students can follow derivations step-by-step, hear narration, ask follow-up questions mid-lesson, and revisit prior sessions from history. We also built an Exam Cram mode that generates focused study plans and practice prompts from uploaded materials.

## How we built it
- **Frontend**: Next.js + React + TypeScript + Framer Motion + KaTeX
- **Backend**: FastAPI + SSE streaming + Pydantic
- **Modeling**: Gemini for lesson generation, chat, and TTS
- **Product features**: lesson playback engine, interruption flow, cram plan generation, session history

## Challenges we ran into
- Keeping layout deterministic while still feeling interactive and smooth
- Preventing playback/audio drift across chunked narrated steps
- Making fallback outputs useful (material-grounded) instead of generic
- Integrating multiple feature branches cleanly without regressing lesson UX

## Accomplishments that we're proud of
- End-to-end interactive lesson flow from raw prompt/image to guided playback
- In-lesson interruption UX that keeps timeline context intact
- Gemini-only voice pipeline with improved playback continuity
- Exam Cram + History flows integrated into core product navigation
- Material-grounded cram fallback behavior (no canned generic outputs)

## What we learned
- UX quality is part of learning correctness, not just design polish
- Deterministic state/replay matters as much as model quality
- Voice + visual sync needs strict orchestration boundaries
- AI systems need strong normalization and fallback strategy to feel reliable

## What's next for Doceo
- Improve long-session sync and playback resilience even further
- Add richer revision workflows in History (filters, spaced review)
- Add stronger learning analytics and adaptive follow-up drills
- Expand mobile-first interaction quality for lesson playback

## Built with
- Next.js
- React
- TypeScript
- FastAPI
- Python
- Google Gemini API
- KaTeX
- Framer Motion

## Repo
https://github.com/athravseruwam07/doceo

## Demo video
(Add your demo URL here)

