"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BlockMath, InlineMath } from "react-katex";
import { AnimationEvent, TimelineSegment } from "@/lib/types";

interface InteractiveLessonStageProps {
  completedVisuals: AnimationEvent[];
  activeVisual: AnimationEvent | null;
  activeVisualProgress: number;
  currentSegment: TimelineSegment | null;
  isPlaying: boolean;
  problemText?: string;
}

type VisualGroup = "given" | "work" | "scratch" | "final";

function isVisual(event: AnimationEvent): boolean {
  return (
    event.type === "write_equation" ||
    event.type === "write_text" ||
    event.type === "draw_line" ||
    event.type === "draw_arrow" ||
    event.type === "draw_rect" ||
    event.type === "draw_circle" ||
    event.type === "draw_axes" ||
    event.type === "plot_curve"
  );
}

function classify(event: AnimationEvent): VisualGroup {
  if (event.payload.lane === "final" || event.payload.intent === "result" || event.payload.zone === "final") return "final";
  if (event.payload.lane === "scratch" || event.payload.zone === "scratch") return "scratch";
  if (event.payload.lane === "given" || event.payload.zone === "given" || event.payload.intent === "introduce") return "given";
  return "work";
}

function uniqueVisuals(completed: AnimationEvent[], active: AnimationEvent | null): AnimationEvent[] {
  const map = new Map<string, AnimationEvent>();
  for (const visual of completed) {
    if (isVisual(visual)) map.set(visual.id, visual);
  }
  if (active && isVisual(active)) map.set(active.id, active);
  return [...map.values()];
}

function EventPreview({ event }: { event: AnimationEvent }) {
  if (event.type === "write_equation") {
    return (
      <div className="text-[var(--ink)] text-[18px] leading-tight overflow-hidden">
        {event.payload.display === false ? (
          <InlineMath math={event.payload.latex ?? ""} />
        ) : (
          <BlockMath math={event.payload.latex ?? ""} />
        )}
      </div>
    );
  }

  if (event.type === "write_text") {
    return <p className="text-[14px] md:text-[15px] text-[var(--ink-secondary)] leading-relaxed">{event.payload.text}</p>;
  }

  return (
    <p className="text-[12px] text-[var(--ink-tertiary)] uppercase tracking-[0.12em]">
      Diagram step: {event.type.replace("draw_", "")}
    </p>
  );
}

export default function InteractiveLessonStage({
  completedVisuals,
  activeVisual,
  activeVisualProgress,
  currentSegment,
  isPlaying,
  problemText,
}: InteractiveLessonStageProps) {
  const visuals = useMemo(() => uniqueVisuals(completedVisuals, activeVisual), [completedVisuals, activeVisual]);
  const recentVisuals = useMemo(() => visuals.slice(-16), [visuals]);
  const grouped = useMemo(() => {
    const result: Record<VisualGroup, AnimationEvent[]> = { given: [], work: [], scratch: [], final: [] };
    for (const event of recentVisuals) result[classify(event)].push(event);
    return result;
  }, [recentVisuals]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveScroll, setLiveScroll] = useState(true);
  const activeVisualId = activeVisual && isVisual(activeVisual) ? activeVisual.id : null;
  const derivationScrollRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleDerivationScroll = () => {
    const container = derivationScrollRef.current;
    if (!container) return;
    const nearBottom =
      container.scrollTop + container.clientHeight >= container.scrollHeight - 24;
    setLiveScroll(nearBottom);
  };

  const scrollToLive = () => {
    const container = derivationScrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    setLiveScroll(true);
  };

  useEffect(() => {
    if (!liveScroll || !activeVisualId) return;
    const container = derivationScrollRef.current;
    if (!container) return;

    const row = rowRefs.current[activeVisualId];
    if (row) {
      const targetTop =
        row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2;
      const nextTop = Math.max(0, targetTop);
      container.scrollTo({ top: nextTop, behavior: "smooth" });
      return;
    }

    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [activeVisualId, liveScroll]);

  const selected = useMemo(() => {
    const targetId = activeVisualId ?? selectedId;
    if (!targetId) return activeVisual;
    return recentVisuals.find((event) => event.id === targetId) ?? activeVisual;
  }, [activeVisualId, selectedId, recentVisuals, activeVisual]);

  const finalEvent = grouped.final[grouped.final.length - 1] ?? null;

  return (
    <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 md:p-5 flex flex-col gap-4 overflow-hidden">
      {problemText ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper-warm)]/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-tertiary)] mb-1">Problem</p>
          <p className="text-[13px] md:text-[14px] leading-relaxed text-[var(--ink-secondary)]">{problemText}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper-warm)]/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-tertiary)] mb-1">Problem</p>
          <p className="text-[12px] md:text-[13px] leading-relaxed text-[var(--ink-tertiary)]">
            Exact original problem text is unavailable for this session. Start a new session to capture it word-for-word.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--emerald)]/15 text-[var(--emerald)] border border-[var(--emerald)]/30">
            Step {currentSegment?.stepNumber ?? 1}
          </span>
          <p className="text-[14px] md:text-[15px] text-[var(--ink)] font-semibold truncate">
            {currentSegment?.stepTitle || "Interactive walkthrough"}
          </p>
        </div>
        <span className="text-[12px] text-[var(--ink-tertiary)]">
          {isPlaying ? "Teaching live" : "Paused"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.8fr] gap-4 min-h-0 flex-1">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--paper-warm)]/70 p-3 md:p-4 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-[var(--ink)]">Live derivation</h3>
            <span className="text-[11px] text-[var(--ink-tertiary)]">{recentVisuals.length} steps shown</span>
          </div>
          <div className="relative min-h-0 flex-1">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[var(--paper-warm)]/95 to-transparent z-10" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[var(--paper-warm)]/95 to-transparent z-10" />
            <div ref={derivationScrollRef} onScroll={handleDerivationScroll} className="overflow-auto pr-1 h-full space-y-1.5">
            {grouped.work.length === 0 && (
              <p className="text-[13px] text-[var(--ink-tertiary)]">Waiting for the derivation to begin…</p>
            )}
            {grouped.work.map((event) => {
              const isActive = activeVisual?.id === event.id;
              const isSelected = selected?.id === event.id;
              return (
                <button
                  key={event.id}
                  type="button"
                  ref={(node) => {
                    rowRefs.current[event.id] = node;
                  }}
                  onClick={() => setSelectedId(event.id)}
                  className={`w-full text-left rounded-lg border border-transparent px-3 py-2.5 transition-all ${
                    isActive
                      ? "bg-[var(--emerald)]/10 ring-1 ring-[var(--emerald)]/40"
                      : isSelected
                        ? "bg-[var(--paper)]/85 ring-1 ring-[var(--border-strong)]"
                        : "border-[var(--border)] bg-[var(--paper)]/70 hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="flex items-center justify-end mb-1.5">
                    {isActive && (
                      <span className="text-[11px] font-medium text-[var(--emerald)]">
                        {Math.round(activeVisualProgress * 100)}%
                      </span>
                    )}
                  </div>
                  <EventPreview event={event} />
                </button>
              );
            })}
            </div>
            {!liveScroll && (
              <button
                type="button"
                onClick={scrollToLive}
                className="absolute right-3 bottom-3 z-20 flex items-center gap-1 rounded-full border border-[var(--emerald)]/40 bg-[var(--paper)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--emerald)] shadow-[var(--shadow-sm)] hover:bg-[var(--paper-warm)] transition-colors"
              >
                <span aria-hidden>↓</span>
                Back to live
              </button>
            )}
          </div>
        </section>

        <aside className="min-h-0 flex flex-col gap-3">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--paper-warm)]/70 p-3">
            <h4 className="text-[12px] uppercase tracking-[0.12em] text-[var(--ink-tertiary)] mb-2">Given</h4>
            <div className="space-y-2">
              {grouped.given.length === 0 ? (
                <p className="text-[13px] text-[var(--ink-tertiary)]">No givens captured yet.</p>
              ) : (
                grouped.given.slice(-3).map((event) => <EventPreview key={event.id} event={event} />)
              )}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--emerald)]/28 bg-[var(--emerald)]/8 p-3">
            <h4 className="text-[12px] uppercase tracking-[0.12em] text-[var(--ink-tertiary)] mb-2">Result</h4>
            {finalEvent ? (
              <EventPreview event={finalEvent} />
            ) : (
              <p className="text-[13px] text-[var(--ink-tertiary)]">Final answer will appear here.</p>
            )}
          </section>

          {grouped.scratch.length > 0 && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-3">
              <h4 className="text-[12px] uppercase tracking-[0.12em] text-[var(--ink-tertiary)] mb-2">Side note</h4>
              <EventPreview event={grouped.scratch[grouped.scratch.length - 1]} />
            </section>
          )}
        </aside>
      </div>

      {currentSegment?.audio?.text && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper-warm)]/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-tertiary)] mb-1">Teacher narration</p>
          <p className="text-[13px] md:text-[14px] leading-relaxed text-[var(--ink-secondary)]">{currentSegment.audio.text}</p>
        </div>
      )}
    </div>
  );
}
