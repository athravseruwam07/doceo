"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { featurePanels, type CapabilityIcon } from "./content";
import { LANDING_EASE, fadeUpVariants, useLandingReducedMotion } from "./motion";

function iconFor(type: CapabilityIcon): string {
  switch (type) {
    case "lesson":
      return "Layered steps";
    case "voice":
      return "Narration";
    case "chat":
      return "Context Q and A";
    case "cram":
      return "Exam prep";
    case "history":
      return "Session replay";
    case "theme":
      return "Theme support";
    case "input":
      return "Input parsing";
    default:
      return "Feature";
  }
}

export default function FeatureDeepDiveGrid() {
  const reduceMotion = useLandingReducedMotion();
  const [activeId, setActiveId] = useState(featurePanels[0]?.id ?? "");

  const active = useMemo(
    () => featurePanels.find((panel) => panel.id === activeId) ?? featurePanels[0],
    [activeId]
  );

  return (
    <section id="features" className="landing-shell px-6 py-18">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={fadeUpVariants(reduceMotion, 22)}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-120px" }}
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">Feature deep dive</p>
            <h2 className="mt-2 font-[family-name:var(--font-heading)] text-[42px] leading-[1.02] text-[var(--ink)]">
              Product depth, not surface demos.
            </h2>
          </div>
          <p className="max-w-xl text-[14px] text-[var(--ink-secondary)]">
            Every panel maps to currently available Doceo behavior so students know exactly what they can do after signup.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {featurePanels.map((panel, idx) => {
            const selected = panel.id === active.id;
            return (
              <motion.button
                key={panel.id}
                type="button"
                onMouseEnter={() => setActiveId(panel.id)}
                onFocus={() => setActiveId(panel.id)}
                className={`group rounded-2xl border p-5 text-left transition-all duration-300 ${
                  selected
                    ? "border-[var(--emerald-light)] bg-[var(--emerald-subtle)]"
                    : "border-[var(--border)] bg-[var(--paper)] hover:translate-y-[-2px] hover:border-[var(--border-strong)]"
                }`}
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.52, ease: LANDING_EASE, delay: idx * 0.05 }}
              >
                <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">{iconFor(panel.icon)}</p>
                <h3 className="mt-2 font-[family-name:var(--font-heading)] text-[29px] leading-tight text-[var(--ink)]">
                  {panel.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-secondary)]">{panel.description}</p>

                <motion.ul
                  className="mt-4 space-y-2"
                  initial={false}
                  animate={{ opacity: selected ? 1 : 0.86 }}
                  transition={{ duration: 0.22 }}
                >
                  {panel.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-[13px] text-[var(--ink-secondary)]">
                      <span className="mt-[7px] inline-block h-1.5 w-1.5 rounded-full bg-[var(--emerald)]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </motion.ul>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
