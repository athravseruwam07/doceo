"use client";

import { motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { useRef, useState } from "react";
import { howItWorksSteps } from "./content";
import { LANDING_EASE, fadeUpVariants, useLandingReducedMotion } from "./motion";

export default function HowItWorksNarrative() {
  const reduceMotion = useLandingReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 70%", "end 35%"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26 });
  const [progressPercent, setProgressPercent] = useState("0%");

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const percent = Math.round(Math.min(100, Math.max(0, value * 100)));
    setProgressPercent(`${percent}%`);
  });

  return (
    <section id="how-it-works" ref={ref} className="landing-shell px-6 py-18">
      <motion.div
        className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr]"
        variants={fadeUpVariants(reduceMotion, 24)}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-120px" }}
      >
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">How it works</p>
          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[42px] leading-[1.02] text-[var(--ink)]">
            From prompt to confident understanding.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--ink-secondary)]">
            Each stage is designed to reduce friction and keep students inside an active learning loop.
          </p>

          <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
            <motion.div className="h-full bg-[var(--emerald)]" style={{ scaleX: progress, transformOrigin: "left" }} />
          </div>
          <p className="mt-2 text-[12px] text-[var(--ink-tertiary)]">Section progress: {progressPercent}</p>
        </div>

        <div className="space-y-6">
          {howItWorksSteps.map((step, idx) => (
            <motion.article
              key={step.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-6"
              initial={reduceMotion ? false : { opacity: 0, y: 22 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, ease: LANDING_EASE, delay: idx * 0.04 }}
            >
              <div className="flex items-start gap-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--emerald-light)] bg-[var(--emerald-subtle)] font-[family-name:var(--font-heading)] text-[18px] text-[var(--emerald-dark)]">
                  {idx + 1}
                </span>
                <div>
                  <h3 className="font-[family-name:var(--font-heading)] text-[30px] leading-tight text-[var(--ink)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-secondary)]">{step.description}</p>
                  <p className="mt-3 rounded-xl bg-[var(--cream)] px-3 py-2 text-[13px] text-[var(--ink-secondary)]">
                    <span className="font-medium text-[var(--ink)]">Outcome:</span> {step.outcome}
                  </p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
