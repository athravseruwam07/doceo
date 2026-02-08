"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSSE } from "@/hooks/useSSE";
import { useChat } from "@/hooks/useChat";
import { getLessonStreamUrl } from "@/lib/api";
import { LessonStep, SessionResponse } from "@/lib/types";
import PlayerShell from "@/components/player/PlayerShell";
import LoadingOverlay from "@/components/ui/LoadingOverlay";

interface LessonPageProps {
  params: Promise<{ sessionId: string }>;
}

type SSEEvent = LessonStep & { message?: string; total_steps?: number };

export default function LessonPage({ params }: LessonPageProps) {
  const { sessionId } = use(params);
  const url = getLessonStreamUrl(sessionId);
  const { data, isConnected, error, isComplete } = useSSE<SSEEvent>(url);
  const chat = useChat(sessionId);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loadingElapsed, setLoadingElapsed] = useState(0);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setSession)
      .catch(() => {});
  }, [sessionId]);

  const { steps } = useMemo(() => {
    const steps: LessonStep[] = [];

    for (const event of data) {
      if ("step_number" in event) {
        steps.push(event as LessonStep);
      }
    }

    return { steps };
  }, [data]);

  useEffect(() => {
    if (steps.length > 0 || error) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setLoadingElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [steps.length, error]);

  const loadingPhase = useMemo(() => {
    if (loadingElapsed < 5) {
      return {
        index: 0,
        message: "Analyzing your problem...",
        subMessage: "Understanding problem structure and key concepts.",
        progress: (loadingElapsed / 5) * 0.33,
      };
    }
    if (loadingElapsed < 15) {
      return {
        index: 1,
        message: "Creating lesson plan...",
        subMessage: "Sequencing a step-by-step explanation tailored to your input.",
        progress: 0.33 + ((loadingElapsed - 5) / 10) * 0.34,
      };
    }
    return {
      index: 2,
      message: "Generating voice narration...",
      subMessage: "Preparing synchronized explanation and whiteboard flow.",
      progress: 0.67 + Math.min((loadingElapsed - 15) / 25, 1) * 0.3,
    };
  }, [loadingElapsed]);

  // Loading state — waiting for first step
  if (steps.length === 0 && !error) {
    return (
      <div className="min-h-screen bg-[var(--cream)] relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="h-[80px] rounded-[var(--radius-lg)] bg-[var(--paper)] border border-[var(--border)] animate-pulse mb-4" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-[360px] rounded-[var(--radius-lg)] bg-[var(--paper)] border border-[var(--border)] animate-pulse" />
            <div className="h-[360px] rounded-[var(--radius-lg)] bg-[var(--paper)] border border-[var(--border)] animate-pulse" />
          </div>
        </div>
        <LoadingOverlay
          isVisible
          message={loadingPhase.message}
          subMessage={
            isConnected
              ? `${loadingPhase.subMessage} Connected to lesson stream.`
              : `${loadingPhase.subMessage} Waiting for stream connection...`
          }
          phaseIndex={loadingPhase.index}
          progress={loadingPhase.progress}
        />
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
          <Link
            href="/"
            className="text-[13px] text-[var(--emerald)] hover:underline font-[family-name:var(--font-body)]"
          >
            Try again
          </Link>
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
