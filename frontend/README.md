# Doceo Frontend

Next.js frontend for Doceo's interactive STEM lesson experience.

## Features in this app

- Interactive lesson player with live derivation stream
- Auto-scroll + manual scroll override with return-to-live control
- Quick Ask in-lesson interruption flow
- Exam Cram page
- History page for previous sessions
- Theme support (light/dark)

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WHITEBOARD_V2=true
```

## Quality checks

```bash
npm run lint
npm run build
```

