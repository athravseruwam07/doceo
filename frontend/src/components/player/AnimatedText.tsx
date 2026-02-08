"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { InlineMath } from "react-katex";

interface AnimatedTextProps {
  text: string;
  duration: number;
  isAnimating: boolean;
  animationProgress?: number;
  teachingPhase?: "setup" | "derive" | "checkpoint" | "result";
}

interface TextSegment {
  type: "text" | "math" | "bold";
  content: string;
}

interface TextChunk {
  type: "text" | "math" | "bold";
  content: string;
  weight: number;
}

function parseSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
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

function splitTextIntoChunks(content: string): string[] {
  const compact = content.replace(/\s+/g, " ").trim();
  if (!compact) return [];
  const phrases = compact.match(/[^,.;:!?]+[,.!?;:]?\s*/g);
  if (!phrases) return [compact];

  const chunks: string[] = [];
  for (const phrase of phrases) {
    const words = phrase.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 4) {
      chunks.push(phrase);
      continue;
    }
    let cursor = 0;
    while (cursor < words.length) {
      const slice = words.slice(cursor, cursor + 4).join(" ");
      const suffix = cursor + 4 >= words.length && /[,.!?;:]$/.test(phrase.trim()) ? " " : " ";
      chunks.push(`${slice}${suffix}`);
      cursor += 4;
    }
  }
  return chunks;
}

function buildChunks(text: string): TextChunk[] {
  const segments = parseSegments(text);
  const chunks: TextChunk[] = [];

  for (const seg of segments) {
    if (seg.type === "math") {
      chunks.push({ type: "math", content: seg.content, weight: 1.8 });
      continue;
    }
    if (seg.type === "bold") {
      const pieces = splitTextIntoChunks(seg.content);
      if (pieces.length === 0) continue;
      for (const piece of pieces) {
        chunks.push({ type: "bold", content: piece, weight: /[,.!?;:]\s*$/.test(piece) ? 1.55 : 1.2 });
      }
      continue;
    }
    const pieces = splitTextIntoChunks(seg.content);
    if (pieces.length === 0) continue;
    for (const piece of pieces) {
      chunks.push({ type: "text", content: piece, weight: /[,.!?;:]\s*$/.test(piece) ? 1.45 : 1 });
    }
  }

  return chunks;
}

export default function AnimatedText({
  text,
  duration,
  isAnimating,
  animationProgress,
  teachingPhase,
}: AnimatedTextProps) {
  const chunks = buildChunks(text);
  const totalChunks = chunks.length;
  const totalWeight = chunks.reduce((sum, chunk) => sum + chunk.weight, 0);
  const [revealedCount, setRevealedCount] = useState(isAnimating ? 0 : totalChunks);
  const rafRef = useRef<number>(0);
  const startRef = useRef(0);

  const weightedRevealCount = useCallback((progress: number): number => {
    if (totalChunks === 0 || totalWeight <= 0) return 0;
    const phaseScale = teachingPhase === "result"
      ? 0.95
      : teachingPhase === "checkpoint"
        ? 0.9
        : teachingPhase === "derive"
          ? 0.96
          : 1;
    const eased = Math.min(1, Math.max(0, progress / phaseScale));
    const targetWeight = eased * totalWeight;
    let consumed = 0;
    let count = 0;
    for (const chunk of chunks) {
      consumed += chunk.weight;
      count += 1;
      if (consumed >= targetWeight) break;
    }
    return Math.min(totalChunks, count);
  }, [chunks, teachingPhase, totalChunks, totalWeight]);

  useEffect(() => {
    if (animationProgress !== undefined) return;
    let cancelled = false;

    if (!isAnimating) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (!cancelled) setRevealedCount(totalChunks);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(rafRef.current);
      };
    }

    if (totalChunks === 0) return;
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(() => {
      if (!cancelled) setRevealedCount(0);
    });
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const rawProgress = Math.min(1, elapsed / duration);
      setRevealedCount(weightedRevealCount(rawProgress));
      if (rawProgress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setRevealedCount(totalChunks);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [isAnimating, duration, totalChunks, animationProgress, weightedRevealCount]);

  const isBullet = text.match(/^(\s*[-\u2022]\s|^\s*\d+\.\s)/);
  const visibleChunkCount =
    animationProgress !== undefined ? weightedRevealCount(animationProgress) : revealedCount;

  return (
    <div
      className={`typewriter-line leading-relaxed text-[15px] text-[var(--ink-secondary)] font-[family-name:var(--font-body)] ${isBullet ? "ml-2" : ""}`}
    >
      {chunks.slice(0, visibleChunkCount).map((chunk, i) => {
        if (chunk.type === "math") {
          return (
            <span key={i} className="inline mx-0.5">
              <InlineMath math={chunk.content} />
            </span>
          );
        }

        if (chunk.type === "bold") {
          return (
            <strong key={i} className="font-semibold text-[var(--ink)]">
              {chunk.content}
            </strong>
          );
        }

        return <span key={i}>{chunk.content}</span>;
      })}
    </div>
  );
}
