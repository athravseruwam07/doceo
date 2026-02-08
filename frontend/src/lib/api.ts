import { SessionResponse, ChatMessage, ChatContextPayload } from "./types";

const BASE = "/api";

function normalizeAudioUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/audio/")) return `${BASE}${url}`;
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
  const res = await fetch(url, {
    method: "POST",
    ...(isFormData
      ? { body: data }
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
  });
  if (!res.ok) throw new Error(`Session creation failed: ${res.status}`);
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
  const backendUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const wsBase = backendUrl.replace(/^http/, "ws").replace(/\/$/, "");
  return `${wsBase}/sessions/${sessionId}/voice/stream`;
}
