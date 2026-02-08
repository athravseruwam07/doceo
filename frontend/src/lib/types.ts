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
  created_at?: string;
  course_id?: string;
  course_label?: string;
  confusion_score?: number;
  confusion_level?: "low" | "medium" | "high";
  adaptation_mode?: string;
  lesson_type?: "full" | "micro";
  include_voice?: boolean;
}

export interface CourseSummary {
  course_id: string;
  label: string;
  created_at: string;
  material_count: number;
}

export interface CourseMaterial {
  material_id: string;
  filename: string;
  content_type: string;
  uploaded_at: string;
  char_count: number;
  chunk_count: number;
  preview: string;
}

export interface CourseLesson {
  session_id: string;
  title: string;
  subject: string;
  status: string;
  step_count: number;
  lesson_type?: "full" | "micro";
  created_at: string;
  problem_preview: string;
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
  confusion_score?: number;
  confusion_level?: "low" | "medium" | "high";
  adaptation_mode?: string;
  adaptation_reason?: string;
  confusion_signals?: string[];
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
