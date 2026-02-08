"use client";

import { useEffect, useState, useRef } from "react";
import { BlockMath, InlineMath } from "react-katex";

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface AnimatedEquationProps {
  latex: string;
  duration: number;
  isAnimating: boolean;
  display?: boolean;
  animationProgress?: number;
  teachingPhase?: "setup" | "derive" | "checkpoint" | "result";
  eventId?: string;
}

function weightedRevealProgress(
  latex: string,
  progress: number,
  teachingPhase: AnimatedEquationProps["teachingPhase"]
): number {
  const chars = [...latex];
  if (chars.length === 0) return 1;

  const phaseScale = teachingPhase === "result"
    ? 0.92
    : teachingPhase === "checkpoint"
      ? 0.88
      : teachingPhase === "derive"
        ? 0.95
        : 1;
  const eased = easeInOutCubic(Math.min(1, progress / phaseScale));

  const weights = chars.map((char) => {
    if (char === "=") return 2.3;
    if (char === "+" || char === "-" || char === "\\") return 1.75;
    if (char === "(" || char === ")") return 1.5;
    return 1;
  });
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const target = eased * totalWeight;

  let consumed = 0;
  let revealed = 0;
  for (let i = 0; i < weights.length; i += 1) {
    consumed += weights[i];
    revealed = i + 1;
    if (consumed >= target) break;
  }
  return Math.min(1, Math.max(0, revealed / chars.length));
}

export default function AnimatedEquation({
  latex,
  duration,
  isAnimating,
  display = true,
  animationProgress,
  teachingPhase,
}: AnimatedEquationProps) {
  const [internalProgress, setInternalProgress] = useState(isAnimating ? 0 : 1);
  const rafRef = useRef<number>(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (animationProgress !== undefined) return;
    let cancelled = false;

    if (!isAnimating) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (!cancelled) setInternalProgress(1);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(rafRef.current);
      };
    }

    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(() => {
      if (!cancelled) setInternalProgress(0);
    });
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const raw = Math.min(1, elapsed / duration);
      setInternalProgress(raw);
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [isAnimating, duration, animationProgress]);

  const rawProgress = animationProgress !== undefined ? animationProgress : internalProgress;
  const revealPercent = weightedRevealProgress(latex, rawProgress, teachingPhase) * 100;

  // Subtle micro-motion during animation
  const isActive = rawProgress > 0 && rawProgress < 1;
  const microY = isActive ? Math.sin(rawProgress * Math.PI * 6) * 0.3 : 0;

  if (display) {
    return (
      <div className="equation-reveal my-3" data-animating={isActive}>
        <div
          className="relative overflow-hidden"
          style={{
            clipPath: `inset(0 ${100 - revealPercent}% 0 0)`,
            transform: `translateY(${microY}px)`,
          }}
        >
          <BlockMath math={latex} />
        </div>
      </div>
    );
  }

  return (
    <span
      className="inline-equation-reveal"
      style={{
        clipPath:
          revealPercent < 100
            ? `inset(0 ${100 - revealPercent}% 0 0)`
            : undefined,
        transform: `translateY(${microY}px)`,
      }}
    >
      <InlineMath math={latex} />
    </span>
  );
}
