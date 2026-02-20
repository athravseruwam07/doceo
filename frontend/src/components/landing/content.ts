export type CapabilityIcon = "input" | "lesson" | "voice" | "chat" | "cram" | "history" | "theme";

export interface LandingCapability {
  id: string;
  label: string;
  teaser: string;
  detail: string;
  icon: CapabilityIcon;
}

export interface LandingStep {
  id: string;
  title: string;
  description: string;
  outcome: string;
}

export interface LandingFeaturePanel {
  id: string;
  title: string;
  description: string;
  bullets: string[];
  icon: CapabilityIcon;
}

export interface LandingFaq {
  id: string;
  question: string;
  answer: string;
}

export interface HeroSequenceItem {
  id: string;
  status: string;
  detail: string;
  transcript: string;
  boardTitle: string;
  boardLines: string[];
  focusLine: number;
  studentQuestion?: string;
  tutorReply?: string;
}

export const heroSequence: HeroSequenceItem[] = [
  {
    id: "received",
    status: "Problem received",
    detail: "Input accepted from screenshot. Doceo extracts the expression and builds a lesson plan.",
    transcript: "I parsed your prompt. We will derive this polynomial step by step using the power rule.",
    boardTitle: "Differentiate f(x) = x^3 + 2x^2 - 5x + 7",
    boardLines: [
      "Given: f(x) = x^3 + 2x^2 - 5x + 7",
      "Goal: find f'(x)",
      "Use linearity + power rule term by term",
    ],
    focusLine: 1,
  },
  {
    id: "step_one",
    status: "Rule application",
    detail: "Doceo writes each derivative line in order so students can track reasoning, not just final output.",
    transcript: "First term: derivative of x^3 is 3x^2. Next, derivative of 2x^2 is 4x.",
    boardTitle: "Apply d/dx[x^n] = n*x^(n-1)",
    boardLines: [
      "d/dx[x^3] = 3x^2",
      "d/dx[2x^2] = 4x",
      "d/dx[-5x] = -5",
      "d/dx[7] = 0",
    ],
    focusLine: 2,
  },
  {
    id: "voice",
    status: "Narration synced",
    detail: "Narration tracks the board events as each term is differentiated and simplified.",
    transcript: "Now combine each term. Keep 3x^2 and 4x, then include minus 5 and plus zero.",
    boardTitle: "Combine terms",
    boardLines: [
      "f'(x) = 3x^2 + 4x - 5 + 0",
      "f'(x) = 3x^2 + 4x - 5",
    ],
    focusLine: 1,
  },
  {
    id: "question",
    status: "Question interruption",
    detail: "Student asks a contextual question. Doceo answers and returns to the derivation flow.",
    transcript: "Great question. The derivative of any constant is zero because constants do not change with x.",
    boardTitle: "Final derivative",
    boardLines: [
      "f'(x) = 3x^2 + 4x - 5",
      "Check: constant term 7 disappears in derivative",
    ],
    focusLine: 0,
    studentQuestion: "Why does the +7 vanish in f'(x)?",
    tutorReply: "Because d/dx[c] = 0 for any constant c. It has zero rate of change with respect to x.",
  },
];

export const capabilities: LandingCapability[] = [
  {
    id: "input",
    label: "Text + Image Input",
    teaser: "Type a prompt or drop a screenshot.",
    detail:
      "Doceo accepts written questions and image-based problem statements to start lessons quickly.",
    icon: "input",
  },
  {
    id: "lesson",
    label: "Interactive Lesson Playback",
    teaser: "Step-by-step board choreography.",
    detail:
      "Each lesson is streamed as sequenced teaching events so students can watch reasoning build in order.",
    icon: "lesson",
  },
  {
    id: "voice",
    label: "Narration Sync",
    teaser: "Audio timed to board actions.",
    detail:
      "Narration is generated and attached to lesson events for a guided classroom-style rhythm.",
    icon: "voice",
  },
  {
    id: "chat",
    label: "Contextual Q&A",
    teaser: "Interrupt and ask in the moment.",
    detail:
      "Students can ask follow-up questions mid-lesson and get responses grounded in current step context.",
    icon: "chat",
  },
  {
    id: "cram",
    label: "Exam Cram Planner",
    teaser: "Upload notes and get priorities.",
    detail:
      "Exam Cram mode identifies recurring patterns, prioritized topics, focused lessons, and practice prompts.",
    icon: "cram",
  },
  {
    id: "history",
    label: "Session History",
    teaser: "Revisit and continue learning.",
    detail:
      "Saved sessions make it easy to reopen previous lessons and keep momentum between study blocks.",
    icon: "history",
  },
  {
    id: "theme",
    label: "Light and Dark Themes",
    teaser: "Readable in any study setup.",
    detail:
      "Landing and product surfaces support both light and dark themes for long study sessions.",
    icon: "theme",
  },
];

export const howItWorksSteps: LandingStep[] = [
  {
    id: "submit",
    title: "Submit the problem",
    description:
      "Type your question or paste a screenshot. Doceo parses the prompt and anchors the objective.",
    outcome: "Input is normalized into a structured lesson plan.",
  },
  {
    id: "build",
    title: "Generate the lesson",
    description:
      "Doceo scripts teaching events and whiteboard progression so reasoning unfolds one move at a time.",
    outcome: "You get an interactive, paced lesson stream.",
  },
  {
    id: "interrupt",
    title: "Interrupt to ask",
    description:
      "Pause and ask for clarification at any point. Responses stay grounded in your current step and context.",
    outcome: "Confusion gets resolved before it compounds.",
  },
  {
    id: "reinforce",
    title: "Reinforce and revisit",
    description:
      "Use Exam Cram and session history to drill likely topics and revisit earlier lessons later.",
    outcome: "Study stays focused and cumulative across sessions.",
  },
];

export const featurePanels: LandingFeaturePanel[] = [
  {
    id: "whiteboard",
    title: "Whiteboard Playback",
    description: "Visual steps are sequenced to reveal method, not just final output.",
    bullets: [
      "Event-based step rendering",
      "Readable equation pacing",
      "Live progression through each segment",
    ],
    icon: "lesson",
  },
  {
    id: "narration",
    title: "Narration Sync",
    description: "Voice events align with each instructional action on the board.",
    bullets: [
      "Generated narration per step",
      "Audio timing tied to events",
      "Playback aware of lesson speed",
    ],
    icon: "voice",
  },
  {
    id: "interruptions",
    title: "Quick Ask in Context",
    description: "Students can ask focused follow-ups without abandoning lesson flow.",
    bullets: [
      "In-lesson chat context",
      "Interruption micro-explanations",
      "Return-to-lesson continuity",
    ],
    icon: "chat",
  },
  {
    id: "exam-cram",
    title: "Exam Cram Planner",
    description: "Uploaded notes become targeted plans instead of generic summaries.",
    bullets: [
      "Recurring pattern detection",
      "Prioritized topic ranking",
      "Focused lesson and practice generation",
    ],
    icon: "cram",
  },
  {
    id: "history",
    title: "Session History",
    description: "Past sessions are easy to reopen when reviewing before exams.",
    bullets: [
      "Per-session metadata",
      "Progress status visibility",
      "Fast reopen from history",
    ],
    icon: "history",
  },
  {
    id: "theme-accessibility",
    title: "Theme and Accessibility",
    description: "Readable interfaces in light or dark mode with motion safety.",
    bullets: [
      "Persistent theme preference",
      "Reduced-motion support",
      "Keyboard-friendly interactive controls",
    ],
    icon: "theme",
  },
];

export const faqs: LandingFaq[] = [
  {
    id: "subjects",
    question: "What can I study with Doceo?",
    answer:
      "Doceo is tuned for STEM workflows like algebra, calculus, physics, chemistry, and statistics using step-by-step lesson generation.",
  },
  {
    id: "input-types",
    question: "Do I need to type everything manually?",
    answer:
      "No. You can type a problem, paste text, or upload an image screenshot of the question.",
  },
  {
    id: "voice",
    question: "Can I study with narration on?",
    answer:
      "Yes. Lessons support synced narration, and you can mute or enable voice based on your study environment.",
  },
  {
    id: "questions",
    question: "Can I ask questions while a lesson is running?",
    answer:
      "Yes. You can interrupt with contextual follow-up questions and then continue the lesson from where you paused.",
  },
  {
    id: "exam-cram",
    question: "How does Exam Cram help before tests?",
    answer:
      "Upload notes or past materials and Doceo generates prioritized topics, focused lessons, and practice questions to target likely exam areas.",
  },
];
