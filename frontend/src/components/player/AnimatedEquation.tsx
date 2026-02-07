"use client";

import { useEffect, useState } from "react";
import { BlockMath, InlineMath } from "react-katex";

interface AnimatedEquationProps {
  latex: string;
  duration: number;
  isAnimating: boolean;
  display?: boolean;
}

export default function AnimatedEquation({
  latex,
  duration,
  isAnimating,
  display = true,
}: AnimatedEquationProps) {
  const [revealPercent, setRevealPercent] = useState(isAnimating ? 0 : 100);

  useEffect(() => {
    if (!isAnimating) {
      setRevealPercent(100);
      return;
    }

    setRevealPercent(0);
    const interval = 16; // ~60fps
    const steps = duration / interval;
    const increment = 100 / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= 100) {
        setRevealPercent(100);
        clearInterval(timer);
      } else {
        setRevealPercent(current);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [isAnimating, duration]);

  if (display) {
    return (
      <div className="equation-reveal my-3">
        <div
          className="relative overflow-hidden"
          style={{
            clipPath: `inset(0 ${100 - revealPercent}% 0 0)`,
          }}
        >
          <BlockMath math={latex} />
        </div>
        {/* Cursor indicator */}
        {isAnimating && revealPercent < 100 && (
          <div
            className="equation-cursor"
            style={{ left: `${revealPercent}%` }}
          />
        )}
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
      }}
    >
      <InlineMath math={latex} />
    </span>
  );
}
