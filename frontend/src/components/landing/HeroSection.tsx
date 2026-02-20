"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import InteractiveHeroDemo from "./InteractiveHeroDemo";
import { LANDING_EASE, heroBlobTransition, useLandingReducedMotion } from "./motion";

export default function HeroSection() {
  const reduceMotion = useLandingReducedMotion();

  return (
    <section className="landing-shell landing-hero relative overflow-hidden px-6 pb-16 pt-34 md:pt-38">
      <div className="landing-ambient" aria-hidden="true">
        <motion.span
          className="landing-blob landing-blob-a"
          animate={
            reduceMotion
              ? undefined
              : {
                  x: [0, 34, -20, 0],
                  y: [0, -22, 20, 0],
                  scale: [1, 1.08, 0.96, 1],
                }
          }
          transition={heroBlobTransition}
        />
        <motion.span
          className="landing-blob landing-blob-b"
          animate={
            reduceMotion
              ? undefined
              : {
                  x: [0, -26, 22, 0],
                  y: [0, 18, -18, 0],
                  scale: [1, 0.94, 1.04, 1],
                }
          }
          transition={{ ...heroBlobTransition, duration: 22 }}
        />
        <span className="landing-grid-sheen" />
      </div>

      <div className="relative mx-auto max-w-5xl text-center">
        <motion.p
          className="mx-auto inline-flex items-center rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--paper)_88%,transparent)] px-4 py-1 text-[12px] uppercase tracking-[0.08em] text-[var(--ink-tertiary)]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: LANDING_EASE }}
        >
          AI study partner for STEM
        </motion.p>

        <motion.h1
          className="mx-auto mt-6 max-w-4xl font-[family-name:var(--font-heading)] text-[clamp(50px,8vw,92px)] leading-[0.97] tracking-[-0.02em] text-[var(--ink)]"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.72, ease: LANDING_EASE, delay: 0.08 }}
        >
          Learn every STEM step with interactive clarity.
        </motion.h1>

        <motion.p
          className="mx-auto mt-7 max-w-2xl text-[clamp(17px,2vw,22px)] leading-relaxed text-[var(--ink-secondary)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: LANDING_EASE, delay: 0.14 }}
        >
          From screenshots to narrated whiteboard walkthroughs, Doceo keeps students in flow with contextual Q and A,
          Exam Cram planning, and revisit-ready history.
        </motion.p>

        <motion.div
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.64, ease: LANDING_EASE, delay: 0.2 }}
        >
          <Link
            href="/auth/signup"
            className="rounded-full bg-[var(--emerald)] px-7 py-3 text-[15px] font-medium text-white shadow-[var(--shadow-md)] transition-all hover:translate-y-[-2px] hover:bg-[var(--emerald-dark)]"
          >
            Start learning free
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full border border-[var(--border)] bg-[var(--paper)] px-7 py-3 text-[15px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--cream-dark)] hover:text-[var(--ink)]"
          >
            See how it works
          </a>
        </motion.div>

        <motion.p
          className="mx-auto mt-5 max-w-2xl text-[13px] text-[var(--ink-tertiary)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.55, delay: 0.32 }}
        >
          Built for deep understanding, not shortcut memorization.
        </motion.p>
      </div>

      <InteractiveHeroDemo />
    </section>
  );
}
