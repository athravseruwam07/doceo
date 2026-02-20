"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { capabilities, type CapabilityIcon } from "./content";
import { LANDING_EASE, fadeUpVariants, useLandingReducedMotion } from "./motion";

interface CapabilityShowcase {
  stageLabel: string;
  headline: string;
  highlights: string[];
  flow: string[];
}

const showcaseByCapability: Record<string, CapabilityShowcase> = {
  input: {
    stageLabel: "Input Parser",
    headline: "Convert typed prompts or screenshots into a clean lesson target.",
    highlights: ["Text prompt support", "Screenshot problem intake", "Fast normalization before lesson generation"],
    flow: ["Paste screenshot", "Extract question", "Set objective", "Start lesson"],
  },
  lesson: {
    stageLabel: "Lesson Engine",
    headline: "Build step-by-step whiteboard progressions students can actually follow.",
    highlights: ["Event-based board actions", "Readable pacing", "Clear progression between steps"],
    flow: ["Generate step 1", "Write and explain", "Advance by context", "Lock understanding"],
  },
  voice: {
    stageLabel: "Narration Sync",
    headline: "Narration aligns with board events so listening and reading stay in sync.",
    highlights: ["Per-step voice cues", "Timing linked to visuals", "Classroom-like teaching rhythm"],
    flow: ["Write step", "Attach narration", "Play in sync", "Pause or continue"],
  },
  chat: {
    stageLabel: "Context Q and A",
    headline: "Interrupt mid-lesson, ask a targeted question, and return without losing flow.",
    highlights: ["Ask during playback", "Answer grounded in current step", "Continue from same context"],
    flow: ["Pause lesson", "Ask follow-up", "Get contextual answer", "Resume playback"],
  },
  cram: {
    stageLabel: "Exam Cram",
    headline: "Turn uploaded notes into prioritized topics, focused lessons, and practice direction.",
    highlights: ["Pattern-based topic ranking", "Focused review targets", "Practice-first outputs"],
    flow: ["Upload notes", "Detect patterns", "Prioritize topics", "Launch review"],
  },
  history: {
    stageLabel: "Session History",
    headline: "Reopen past sessions quickly and keep your study momentum cumulative.",
    highlights: ["Saved session timeline", "Quick resume workflow", "Structured revisit loop"],
    flow: ["Open history", "Pick session", "Resume context", "Keep progressing"],
  },
  theme: {
    stageLabel: "Theme + Accessibility",
    headline: "Use Doceo comfortably in light or dark with motion-safe interactions.",
    highlights: ["Light and dark support", "Reduced-motion behavior", "Keyboard-friendly controls"],
    flow: ["Choose theme", "Start lesson", "Adjust motion comfort", "Study longer"],
  },
};

function iconFor(type: CapabilityIcon, className = "h-4 w-4") {
  const finalClass = className;

  switch (type) {
    case "input":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={finalClass} aria-hidden="true">
          <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m12 6 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "lesson":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={finalClass} aria-hidden="true">
          <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.5 10h17M9 5.5v13" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "voice":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={finalClass} aria-hidden="true">
          <path d="M7 9.5v5M12 6.5v11M17 8.5v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "chat":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={finalClass} aria-hidden="true">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-5 4v-4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "cram":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={finalClass} aria-hidden="true">
          <path d="m13 3-6 10h4l-1 8 7-11h-4l1-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "history":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={finalClass} aria-hidden="true">
          <path d="M3.5 12a8.5 8.5 0 1 0 2.2-5.7M3.5 4.5v4.2h4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 8v4.2l2.8 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "theme":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={finalClass} aria-hidden="true">
          <path d="M20 12.4A8.4 8.4 0 1 1 11.6 4a6.7 6.7 0 1 0 8.4 8.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function CapabilityRail() {
  const reduceMotion = useLandingReducedMotion();
  const [activeId, setActiveId] = useState(capabilities[0]?.id ?? "");
  const [paused, setPaused] = useState(false);

  const active = useMemo(
    () => capabilities.find((item) => item.id === activeId) ?? capabilities[0],
    [activeId]
  );
  const activeIndex = useMemo(
    () => Math.max(0, capabilities.findIndex((item) => item.id === active.id)),
    [active.id]
  );
  const showcase = showcaseByCapability[active.id];

  useEffect(() => {
    if (reduceMotion || paused || capabilities.length < 2) return undefined;

    const timer = window.setInterval(() => {
      setActiveId((previous) => {
        const currentIndex = capabilities.findIndex((item) => item.id === previous);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % capabilities.length;
        return capabilities[nextIndex]?.id ?? previous;
      });
    }, 3400);

    return () => window.clearInterval(timer);
  }, [reduceMotion, paused]);

  return (
    <section className="landing-shell px-6 py-16">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={fadeUpVariants(reduceMotion, 20)}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-120px" }}
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className="max-w-xl font-[family-name:var(--font-heading)] text-[clamp(36px,4.2vw,58px)] leading-[1.01] text-[var(--ink)]">
            Everything students need in one flow
          </h2>
          <p className="max-w-xl text-[14px] text-[var(--ink-secondary)]">
            Explore capabilities and watch the study loop update in real time.
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--paper)_92%,transparent)] p-3 sm:p-4">
          <div className="relative flex flex-wrap gap-2">
            {capabilities.map((item) => {
              const selected = item.id === active.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => {
                    setPaused(true);
                    if (!reduceMotion) setActiveId(item.id);
                  }}
                  onMouseLeave={() => setPaused(false)}
                  onFocus={() => setActiveId(item.id)}
                  onClick={() => setActiveId(item.id)}
                  className={`relative inline-flex items-center gap-2 rounded-full px-3 py-2 text-[13px] transition-colors sm:text-[14px] ${
                    selected ? "text-[var(--ink)]" : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                  }`}
                  aria-pressed={selected}
                >
                  {selected && (
                    <motion.span
                      layoutId="capability-pill"
                      className="absolute inset-0 rounded-full border border-[var(--emerald-light)] bg-[var(--emerald-subtle)]"
                      transition={{ duration: 0.24, ease: LANDING_EASE }}
                    />
                  )}
                  <span className="relative z-10 inline-flex h-5 w-5 items-center justify-center text-[var(--emerald-dark)]">
                    {iconFor(item.icon, "h-3.5 w-3.5")}
                  </span>
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
          </div>

          <motion.div
            className="mt-4 grid items-stretch gap-4 rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-5 lg:grid-cols-[1fr_0.95fr] lg:p-6"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`text-${active.id}`}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={{ duration: 0.32, ease: LANDING_EASE }}
              >
                <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">{showcase.stageLabel}</p>
                <h3 className="mt-2 font-[family-name:var(--font-heading)] text-[clamp(34px,3.8vw,52px)] leading-[1.01] text-[var(--ink)]">
                  {active.label}
                </h3>
                <p className="mt-3 text-[16px] leading-relaxed text-[var(--ink-secondary)]">{showcase.headline}</p>

                <ul className="mt-5 space-y-2">
                  {showcase.highlights.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-[14px] text-[var(--ink-secondary)]">
                      <span className="mt-[8px] inline-block h-1.5 w-1.5 rounded-full bg-[var(--emerald)]" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href="/auth/signup"
                    className="rounded-full bg-[var(--emerald)] px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[var(--emerald-dark)]"
                  >
                    Get started
                  </Link>
                  <a
                    href="#features"
                    className="rounded-full border border-[var(--border)] px-5 py-2.5 text-[14px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--paper-warm)] hover:text-[var(--ink)]"
                  >
                    Explore features
                  </a>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--paper-warm)] p-4 sm:p-5">
              <motion.div
                className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full"
                style={{
                  background: "radial-gradient(circle at center, color-mix(in srgb, var(--emerald-subtle) 88%, transparent), transparent 70%)",
                }}
                animate={reduceMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.55, 0.8, 0.55] }}
                transition={{ duration: 4.4, ease: "easeInOut", repeat: Infinity }}
              />

              <p className="relative text-[11px] uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">Live capability preview</p>
              <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                <motion.div
                  className="h-full rounded-full bg-[var(--emerald)]"
                  animate={reduceMotion ? { width: "100%" } : { width: `${((activeIndex + 1) / capabilities.length) * 100}%` }}
                  transition={{ duration: 0.35, ease: LANDING_EASE }}
                />
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`flow-${active.id}`}
                  className="relative mt-4 space-y-2"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: LANDING_EASE }}
                >
                  {showcase.flow.map((step, idx) => (
                    <div key={step} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--emerald-subtle)] text-[11px] font-semibold text-[var(--emerald-dark)]">
                        {idx + 1}
                      </span>
                      <span className="text-[13px] text-[var(--ink-secondary)]">{step}</span>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>

              <p className="relative mt-4 text-[12px] text-[var(--ink-tertiary)]">
                {activeIndex + 1} of {capabilities.length} capabilities
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
