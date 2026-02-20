"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUpVariants, useLandingReducedMotion } from "./motion";

export default function CTASection() {
  const reduceMotion = useLandingReducedMotion();

  return (
    <section id="final-cta" className="landing-shell px-6 pb-18 pt-12">
      <motion.div
        className="mx-auto max-w-5xl rounded-3xl border border-[var(--border)] bg-[var(--emerald-subtle)] px-7 py-10 text-center md:px-12"
        variants={fadeUpVariants(reduceMotion, 18)}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-120px" }}
      >
        <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--emerald-dark)]">Start now</p>
        <h2 className="mx-auto mt-3 max-w-3xl font-[family-name:var(--font-heading)] text-[clamp(38px,5vw,66px)] leading-[0.98] text-[var(--ink)]">
          Ready to study with structure instead of stress?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-secondary)]">
          Create your account, start a lesson in minutes, and keep your progress organized across every session.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="rounded-full bg-[var(--emerald)] px-7 py-3 text-[15px] font-medium text-white shadow-[var(--shadow-sm)] transition-all hover:translate-y-[-1px] hover:bg-[var(--emerald-dark)]"
          >
            Create free account
          </Link>
          <Link
            href="/auth/signin"
            className="rounded-full border border-[var(--border)] bg-[var(--paper)] px-7 py-3 text-[15px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--cream-dark)] hover:text-[var(--ink)]"
          >
            I already have an account
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
