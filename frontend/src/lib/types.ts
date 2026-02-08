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
  events?: AnimationEvent[];
  created_at?: string;
}

export interface ChatContextPayload {
  currentStep?: number;
  currentStepTitle?: string;
  currentEventType?: AnimationEventType;
  activeNarration?: string;
}

// ─── Animation Timeline Types ───

export type AnimationEventType =
  | "step_marker"
  | "narrate"
  | "write_equation"
  | "write_text"
  | "annotate"
  | "clear_section"
  | "pause"
  | "transition";

export interface AnimationEvent {
  id: string;
  type: AnimationEventType;
  duration: number;
  payload: {
    text?: string;
    latex?: string;
    display?: boolean;
    position?: "top" | "center" | "bottom" | "side";
    annotationType?: "highlight" | "underline" | "circle" | "box";
    targetId?: string;
    stepNumber?: number;
    stepTitle?: string;
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
