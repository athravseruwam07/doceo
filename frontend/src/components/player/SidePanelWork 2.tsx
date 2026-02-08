"use client";

import { AnimationEvent } from "@/lib/types";
import { motion } from "framer-motion";
import AnimatedEquation from "./AnimatedEquation";
import AnimatedText from "./AnimatedText";

interface SidePanelWorkProps {
  visibleEvents: AnimationEvent[];
  activeEvent: AnimationEvent | null;
  narration: string;
}

export default function SidePanelWork({
  visibleEvents,
  activeEvent,
  narration,
}: SidePanelWorkProps) {
  return (
    <motion.div
      className="flex-1 flex flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--paper-warm)]">
        <p className="text-[12px] font-medium text-[var(--ink-secondary)] tracking-wide uppercase font-[family-name:var(--font-body)]">
          Your Question
        </p>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-y-auto bg-[var(--cream)]">
        <div className="p-4 space-y-4">
          {/* Render visible animation events */}
          {visibleEvents.map((event) => {
            if (
              event.type === "write_equation" ||
              event.type === "annotate"
            ) {
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <AnimatedEquation
                    latex={event.payload.latex || ""}
                    duration={event.duration}
                    display={event.payload.display ?? true}
                    isAnimating={activeEvent?.id === event.id}
                  />
                </motion.div>
              );
            }

            if (event.type === "write_text") {
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <AnimatedText
                    text={event.payload.text || ""}
                    duration={event.duration}
                    isAnimating={activeEvent?.id === event.id}
                  />
                </motion.div>
              );
            }

            return null;
          })}

          {/* Narration text */}
          {narration && (
            <motion.div
              className="mt-4 p-3 bg-[var(--emerald-subtle)] rounded-[var(--radius-md)] border border-[var(--emerald-light)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-[13px] text-[var(--ink-secondary)] leading-relaxed font-[family-name:var(--font-body)]">
                {narration}
              </p>
            </motion.div>
          )}

          {/* Empty state */}
          {visibleEvents.length === 0 && !narration && (
            <div className="flex items-center justify-center h-full text-center">
              <p className="text-[var(--ink-tertiary)] text-[14px] font-[family-name:var(--font-body)]">
                Generating response...
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
