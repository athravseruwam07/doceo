export interface MathBlock {
  latex: string;
  display: boolean;
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
  // Granular teaching events from backend (overrides algorithmic timeline)
  events?: AnimationEvent[];
}

export interface LessonCompleteEvent {
  message: string;
  total_steps: number;
}

export interface SessionResponse {
  session_id: string;
  title: string;
  subject: string;
  step_count: number;
  status: string;
}

export interface ChatMessage {
  role: "user" | "tutor";
  message: string;
  math_blocks?: MathBlock[];
  related_step?: number;
  narration?: string;
  audio_url?: string;
  audio_duration?: number;
}

// ─── Animation Timeline Types ───

export type AnimationEventType =
  | "narrate"
  | "write_equation"
  | "write_text"
  | "annotate"
  | "clear_section"
  | "pause"
  | "step_marker";

export interface AnimationEvent {
  id: string;
  type: AnimationEventType;
  duration: number;
  payload: {
    text?: string;
    latex?: string;
    display?: boolean;
    position?: "top" | "center" | "bottom";
    annotationType?: "highlight" | "underline" | "circle" | "box";
    targetId?: string;
    stepNumber?: number;
    stepTitle?: string;
    // Voice fields (populated by backend for narrate events)
    audioUrl?: string;
    audioDuration?: number;
  };
}

export interface PlayerState {
  status: "loading" | "playing" | "paused" | "interrupted" | "complete";
  currentEventIndex: number;
  progress: number;
  speed: number;
  currentStep: number;
  totalSteps: number;
  voiceEnabled: boolean;
}
