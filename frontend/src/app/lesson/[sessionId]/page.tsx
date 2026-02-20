"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSSE } from "@/hooks/useSSE";
import { useChat } from "@/hooks/useChat";
import { getLessonStreamUrl, getSessionInfo } from "@/lib/api";
import {
  AnimationEvent,
  BuildStage,
  LessonStep,
  LessonCompleteEvent,
  VoiceStatus,
} from "@/lib/types";
import PlayerShell from "@/components/player/PlayerShell";
import LessonLoadingScreen, { clearLoadingPersistence } from "@/components/ui/LoadingOverlay";

interface LessonPageProps {
  params: Promise<{ sessionId: string }>;
}

type SSEEvent = (LessonStep | LessonCompleteEvent) & { message?: string };

function dedupeEvents(events?: AnimationEvent[]): AnimationEvent[] | undefined {
  if (!events || events.length === 0) return events;
  const deduped: AnimationEvent[] = [];
  const indexById = new Map<string, number>();

  for (const event of events) {
    const existingIndex = indexById.get(event.id);
    if (existingIndex === undefined) {
      indexById.set(event.id, deduped.length);
      deduped.push(event);
    } else {
      // Keep the latest payload for this id while preserving visual order.
      deduped[existingIndex] = event;
    }
  }

  return deduped;
}

function normalizeStep(step: LessonStep): LessonStep {
  return {
    ...step,
    events: dedupeEvents(step.events),
  };
}

export default function LessonPage({ params }: LessonPageProps) {
  const { sessionId } = use(params);
  const searchParams = useSearchParams();
  const loadingRun = searchParams.get("loadingRun");
  const persistKey = loadingRun || sessionId;
  const url = getLessonStreamUrl(sessionId);
  const { data, error } = useSSE<SSEEvent>(url);
  const chat = useChat(sessionId);
  const [buildStage, setBuildStage] = useState<BuildStage | undefined>(undefined);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | undefined>(undefined);
  const [problemText, setProblemText] = useState<string | undefined>(undefined);
  const [sessionSteps, setSessionSteps] = useState<LessonStep[]>([]);
  const steps = useMemo(() => {
    const streamSteps = data.filter(
      (event): event is LessonStep => "step_number" in event
    );
    const byStepNumber = new Map<number, LessonStep>();
    for (const step of streamSteps) {
      byStepNumber.set(step.step_number, normalizeStep(step));
    }
    return [...byStepNumber.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, step]) => step);
  }, [data]);
  const mergedSteps = useMemo(() => {
    if (steps.length === 0) return steps;
    if (sessionSteps.length === 0) return steps;

    const sessionStepByNumber = new Map<number, LessonStep>(
      sessionSteps.map((step) => [step.step_number, normalizeStep(step)])
    );

    return steps.map((streamStep) => {
      const hydrated = sessionStepByNumber.get(streamStep.step_number);
      if (!hydrated) return streamStep;

      const streamEvents = dedupeEvents(streamStep.events) ?? [];
      const hydratedEvents = dedupeEvents(hydrated.events) ?? [];
      const hydratedById = new Map(hydratedEvents.map((event) => [event.id, event]));

      const mergedEvents = streamEvents.map((event) => {
        const hydratedEvent = hydratedById.get(event.id);
        if (!hydratedEvent) return event;
        return {
          ...event,
          duration: hydratedEvent.duration ?? event.duration,
          payload: {
            ...event.payload,
            ...hydratedEvent.payload,
          },
        };
      });

      return normalizeStep({
        ...streamStep,
        narration: hydrated.narration ?? streamStep.narration,
        audio_url: hydrated.audio_url ?? streamStep.audio_url,
        audio_duration: hydrated.audio_duration ?? streamStep.audio_duration,
        events: mergedEvents,
      });
    });
  }, [steps, sessionSteps]);

  useEffect(() => {
    if (steps.length > 0 || error) {
      clearLoadingPersistence(persistKey);
    }

    let active = true;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const session = await getSessionInfo(sessionId);
        if (!active) return;
        setBuildStage(session.build_stage as BuildStage | undefined);
        setVoiceStatus(session.voice_status as VoiceStatus | undefined);
        setProblemText(session.problem_text);
        if (Array.isArray(session.steps) && session.steps.length > 0) {
          setSessionSteps(session.steps.map((step) => normalizeStep(step)));
        }
      } catch {
        // ignore poll errors while loading
      } finally {
        if (active) timer = window.setTimeout(poll, 1500);
      }
    };

    void poll();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [sessionId, steps.length, error, persistKey]);

  // Loading state — show staged progress screen
  if (steps.length === 0 && !error) {
    return (
      <LessonLoadingScreen
        persistKey={persistKey}
        phase="lesson"
        buildStage={buildStage}
        voiceStatus={voiceStatus}
      />
    );
  }

  // Error state
  if (error && steps.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--cream)]">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4m0 4h.01M12 3l9.66 16.59a1 1 0 01-.87 1.5H3.21a1 1 0 01-.87-1.5L12 3z" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-[15px] text-[var(--ink)] font-medium mb-1 font-[family-name:var(--font-heading)]">
            Something went wrong
          </p>
          <p className="text-[13px] text-[var(--ink-secondary)] mb-4 font-[family-name:var(--font-body)]">
            {error}
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-[var(--emerald)] rounded-lg hover:bg-[var(--emerald-dark)] transition-colors font-[family-name:var(--font-body)]"
          >
            Try again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PlayerShell
      sessionId={sessionId}
      steps={mergedSteps}
      messages={chat.messages}
      chatLoading={chat.loading}
      onSendMessage={chat.sendMessage}
      voiceStatus={voiceStatus}
      problemText={problemText}
    />
  );
}
