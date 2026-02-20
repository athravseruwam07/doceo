"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { faqs } from "./content";
import { LANDING_EASE, fadeUpVariants, useLandingReducedMotion } from "./motion";

export default function FaqSection() {
  const reduceMotion = useLandingReducedMotion();
  const [openId, setOpenId] = useState(faqs[0]?.id ?? "");

  return (
    <section id="faq" className="landing-shell px-6 py-16">
      <motion.div
        className="mx-auto max-w-4xl"
        variants={fadeUpVariants(reduceMotion, 16)}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-120px" }}
      >
        <p className="text-center text-[12px] uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">FAQ</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-center font-[family-name:var(--font-heading)] text-[40px] leading-[1.05] text-[var(--ink)]">
          Questions students ask before they start.
        </h2>

        <div className="mt-8 space-y-3">
          {faqs.map((item) => {
            const open = item.id === openId;
            return (
              <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--paper)]">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? "" : item.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  aria-expanded={open}
                  aria-controls={`faq-${item.id}`}
                >
                  <span className="font-[family-name:var(--font-heading)] text-[27px] leading-tight text-[var(--ink)]">
                    {item.question}
                  </span>
                  <span className="text-[22px] text-[var(--ink-tertiary)]">{open ? "-" : "+"}</span>
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      id={`faq-${item.id}`}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: LANDING_EASE }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-[14px] leading-relaxed text-[var(--ink-secondary)]">{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </article>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
