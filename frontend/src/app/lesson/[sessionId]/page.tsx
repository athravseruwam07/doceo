"use client";

import { use, useEffect, useState, useMemo } from "react";
import { useSSE } from "@/hooks/useSSE";
import { useChat } from "@/hooks/useChat";
import { getLessonStreamUrl } from "@/lib/api";
import { LessonStep, LessonCompleteEvent, SessionResponse } from "@/lib/types";
import PlayerShell from "@/components/player/PlayerShell";
import Spinner from "@/components/ui/Spinner";

interface LessonPageProps {
  params: Promise<{ sessionId: string }>;
}

type SSEEvent = (LessonStep | LessonCompleteEvent) & { message?: string };

export default function LessonPage({ params }: LessonPageProps) {
  const { sessionId } = use(params);
  const url = getLessonStreamUrl(sessionId);
  const { data, isConnected, error, isComplete } = useSSE<SSEEvent>(url);
  const chat = useChat(sessionId);
  const [session, setSession] = useState<SessionResponse | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setSession)
      .catch(() => {});
  }, [sessionId]);

  const { steps, lessonComplete } = useMemo(() => {
    const steps: LessonStep[] = [];
    let lessonComplete: LessonCompleteEvent | null = null;

    for (const event of data) {
      if ("step_number" in event) {
        steps.push(event as LessonStep);
      } else if ("message" in event && "total_steps" in event) {
        lessonComplete = event as LessonCompleteEvent;
      }
    }

    return { steps, lessonComplete };
  }, [data]);

  // Loading state — waiting for first step
  if (steps.length === 0 && !error) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--cream)]">
        <div className="flex flex-col items-center gap-3">
          <Spinner size={24} />
          <p className="text-[14px] text-[var(--ink-tertiary)] font-[family-name:var(--font-body)]">
            Building your lesson...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && steps.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--cream)]">
        <div className="text-center max-w-sm">
          <p className="text-[14px] text-[var(--error)] mb-2 font-[family-name:var(--font-body)]">
            {error}
          </p>
          <a
            href="/"
            className="text-[13px] text-[var(--emerald)] hover:underline font-[family-name:var(--font-body)]"
          >
            Try again
          </a>
        </div>
      </div>
    );
  }

  const title = session?.title ?? "Lesson";
  const subject = session?.subject ?? "STEM";

  return (
    <PlayerShell
      sessionId={sessionId}
      title={title}
      subject={subject}
      steps={steps}
      isLessonComplete={isComplete}
      messages={chat.messages}
      chatLoading={chat.loading}
      onSendMessage={chat.sendMessage}
    />
  );
}
