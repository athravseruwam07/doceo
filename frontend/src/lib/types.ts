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

export interface ExamCramMaterialSummary {
  name: string;
  source_type: "text" | "upload";
  char_count: number;
}

export interface ExamCramTopic {
  topic: string;
  likelihood: number;
  why: string;
  evidence: string[];
  study_actions: string[];
}

export interface ExamCramLesson {
  title: string;
  objective: string;
  key_points: string[];
  estimated_minutes: number;
}

export interface ExamCramQuestion {
  question: string;
  difficulty: "easy" | "medium" | "hard";
  concept: string;
  answer_outline: string;
}

export interface ExamCramResponse {
  session_id: string;
  subject: string;
  exam_name?: string;
  source_count: number;
  generated_at: string;
  top_terms: string[];
  recurring_patterns: string[];
  prioritized_topics: ExamCramTopic[];
  focused_lessons: ExamCramLesson[];
  practice_questions: ExamCramQuestion[];
  materials: ExamCramMaterialSummary[];
}
