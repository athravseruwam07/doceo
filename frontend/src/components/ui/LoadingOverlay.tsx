"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BuildStage, VoiceStatus } from "@/lib/types";

const STAGES = [
  { key: "analysis", label: "Analyzing your problem", icon: "🔍", duration: 3000 },
  { key: "planning", label: "Creating a detailed lesson plan", icon: "📝", duration: 5000 },
  { key: "scripting", label: "Scripting whiteboard animations", icon: "🎬", duration: 6000 },
  { key: "voice", label: "Generating voice narration", icon: "🎙️", duration: 8000 },
  { key: "prepare", label: "Preparing your lesson", icon: "✨", duration: 4000 },
];

const TOTAL_DURATION = STAGES.reduce((sum, stage) => sum + stage.duration, 0);
const MAX_STAGE_INDEX = STAGES.length - 1;

const BUILD_STAGE_TO_INDEX: Record<BuildStage, number> = {
  received: 0,
  analysis: 0,
  script_ready: 2,
  voice_generation: 3,
  preparing: 4,
  stream_ready: 4,
  streaming: 4,
  complete: 4,
};

function getStageIndex(elapsed: number): number {
  let cumulative = 0;
  for (let i = 0; i < STAGES.length; i++) {
    cumulative += STAGES[i].duration;
    if (elapsed < cumulative) return i;
  }
  return STAGES.length - 1;
}

interface LessonLoadingScreenProps {
  overlay?: boolean;
  persistKey?: string;
  phase?: "intake" | "lesson";
  buildStage?: BuildStage;
  voiceStatus?: VoiceStatus;
}

function startStorageKey(persistKey: string): string {
  return `lesson-loading-start:${persistKey}`;
}

function stageStorageKey(persistKey: string): string {
  return `lesson-loading-stage:${persistKey}`;
}

export function clearLoadingPersistence(persistKey: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(startStorageKey(persistKey));
  window.sessionStorage.removeItem(stageStorageKey(persistKey));
}

export default function LessonLoadingScreen({
  overlay = false,
  persistKey,
  phase = "lesson",
  buildStage,
  voiceStatus,
}: LessonLoadingScreenProps) {
  const [elapsed, setElapsed] = useState(0);
  const storageStartKey = persistKey ? startStorageKey(persistKey) : null;
  const storageStageKey = persistKey ? stageStorageKey(persistKey) : null;
  const floorRef = useRef(0);

  useEffect(() => {
    let startAt = Date.now();
    let stageFloor = 0;

    if (typeof window !== "undefined" && storageStartKey && storageStageKey) {
      const saved = window.sessionStorage.getItem(storageStartKey);
      const savedStage = window.sessionStorage.getItem(storageStageKey);
      const parsed = saved ? Number(saved) : Number.NaN;
      const parsedStage = savedStage ? Number(savedStage) : Number.NaN;
      const isRecent = Number.isFinite(parsed) && Date.now() - parsed <= TOTAL_DURATION + 60_000;
      startAt = isRecent ? parsed : Date.now();
      stageFloor = Number.isFinite(parsedStage) ? Math.max(0, Math.min(MAX_STAGE_INDEX, Math.floor(parsedStage))) : 0;
      window.sessionStorage.setItem(storageStartKey, String(startAt));
      window.sessionStorage.setItem(storageStageKey, String(stageFloor));
    }
    floorRef.current = stageFloor;

    const updateElapsed = () => {
      const nextElapsed = Math.min(TOTAL_DURATION, Date.now() - startAt);
      setElapsed(nextElapsed);
      return nextElapsed >= TOTAL_DURATION;
    };

    if (updateElapsed()) return;

    const interval = setInterval(() => {
      if (updateElapsed()) clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
  }, [storageStartKey, storageStageKey]);

  const timerStage = useMemo(() => getStageIndex(elapsed), [elapsed]);
  const backendStage = buildStage ? BUILD_STAGE_TO_INDEX[buildStage] ?? 0 : 0;
  // eslint-disable-next-line react-hooks/refs
  const activeStage = Math.max(timerStage, backendStage, floorRef.current);

  useEffect(() => {
    if (!storageStageKey || typeof window === "undefined") return;
    if (activeStage > floorRef.current) {
      floorRef.current = activeStage;
      window.sessionStorage.setItem(storageStageKey, String(activeStage));
    }
  }, [activeStage, storageStageKey]);

  const timerProgress = elapsed / TOTAL_DURATION;
  const milestoneProgress = (activeStage + 0.2) / STAGES.length;
  const progressPercent = Math.min(1, Math.max(timerProgress, milestoneProgress));
  const phaseLabel = phase === "intake" ? "Phase 1 · Intake" : "Phase 2 · Lesson Build";
  const voiceWarning =
    voiceStatus && voiceStatus !== "ok"
      ? "Voice narration may be temporarily unavailable. Retrying automatically."
      : null;

  return (
    <div className={`flex items-center justify-center ${overlay ? "fixed inset-0 z-50 bg-[var(--cream)]/90 backdrop-blur-sm" : "h-screen bg-[var(--cream)]"}`}>
      <motion.div
        className="w-full max-w-md px-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Title */}
        <div className="text-center mb-10">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-faint)] mb-2 font-[family-name:var(--font-body)]">
            {phaseLabel}
          </p>
          <h2 className="font-[family-name:var(--font-heading)] text-[22px] font-semibold text-[var(--ink)] mb-2">
            Building your lesson
          </h2>
          <p className="text-[13px] text-[var(--ink-tertiary)] font-[family-name:var(--font-body)]">
            This usually takes 30–60 seconds
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {STAGES.map((stage, i) => {
            const isDone = i < activeStage;
            const isActive = i === activeStage;
            const isPending = i > activeStage;

            return (
              <motion.div
                key={stage.key}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
                  ${isActive ? "bg-[var(--paper)] shadow-[var(--shadow-sm)] border border-[var(--border)]" : ""}
                  ${isDone ? "opacity-60" : ""}
                  ${isPending ? "opacity-30" : ""}
                `}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: isPending ? 0.3 : isDone ? 0.6 : 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Status indicator */}
                <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                  {isDone ? (
                    <motion.svg
                      width="20" height="20" viewBox="0 0 20 20" fill="none"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <circle cx="10" cy="10" r="9" fill="var(--emerald)" />
                      <path d="M6 10l2.5 2.5L14 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                  ) : isActive ? (
                    <motion.div
                      className="w-5 h-5 rounded-full border-2 border-[var(--emerald)] border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-[var(--border)]" />
                  )}
                </div>

                {/* Label */}
                <span className={`
                  text-[14px] font-[family-name:var(--font-body)]
                  ${isActive ? "text-[var(--ink)] font-medium" : "text-[var(--ink-secondary)]"}
                `}>
                  {stage.label}
                </span>

                {/* Active pulse dot */}
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      className="ml-auto text-[16px]"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                    >
                      {stage.icon}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {voiceWarning && (
          <p className="mt-4 text-[11px] text-[var(--error)] text-center font-[family-name:var(--font-body)]">
            {voiceWarning}
          </p>
        )}

        {/* Progress bar */}
        <div className="mt-8 h-1 bg-[var(--cream-dark)] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[var(--emerald)] rounded-full"
            style={{
              width: `${progressPercent * 100}%`,
            }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </motion.div>
    </div>
  );
}
