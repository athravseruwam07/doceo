import {
  SessionResponse,
  ChatMessage,
  ChatContextPayload,
  CourseSummary,
  CourseMaterial,
  CourseLesson,
  ExamCramResponse,
  SessionHistoryItem,
} from "./types";
import { convertBackendEvent } from "./timeline";

type SessionCreatePayload = {
  problem_text: string;
  subject_hint?: string;
  course_id?: string;
};

type MicroSessionCreatePayload = SessionCreatePayload & {
  include_voice?: boolean;
};

const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "";
const BASE = API_ORIGIN || "/api";

async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  const jsonAttempt = res.clone();
  try {
    const data = (await jsonAttempt.json()) as { detail?: string };
    if (typeof data?.detail === "string" && data.detail.trim()) {
      return `${fallback}: ${data.detail}`;
    }
  } catch {
    // Continue and try text fallback.
  }

  try {
    const text = (await res.text()).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (text) {
      return `${fallback}: ${text.slice(0, 220)}`;
    }
  } catch {
    // Ignore parse errors and use status fallback.
  }
  return `${fallback}: ${res.status}`;
}

function normalizeAudioUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/audio/")) {
    return API_ORIGIN ? `${API_ORIGIN}${url}` : `${BASE}${url}`;
  }
  if (url.startsWith("/api/") && API_ORIGIN) {
    return `${API_ORIGIN}${url.slice(4)}`;
  }
  return url;
}

function normalizeChatMessage(raw: ChatMessage): ChatMessage {
  return {
    ...raw,
    audio_url: normalizeAudioUrl(raw.audio_url),
    events: raw.events?.map((event) => ({
      ...event,
      payload: {
        ...event.payload,
        audioUrl: normalizeAudioUrl(event.payload.audioUrl),
      },
    })),
  };
}

export async function createSession(
  data: FormData | SessionCreatePayload
): Promise<SessionResponse> {
  const isFormData = data instanceof FormData;
  const url = isFormData ? `${BASE}/sessions/upload` : `${BASE}/sessions`;
  const res = await fetch(url, {
    method: "POST",
    ...(isFormData
      ? { body: data }
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Session creation failed"));
  }
  return res.json();
}

export async function createMicroSession(
  data: FormData | MicroSessionCreatePayload
): Promise<SessionResponse> {
  const isFormData = data instanceof FormData;
  const url = isFormData ? `${BASE}/sessions/micro/upload` : `${BASE}/sessions/micro`;
  const res = await fetch(url, {
    method: "POST",
    ...(isFormData
      ? { body: data }
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Micro-lesson creation failed"));
  }
  return res.json();
}

export async function listCourses(): Promise<CourseSummary[]> {
  const res = await fetch(`${BASE}/courses`);
  if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to list courses"));
  return res.json();
}

export async function getSessionInfo(sessionId: string): Promise<SessionResponse> {
  const res = await fetch(`${BASE}/sessions/${sessionId}`);
  if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to load session"));
  return res.json();
}

export async function createCourse(label: string): Promise<CourseSummary> {
  const res = await fetch(`${BASE}/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to create course"));
  return res.json();
}

export async function deleteCourse(courseId: string): Promise<CourseSummary> {
  const res = await fetch(`${BASE}/courses/${courseId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await getErrorMessage(res, "Failed to delete course"));
  return res.json();
}

export async function listCourseMaterials(
  courseId: string
): Promise<CourseMaterial[]> {
  const res = await fetch(`${BASE}/courses/${courseId}/materials`);
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Failed to list materials"));
  }
  return res.json();
}

export async function listCourseLessons(
  courseId: string
): Promise<CourseLesson[]> {
  const res = await fetch(`${BASE}/courses/${courseId}/lessons`);
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Failed to list lessons"));
  }
  return res.json();
}

export async function uploadCourseMaterial(
  courseId: string,
  file: File
): Promise<CourseMaterial> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE}/courses/${courseId}/materials`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Failed to upload material"));
  }
  return res.json();
}

export async function createExamCramSession(data: {
  problem_text: string;
  subject_hint?: string;
}): Promise<SessionResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/sessions/exam-cram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    throw new Error("Could not reach the server. Make sure the backend is running.");
  }

  if (!res.ok) {
    const msg = await getErrorMessage(res, `Server error (${res.status}). Please try again.`);
    throw new Error(msg);
  }
  return res.json();
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
  context?: ChatContextPayload
): Promise<ChatMessage> {
  const payload: {
    message: string;
    context?: {
      current_step?: number;
      current_step_title?: string;
      current_event_type?: string;
      active_narration?: string;
    };
  } = {
    message,
  };

  if (context) {
    payload.context = {
      current_step: context.currentStep,
      current_step_title: context.currentStepTitle,
      current_event_type: context.currentEventType,
      active_narration: context.activeNarration,
    };
  }

  const res = await fetch(`${BASE}/sessions/${sessionId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await getErrorMessage(res, "Chat failed"));
  const data = (await res.json()) as ChatMessage & { events?: Record<string, unknown>[] };
  const normalized = normalizeChatMessage(data);

  if (!Array.isArray(data.events)) {
    return normalized;
  }

  const rawEvents = data.events.map((event) => ({
    ...((event as unknown) as Record<string, unknown>),
    payload: {
      ...((event as { payload?: Record<string, unknown> }).payload ?? {}),
      audioUrl: normalizeAudioUrl(
        ((event as { payload?: { audioUrl?: string; audio_url?: string } }).payload?.audioUrl)
        ?? ((event as { payload?: { audioUrl?: string; audio_url?: string } }).payload?.audio_url)
      ),
    },
  })) as Record<string, unknown>[];

  return {
    ...normalized,
    events: rawEvents.map((evt) => convertBackendEvent(evt)),
  };
}

export async function getExport(sessionId: string): Promise<Blob> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/export`);
  if (!res.ok) throw new Error(await getErrorMessage(res, "Export failed"));
  const data = await res.json();
  return new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
}

export function getLessonStreamUrl(sessionId: string): string {
  return `${BASE}/sessions/${sessionId}/lesson/stream`;
}

export function getVoiceStreamUrl(sessionId: string): string {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const wsBase = backendUrl.replace(/^http/, "ws").replace(/\/$/, "");
  return `${wsBase}/sessions/${sessionId}/voice/stream`;
}

export async function getSessionHistory(): Promise<SessionHistoryItem[]> {
  const res = await fetch(`${BASE}/sessions`);
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Failed to fetch session history"));
  }
  return res.json();
}

export async function createExamCramPlanUpload(
  sessionId: string,
  data: {
    files: File[];
    notes?: string;
    subject_hint?: string;
    exam_name?: string;
  }
): Promise<ExamCramResponse> {
  const form = new FormData();
  for (const file of data.files) {
    form.append("files", file);
  }
  if (data.notes) form.append("notes", data.notes);
  if (data.subject_hint) form.append("subject_hint", data.subject_hint);
  if (data.exam_name) form.append("exam_name", data.exam_name);

  const res = await fetch(`${BASE}/sessions/${sessionId}/exam-cram/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Exam cram generation failed"));
  }
  return res.json();
}

export async function getVoiceHealth(): Promise<{ status: string; detail?: string }> {
  const res = await fetch(`${BASE}/audio/health?force=true`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, "Voice health check failed"));
  }
  return res.json();
}
