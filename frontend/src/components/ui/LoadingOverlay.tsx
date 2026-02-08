"use client";

import { motion } from "framer-motion";

interface LoadingOverlayProps {
  isVisible: boolean;
  message: string;
  subMessage?: string;
  phaseIndex?: number;
  phases?: string[];
  progress?: number;
}

const DEFAULT_PHASES = [
  "Analyzing your problem",
  "Creating lesson plan",
  "Generating voice narration",
];

export default function LoadingOverlay({
  isVisible,
  message,
  subMessage,
  phaseIndex = 0,
  phases = DEFAULT_PHASES,
  progress = 0.2,
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  const boundedProgress = Math.max(0.04, Math.min(0.98, progress));

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)]/95 p-6 shadow-[var(--shadow-lg)]"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <div className="mb-4">
          <h2 className="font-[family-name:var(--font-heading)] text-[20px] font-semibold text-[var(--ink)]">
            {message}
          </h2>
          {subMessage ? (
            <p className="mt-1 text-[13px] text-[var(--ink-secondary)] font-[family-name:var(--font-body)]">
              {subMessage}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 mb-5">
          {phases.map((phase, index) => {
            const active = index === phaseIndex;
            const completed = index < phaseIndex;
            return (
              <div key={phase} className="flex items-center gap-2">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] border ${
                    completed
                      ? "bg-[var(--emerald)] text-white border-[var(--emerald)]"
                      : active
                      ? "bg-[var(--emerald-subtle)] text-[var(--emerald)] border-[var(--emerald-light)]"
                      : "bg-[var(--paper)] text-[var(--ink-faint)] border-[var(--border)]"
                  }`}
                >
                  {completed ? "✓" : index + 1}
                </span>
                <p
                  className={`text-[12px] font-[family-name:var(--font-body)] ${
                    active
                      ? "text-[var(--ink)]"
                      : completed
                      ? "text-[var(--ink-secondary)]"
                      : "text-[var(--ink-faint)]"
                  }`}
                >
                  {phase}
                </p>
              </div>
            );
          })}
        </div>

        <div className="h-1.5 w-full rounded-full overflow-hidden bg-[var(--cream-dark)] mb-4">
          <motion.div
            className="h-full bg-[var(--emerald)]"
            animate={{ width: `${boundedProgress * 100}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>

        <div className="space-y-2">
          <div className="h-2 rounded bg-[var(--cream-dark)] animate-pulse" />
          <div className="h-2 w-[86%] rounded bg-[var(--cream-dark)] animate-pulse" />
          <div className="h-2 w-[72%] rounded bg-[var(--cream-dark)] animate-pulse" />
        </div>
      </motion.div>
    </motion.div>
  );
}
