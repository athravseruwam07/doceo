"use client";

import { useEffect, useRef } from "react";
import { AnimationEvent, TimelineSegment } from "@/lib/types";
import AnimatedEquation from "./AnimatedEquation";
import { InlineMath } from "react-katex";

interface WhiteboardCanvasProps {
  completedVisuals: AnimationEvent[];
  activeVisual: AnimationEvent | null;
  activeVisualProgress: number;
  currentSegment: TimelineSegment | null;
  isPlaying: boolean;
}

export default function WhiteboardCanvas({
  completedVisuals,
  activeVisual,
  activeVisualProgress,
  currentSegment,
  isPlaying,
}: WhiteboardCanvasProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active element
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (boardRef.current) {
      boardRef.current.scrollTo({
        top: boardRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [completedVisuals.length, activeVisual?.id]);

  // Group visuals by step
  const stepGroups = groupByStep(completedVisuals);
  const currentStepNum = currentSegment?.stepNumber ?? 0;

  return (
    <div className="board-container flex flex-col h-full rounded-xl overflow-hidden">
      {/* Step indicator — small pill in top-left */}
      {currentSegment && currentSegment.stepNumber > 0 && (
        <div className="board-step-indicator">
          <span className="board-step-pill">
            Step {currentSegment.stepNumber}
          </span>
          {currentSegment.stepTitle && (
            <span className="board-step-title">
              {currentSegment.stepTitle}
            </span>
          )}
        </div>
      )}

      {/* The board surface */}
      <div ref={boardRef} className="board-surface flex-1 overflow-y-auto">
        <div className="board-content">
          {/* Completed visuals grouped by step */}
          {stepGroups.map((group) => (
            <div key={`step-${group.stepNumber}`} className="board-step-group">
              {group.stepNumber > 0 && stepGroups.indexOf(group) > 0 && (
                <div className="board-divider" />
              )}
              {group.visuals.map((event) => (
                <BoardItem
                  key={event.id}
                  event={event}
                  isActive={false}
                  progress={1}
                />
              ))}
            </div>
          ))}

          {/* Step divider if entering a new step */}
          {currentSegment?.isStepStart &&
            !stepGroups.some(g => g.stepNumber === currentStepNum) &&
            stepGroups.length > 0 && (
              <div className="board-divider" />
            )}

          {/* Currently animating element (visible even when paused) */}
          {activeVisual && (
            <div ref={activeRef} className="board-active-item">
              <BoardItem
                event={activeVisual}
                isActive={isPlaying}
                progress={activeVisualProgress}
              />
            </div>
          )}
        </div>
      </div>

      {/* Annotation overlays */}
      {completedVisuals
        .filter(e => e.type === "annotate" && e.payload.targetId)
        .map(a => (
          <AnnotationEffect key={a.id} annotation={a} />
        ))}
    </div>
  );
}

// ─── Board Item Renderer ───
// Only renders equations and small labels. No plain text paragraphs.
function BoardItem({
  event,
  isActive,
  progress,
}: {
  event: AnimationEvent;
  isActive: boolean;
  progress: number;
}) {
  const animProgress = isActive ? progress : undefined;

  switch (event.type) {
    case "write_equation":
      return (
        <div className="board-equation" data-event-id={event.id}>
          <AnimatedEquation
            latex={event.payload.latex!}
            duration={event.duration}
            isAnimating={isActive}
            display={event.payload.display ?? true}
            animationProgress={animProgress}
            eventId={event.id}
          />
        </div>
      );

    case "write_text": {
      // Render as a small chalk-style label using KaTeX for any inline math
      const text = event.payload.text ?? "";
      // Check if text contains inline math
      const hasMath = /\$[^$]+\$/.test(text);

      if (hasMath) {
        // Parse and render mixed text+math as a label
        return (
          <div className="board-label" data-event-id={event.id}>
            <MixedLabel text={text} isActive={isActive} progress={progress} />
          </div>
        );
      }

      // Pure text label — render as styled chalk text
      return (
        <div className="board-label" data-event-id={event.id}>
          <ChalkLabel text={text} isActive={isActive} progress={progress} />
        </div>
      );
    }

    case "annotate":
      return null;
    case "clear_section":
    case "draw_line":
    case "draw_arrow":
    case "draw_rect":
    case "draw_circle":
    case "draw_axes":
    case "plot_curve":
      return null;
    default:
      return null;
  }
}

// ─── Chalk Label: small styled text that looks like handwriting ───
function ChalkLabel({
  text,
  isActive,
  progress,
}: {
  text: string;
  isActive: boolean;
  progress: number;
}) {
  const opacity = isActive ? Math.min(1, progress * 2) : 1;
  return (
    <span className="chalk-text" style={{ opacity }}>
      {text}
    </span>
  );
}

// ─── Mixed Label: text with inline $math$ rendered via KaTeX ───
function MixedLabel({
  text,
  isActive,
  progress,
}: {
  text: string;
  isActive: boolean;
  progress: number;
}) {
  const opacity = isActive ? Math.min(1, progress * 2) : 1;
  const parts = text.split(/(\$[^$]+\$)/g);

  return (
    <span className="chalk-text" style={{ opacity }}>
      {parts.map((part, i) => {
        if (part.startsWith("$") && part.endsWith("$")) {
          const latex = part.slice(1, -1);
          return (
            <span key={i} className="inline mx-1">
              <InlineMath math={latex} />
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ─── Step Grouping ───
interface StepGroup {
  stepNumber: number;
  visuals: AnimationEvent[];
}

function groupByStep(visuals: AnimationEvent[]): StepGroup[] {
  const groups: StepGroup[] = [];
  let current: StepGroup | null = null;

  for (const v of visuals) {
    if (
      v.type === "annotate" ||
      v.type === "clear_section" ||
      v.type === "draw_line" ||
      v.type === "draw_arrow" ||
      v.type === "draw_rect" ||
      v.type === "draw_circle" ||
      v.type === "draw_axes" ||
      v.type === "plot_curve"
    ) {
      continue;
    }
    const sn = v.payload.stepNumber ?? 0;
    if (!current || current.stepNumber !== sn) {
      current = { stepNumber: sn, visuals: [] };
      groups.push(current);
    }
    current.visuals.push(v);
  }
  return groups;
}

// ─── Annotation Effect ───
function AnnotationEffect({ annotation }: { annotation: AnimationEvent }) {
  const targetId = annotation.payload.targetId;
  const style = annotation.payload.annotationType ?? "highlight";

  useEffect(() => {
    if (!targetId) return;
    const el = document.querySelector(`[data-event-id="${targetId}"]`);
    if (el) el.classList.add(`annotation-${style}`);
    return () => {
      if (el) el.classList.remove(`annotation-${style}`);
    };
  }, [targetId, style]);

  return null;
}
