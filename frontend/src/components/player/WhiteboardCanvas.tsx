"use client";

import { useEffect, useRef } from "react";
import { AnimationEvent } from "@/lib/types";
import AnimatedEquation from "./AnimatedEquation";
import AnimatedText from "./AnimatedText";

interface WhiteboardCanvasProps {
  visibleEvents: AnimationEvent[];
  activeEvent: AnimationEvent | null;
  narration: string;
  isPlaying: boolean;
}

export default function WhiteboardCanvas({
  visibleEvents,
  activeEvent,
  narration,
  isPlaying,
}: WhiteboardCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to follow the writing cursor
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [visibleEvents.length, activeEvent?.id]);

  return (
    <div className="whiteboard-canvas flex flex-col h-full bg-[var(--paper)] paper-grain rounded-[var(--radius-lg)] overflow-hidden">
      {/* Narration bar */}
      <div className="narration-bar px-6 py-4 border-b border-[var(--border)] bg-[var(--paper-warm)] min-h-[56px] flex items-center">
        {narration ? (
          <p className="text-[16px] font-semibold text-[var(--emerald)] font-[family-name:var(--font-heading)] tracking-tight">
            {narration}
          </p>
        ) : (
          <p className="text-[14px] text-[var(--ink-faint)] font-[family-name:var(--font-body)] italic">
            Preparing lesson...
          </p>
        )}
      </div>

      {/* Board surface */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-5 space-y-1"
      >
        {/* Already completed events */}
        {visibleEvents.map((event) => (
          <BoardElement key={event.id} event={event} isAnimating={false} />
        ))}

        {/* Currently animating event */}
        {activeEvent &&
          activeEvent.type !== "pause" &&
          activeEvent.type !== "step_marker" &&
          activeEvent.type !== "narrate" && (
            <BoardElement
              key={`active-${activeEvent.id}`}
              event={activeEvent}
              isAnimating={isPlaying}
            />
          )}

        {/* Bottom padding for scroll space */}
        <div className="h-8" />
      </div>
    </div>
  );
}

function BoardElement({
  event,
  isAnimating,
}: {
  event: AnimationEvent;
  isAnimating: boolean;
}) {
  switch (event.type) {
    case "write_equation":
      return (
        <AnimatedEquation
          latex={event.payload.latex!}
          duration={event.duration}
          isAnimating={isAnimating}
          display={event.payload.display ?? true}
        />
      );
    case "write_text":
      return (
        <AnimatedText
          text={event.payload.text!}
          duration={event.duration}
          isAnimating={isAnimating}
        />
      );
    case "narrate":
      // Narration is handled by the narration bar, but if it appears
      // as a visible event we can show it as a subtle section header
      return (
        <div className="pt-4 pb-1">
          <p className="text-[13px] font-medium text-[var(--emerald)] font-[family-name:var(--font-heading)] uppercase tracking-wider opacity-70">
            {event.payload.text}
          </p>
        </div>
      );
    case "annotate":
      return null; // Handled by rough-notation overlay
    case "clear_section":
      return null;
    default:
      return null;
  }
}
