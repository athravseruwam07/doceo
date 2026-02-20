"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useScroll, useSpring, useTransform } from "framer-motion";
import { heroSequence } from "./content";
import { LANDING_EASE, useLandingReducedMotion } from "./motion";

const LOOP_MS = 3200;

export default function InteractiveHeroDemo() {
  const reduceMotion = useLandingReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 96%", "start 38%"],
  });

  const rotateX = useSpring(useTransform(scrollYProgress, [0, 1], [14, 0]), {
    stiffness: 110,
    damping: 26,
  });
  const lift = useSpring(useTransform(scrollYProgress, [0, 1], [36, 0]), {
    stiffness: 110,
    damping: 26,
  });
  const scale = useSpring(useTransform(scrollYProgress, [0, 1], [0.965, 1]), {
    stiffness: 110,
    damping: 26,
  });
  const opacity = useSpring(useTransform(scrollYProgress, [0, 1], [0.64, 1]), {
    stiffness: 110,
    damping: 26,
  });

  useEffect(() => {
    if (reduceMotion || paused) return undefined;

    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % heroSequence.length);
    }, LOOP_MS);

    return () => window.clearInterval(timer);
  }, [reduceMotion, paused]);

  const active = heroSequence[index];
  const completion = useMemo(() => `${Math.round(((index + 1) / heroSequence.length) * 100)}%`, [index]);

  return (
    <div ref={containerRef} className="mx-auto mt-12 w-full max-w-5xl [perspective:1300px]">
      <motion.div
        className="landing-hero-card overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--paper)] shadow-[var(--shadow-lg)]"
        style={
          reduceMotion
            ? undefined
            : {
                rotateX,
                y: lift,
                scale,
                opacity,
                transformOrigin: "top center",
              }
        }
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--paper-warm)] px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">
              Live lesson simulation
            </span>
            <span className="rounded-full bg-[var(--emerald-subtle)] px-2.5 py-1 text-[11px] uppercase tracking-[0.08em] text-[var(--emerald-dark)]">
              Calculus: Derivatives
            </span>
            <button
              type="button"
              onClick={() => setPaused((v) => !v)}
              className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
            >
              {paused ? "Resume" : "Pause"} autoplay
            </button>
          </div>

          <div className="text-[12px] text-[var(--ink-tertiary)]">
            Session A82DK1 • Step {index + 1}/{heroSequence.length} • {completion}
          </div>
        </div>

        <div className="grid gap-4 px-5 py-6 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="rounded-2xl border border-[var(--border)] bg-[#0F2522] p-5 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-white/70">Board status</p>
                <p className="mt-1 font-[family-name:var(--font-heading)] text-[30px] leading-tight">{active.status}</p>
              </div>
              <span className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-white/80">Lesson mode</span>
            </div>

            <p className="mt-3 text-[14px] leading-relaxed text-white/80">{active.detail}</p>

            <div className="mt-5 rounded-xl border border-white/10 bg-[#0B1C19] p-4">
              <p className="text-[11px] uppercase tracking-[0.08em] text-white/60">Problem</p>
              <p className="mt-1 text-[15px] text-white/90">{active.boardTitle}</p>

              <div className="mt-4 space-y-2">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`board-${active.id}`}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.28, ease: LANDING_EASE }}
                    className="space-y-2"
                  >
                    {active.boardLines.map((line, lineIndex) => {
                      const focused = lineIndex <= active.focusLine;
                      return (
                        <div
                          key={`${active.id}-${line}`}
                          className={`rounded-lg border px-3 py-2 text-[14px] transition-colors duration-300 ${
                            focused
                              ? "border-[color-mix(in_srgb,var(--emerald-light)_65%,transparent)] bg-[color-mix(in_srgb,var(--emerald)_18%,transparent)] text-white"
                              : "border-white/10 bg-white/5 text-white/55"
                          }`}
                        >
                          {line}
                        </div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-white/60">Playback progress</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                <motion.div
                  className="h-full rounded-full bg-[var(--emerald-light)]"
                  animate={reduceMotion ? { width: "100%" } : { width: completion }}
                  transition={{ duration: 0.35, ease: LANDING_EASE }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper-warm)] p-4">
              <p className="text-[12px] text-[var(--ink-tertiary)]">Tutor narration</p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={`speech-${active.id}`}
                  className="mt-2 text-[14px] leading-relaxed text-[var(--ink-secondary)]"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.26, ease: LANDING_EASE }}
                >
                  {active.transcript}
                </motion.p>
              </AnimatePresence>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4">
              <p className="text-[12px] text-[var(--ink-tertiary)]">In-lesson Q&A interruption</p>
              {active.studentQuestion ? (
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl bg-[var(--paper-warm)] px-3 py-2 text-[13px] text-[var(--ink-secondary)]">
                    <span className="font-medium text-[var(--ink)]">Student:</span> {active.studentQuestion}
                  </div>
                  <div className="rounded-xl bg-[var(--emerald-subtle)] px-3 py-2 text-[13px] text-[var(--ink-secondary)]">
                    <span className="font-medium text-[var(--emerald-dark)]">Doceo:</span> {active.tutorReply}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-[var(--ink-tertiary)]">No interruption yet. Lesson is currently in guided playback.</p>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4">
              <p className="text-[12px] text-[var(--ink-tertiary)]">Lesson event timeline</p>
              <div className="mt-3 grid gap-2">
                {heroSequence.map((step, eventIndex) => {
                  const reached = eventIndex <= index;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setIndex(eventIndex)}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors ${
                        eventIndex === index
                          ? "bg-[var(--emerald-subtle)]"
                          : "hover:bg-[var(--paper-warm)]"
                      }`}
                    >
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          reached ? "bg-[var(--emerald)]" : "bg-[var(--border-strong)]"
                        }`}
                      />
                      <span className={reached ? "text-[13px] text-[var(--ink)]" : "text-[13px] text-[var(--ink-tertiary)]"}>
                        {step.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
