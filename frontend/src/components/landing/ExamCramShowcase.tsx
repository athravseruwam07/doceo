"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LANDING_EASE, fadeUpVariants, useLandingReducedMotion } from "./motion";

const cards = [
  {
    id: "upload",
    title: "Upload class materials",
    subtitle: "Notes, snippets, and past prompts",
  },
  {
    id: "prioritize",
    title: "Get prioritized topics",
    subtitle: "Pattern-based ranking with focused actions",
  },
  {
    id: "practice",
    title: "Practice with intent",
    subtitle: "Targeted questions and lesson objectives",
  },
];

export default function ExamCramShowcase() {
  const reduceMotion = useLandingReducedMotion();

  return (
    <section id="exam-cram" className="landing-shell px-6 py-18">
      <motion.div
        className="mx-auto grid max-w-6xl gap-8 rounded-3xl border border-[var(--border)] bg-[var(--paper)] p-6 md:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"
        variants={fadeUpVariants(reduceMotion, 20)}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-120px" }}
      >
        <div className="max-w-xl lg:py-2">
          <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">Exam Cram</p>
          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[clamp(36px,4.2vw,52px)] leading-[1.04] text-[var(--ink)]">
            Turn scattered notes into a focused plan.
          </h2>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-[var(--ink-secondary)]">
            Doceo converts uploaded material into recurring patterns, prioritized topics, focused lessons, and practice prompts.
          </p>

          <Link
            href="/auth/signup"
            className="mt-8 inline-flex rounded-full bg-[var(--emerald)] px-6 py-3 text-[14px] font-medium text-white shadow-[var(--shadow-sm)] transition-all hover:translate-y-[-1px] hover:bg-[var(--emerald-dark)]"
          >
            Start with Exam Cram
          </Link>
        </div>

        <div className="relative pl-1 sm:pl-2">
          <div className="landing-flow-line" aria-hidden="true" />
          <div className="space-y-4">
            {cards.map((card, idx) => (
              <motion.article
                key={card.id}
                className="relative rounded-2xl border border-[var(--border)] bg-[var(--paper-warm)] p-4 sm:p-5"
                initial={reduceMotion ? false : { opacity: 0, x: 20 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, ease: LANDING_EASE, delay: idx * 0.08 }}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--emerald-subtle)] text-[12px] font-semibold text-[var(--emerald-dark)]">
                  {idx + 1}
                </span>
                <h3 className="mt-2 font-[family-name:var(--font-heading)] text-[clamp(28px,3vw,38px)] leading-[1.04] text-[var(--ink)]">
                  {card.title}
                </h3>
                <p className="mt-2 text-[14px] text-[var(--ink-secondary)]">{card.subtitle}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
