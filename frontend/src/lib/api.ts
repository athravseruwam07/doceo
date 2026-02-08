import {
  SessionResponse,
  ChatMessage,
  ChatContextPayload,
  ExamCramResponse,
} from "./types";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const BASE = API_ORIGIN.replace(/\/$/, "");

async function parseApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const data = (await res.json()) as { detail?: string };
    if (data?.detail) return new Error(data.detail);
  } catch {
    // ignore JSON parse failure and try plain text
  }
  try {
    const text = await res.text();
    if (text.trim()) {
      return new Error(text.trim());
    }
  } catch {
    // ignore text parse failure
  }
  return new Error(fallback);
}

async function parseUnknownApiError(
  err: unknown,
  fallback: string
): Promise<Error> {
  if (err instanceof Error) return err;
  if (err instanceof Response) return parseApiError(err, fallback);
  return new Error(fallback);
}

function normalizeAudioUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/audio/")) return `${API_ORIGIN}${url}`;
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
  data: FormData | { problem_text: string; subject_hint?: string }
): Promise<SessionResponse> {
  const isFormData = data instanceof FormData;
  const url = isFormData ? `${BASE}/sessions/upload` : `${BASE}/sessions`;
  try {
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
      throw await parseApiError(res, `Session creation failed: ${res.status}`);
    }
    return res.json();
  } catch (err) {
    throw await parseUnknownApiError(
      err,
      "Session creation failed: cannot reach backend. Check backend is running on http://127.0.0.1:8000."
    );
  }
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
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  const data = (await res.json()) as ChatMessage;
  return normalizeChatMessage(data);
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
  const wsBase = API_ORIGIN.replace(/^http/, "ws").replace(/\/$/, "");
  return `${wsBase}/sessions/${sessionId}/voice/stream`;
}

export async function createExamCramPlan(
  sessionId: string,
  payload: {
    materials: string[];
    subject_hint?: string;
    exam_name?: string;
  }
): Promise<ExamCramResponse> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/exam-cram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw await parseApiError(res, `Exam cram generation failed: ${res.status}`);
  }
  return (await res.json()) as ExamCramResponse;
}

export async function createExamCramPlanUpload(
  sessionId: string,
  payload: {
    files: File[];
    notes?: string;
    subject_hint?: string;
    exam_name?: string;
  }
): Promise<ExamCramResponse> {
  const formData = new FormData();
  for (const file of payload.files) {
    formData.append("files", file);
  }
  if (payload.notes?.trim()) formData.append("notes", payload.notes.trim());
  if (payload.subject_hint?.trim()) {
    formData.append("subject_hint", payload.subject_hint.trim());
  }
  if (payload.exam_name?.trim()) {
    formData.append("exam_name", payload.exam_name.trim());
  }

  const res = await fetch(`${BASE}/sessions/${sessionId}/exam-cram/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw await parseApiError(res, `Exam cram upload failed: ${res.status}`);
  }
  return (await res.json()) as ExamCramResponse;
}
