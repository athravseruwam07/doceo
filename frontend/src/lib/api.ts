import { SessionResponse, ChatContextPayload, ChatMessage, ExamCramResponse, SessionHistoryItem } from "./types";
import { convertBackendEvent } from "./timeline";

const BASE = "/api";

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body?.detail) return typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    if (body?.message) return body.message;
  } catch {
    // response wasn't JSON
  }
  return fallback;
}

function normalizeAudioUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/audio/")) return `${BASE}${url}`;
  return url;
}

export async function createSession(
  data: FormData | { problem_text: string; subject_hint?: string }
): Promise<SessionResponse> {
  const isFormData = data instanceof FormData;
  const url = isFormData ? `${BASE}/sessions/upload` : `${BASE}/sessions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      ...(isFormData
        ? { body: data }
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw new Error("Could not reach the server. Make sure the backend is running.");
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const msg = await extractErrorMessage(res, `Server error (${res.status}). Please try again.`);
    throw new Error(msg);
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
    const msg = await extractErrorMessage(res, `Server error (${res.status}). Please try again.`);
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

  let res: Response;
  try {
    res = await fetch(`${BASE}/sessions/${sessionId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Could not reach the server. Please try again.");
  }
  if (!res.ok) {
    const msg = await extractErrorMessage(res, `Chat failed (${res.status})`);
    throw new Error(msg);
  }
  const data = (await res.json()) as ChatMessage & { events?: Record<string, unknown>[] };
  const normalizedMessage: ChatMessage = {
    ...data,
    audio_url: normalizeAudioUrl(data.audio_url),
  };

  if (!Array.isArray(data.events)) {
    return normalizedMessage;
  }

  const rawEvents = data.events.map((event) => ({
    ...((event as unknown) as Record<string, unknown>),
    payload: {
      ...((event as { payload?: Record<string, unknown> }).payload ?? {}),
      audioUrl: normalizeAudioUrl(
        ((event as { payload?: { audioUrl?: string } }).payload?.audioUrl)
      ),
    },
  })) as Record<string, unknown>[];

  return {
    ...normalizedMessage,
    events: rawEvents.map((evt) => convertBackendEvent(evt)),
  };
}

export async function getExport(sessionId: string): Promise<Blob> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/export`);
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
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

export async function getSessionInfo(sessionId: string): Promise<SessionResponse> {
  const res = await fetch(`${BASE}/sessions/${sessionId}`);
  if (!res.ok) {
    const msg = await extractErrorMessage(res, `Session fetch failed (${res.status})`);
    throw new Error(msg);
  }
  return res.json();
}

export async function getSessionHistory(): Promise<SessionHistoryItem[]> {
  const res = await fetch(`${BASE}/sessions`);
  if (!res.ok) {
    const msg = await extractErrorMessage(res, `Session history fetch failed (${res.status})`);
    throw new Error(msg);
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
    const msg = await extractErrorMessage(res, `Exam cram generation failed (${res.status})`);
    throw new Error(msg);
  }
  return res.json();
}

export async function getVoiceHealth(): Promise<{ status: string; detail?: string }> {
  const res = await fetch(`${BASE}/audio/health?force=true`, { cache: "no-store" });
  if (!res.ok) {
    const msg = await extractErrorMessage(res, `Voice health failed (${res.status})`);
    throw new Error(msg);
  }
  return res.json();
}
