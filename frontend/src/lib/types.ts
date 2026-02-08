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
  problem_text?: string;
  step_count: number;
  status: string;
  voice_status?: VoiceStatus;
  build_stage?: BuildStage;
  audio_status?: string;
  steps?: LessonStep[];
}

export interface SessionHistoryItem {
  session_id: string;
  title: string;
  subject: string;
  problem_text?: string;
  status: string;
  step_count: number;
  updated_at?: string;
  created_at?: string;
}

export interface ChatMessage {
  role: "user" | "tutor";
  message: string;
  created_at?: string;
  math_blocks?: MathBlock[];
  related_step?: number;
  narration?: string;
  audio_url?: string;
  audio_duration?: number;
  events?: AnimationEvent[];
}

export interface ChatContextPayload {
  currentStep?: number;
  currentStepTitle?: string;
  currentEventType?: string;
  activeNarration?: string;
}

export interface ExamCramMaterialSummary {
  name: string;
  source_type: "text" | "upload";
  char_count: number;
}

export interface ExamCramPrioritizedTopic {
  topic: string;
  likelihood: number;
  why: string;
  evidence: string[];
  study_actions: string[];
}

export interface ExamCramFocusedLesson {
  title: string;
  objective: string;
  key_points: string[];
  estimated_minutes: number;
}

export interface ExamCramPracticeQuestion {
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
  prioritized_topics: ExamCramPrioritizedTopic[];
  focused_lessons: ExamCramFocusedLesson[];
  practice_questions: ExamCramPracticeQuestion[];
  materials: ExamCramMaterialSummary[];
}

export type VoiceStatus =
  | "ok"
  | "missing_tts_permission"
  | "unauthorized"
  | "rate_limited"
  | "unknown";

export type BuildStage =
  | "received"
  | "analysis"
  | "script_ready"
  | "voice_generation"
  | "preparing"
  | "stream_ready"
  | "streaming"
  | "complete";

// ─── Animation Timeline Types ───

export type BoardZone = "given" | "main" | "scratch" | "final";
export type BoardAnchor = "given" | "work" | "scratch" | "final";
export type BoardLane = "given" | "derivation" | "scratch" | "final";

export interface BoardPoint {
  x: number;
  y: number;
}

export interface EventStyle {
  color?: string;
  strokeWidth?: number;
  emphasis?: "normal" | "key" | "final";
}

export type AnimationEventType =
  | "narrate"
  | "write_equation"
  | "write_text"
  | "annotate"
  | "clear_section"
  | "draw_line"
  | "draw_arrow"
  | "draw_rect"
  | "draw_circle"
  | "draw_axes"
  | "plot_curve"
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
    position?: "top" | "center" | "bottom" | "side";
    annotationType?: "highlight" | "underline" | "circle" | "box";
    targetId?: string;
    stepNumber?: number;
    stepTitle?: string;
    // Voice fields (populated by backend for narrate events)
    audioUrl?: string;
    audioDuration?: number;
    zone?: BoardZone;
    anchor?: BoardAnchor;
    align?: "left" | "center" | "right";
    groupId?: string;
    intent?: "introduce" | "derive" | "emphasize" | "result" | "side_note";
    temporary?: boolean;
    focusTarget?: string;
    teachingPhase?: "setup" | "derive" | "checkpoint" | "result";
    sceneTemplate?: "given_intro" | "derive_chain" | "scratch_note" | "final_result";
    sceneId?: string;
    slotRole?: "heading" | "equation" | "explanation" | "result";
    syncHoldMs?: number;
    boardPage?: number;
    lane?: BoardLane;
    slotIndex?: number;
    reserveHeight?: number;
    transformChainId?: string;
    renderOrder?: number;
    layoutLocked?: boolean;
    isPageTurnMarker?: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    style?: EventStyle;
    clearTarget?: "zone" | "id";
    clearZone?: BoardZone;
    clearId?: string;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    cx?: number;
    cy?: number;
    r?: number;
    label?: string;
    xLabel?: string;
    yLabel?: string;
    ticks?: number;
    points?: BoardPoint[];
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

// ─── Segment-Based Timeline Types ───

export interface TimelineSegment {
  id: string;
  audio?: {
    eventId: string;
    url?: string;
    duration: number;
    text: string;
  };
  visuals: AnimationEvent[];
  visualDuration: number;
  duration: number;
  syncHoldMs?: number;
  stepNumber: number;
  stepTitle?: string;
  isStepStart: boolean;
}

export interface SegmentPlayerState {
  status: "loading" | "playing" | "paused" | "interrupted" | "complete";
  currentSegmentIndex: number;
  segmentProgress: number;
  totalProgress: number;
  speed: number;
  currentStep: number;
  totalSteps: number;
  voiceEnabled: boolean;
  elapsed: number;
  totalDuration: number;
}
