"use client";

import { useEffect, useState } from "react";
import { InlineMath } from "react-katex";

interface AnimatedTextProps {
  text: string;
  duration: number;
  isAnimating: boolean;
}

interface TextSegment {
  type: "text" | "math" | "bold";
  content: string;
}

function parseSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Match inline math $...$ and bold **...**
  const pattern = /(\$[^$\n]+?\$|\*\*[^*]+?\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }
    const raw = match[0];
    if (raw.startsWith("$")) {
      segments.push({ type: "math", content: raw.slice(1, -1) });
    } else {
      segments.push({ type: "bold", content: raw.slice(2, -2) });
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}

export default function AnimatedText({
  text,
  duration,
  isAnimating,
}: AnimatedTextProps) {
  const segments = parseSegments(text);

  // Build a flat character map: for each visible character position,
  // track which segment it belongs to and its position within that segment
  const charMap: { segIndex: number; charIndex: number }[] = [];
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    if (seg.type === "math") {
      // Math is revealed as a single unit
      charMap.push({ segIndex: s, charIndex: 0 });
    } else {
      for (let c = 0; c < seg.content.length; c++) {
        charMap.push({ segIndex: s, charIndex: c });
      }
    }
  }

  const totalChars = charMap.length;
  const [revealedCount, setRevealedCount] = useState(
    isAnimating ? 0 : totalChars
  );

  useEffect(() => {
    if (!isAnimating) {
      setRevealedCount(totalChars);
      return;
    }

    setRevealedCount(0);
    if (totalChars === 0) return;

    const interval = Math.max(8, duration / totalChars);
    let count = 0;

    const timer = setInterval(() => {
      count++;
      if (count >= totalChars) {
        setRevealedCount(totalChars);
        clearInterval(timer);
      } else {
        setRevealedCount(count);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [isAnimating, duration, totalChars]);

  // Determine which segments/characters are visible
  const revealedSegments = new Set<number>();
  const revealedCharsPerSeg: Record<number, number> = {};

  for (let i = 0; i < revealedCount; i++) {
    const { segIndex, charIndex } = charMap[i];
    revealedSegments.add(segIndex);
    revealedCharsPerSeg[segIndex] = Math.max(
      revealedCharsPerSeg[segIndex] ?? 0,
      charIndex + 1
    );
  }

  // Check if text is a list item
  const isBullet = text.match(/^(\s*[-•]\s|^\s*\d+\.\s)/);

  return (
    <div
      className={`typewriter-line leading-relaxed text-[15px] text-[var(--ink-secondary)] font-[family-name:var(--font-body)] ${isBullet ? "ml-2" : ""}`}
    >
      {segments.map((seg, i) => {
        if (!revealedSegments.has(i)) return null;

        if (seg.type === "math") {
          return (
            <span key={i} className="inline mx-0.5">
              <InlineMath math={seg.content} />
            </span>
          );
        }

        if (seg.type === "bold") {
          const visibleCount = revealedCharsPerSeg[i] ?? 0;
          const visibleText = seg.content.slice(0, visibleCount);
          return (
            <strong key={i} className="font-semibold text-[var(--ink)]">
              {visibleText}
            </strong>
          );
        }

        // Regular text
        const visibleCount = revealedCharsPerSeg[i] ?? 0;
        const visibleText = seg.content.slice(0, visibleCount);
        return <span key={i}>{visibleText}</span>;
      })}
      {/* Typing cursor */}
      {isAnimating && revealedCount < totalChars && (
        <span className="typing-cursor" />
      )}
    </div>
  );
}
