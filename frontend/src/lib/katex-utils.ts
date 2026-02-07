export interface MathSegment {
  type: "text" | "math";
  content: string;
  display: boolean;
}

/**
 * Parse a string containing $...$ (inline) and $$...$$ (display) LaTeX delimiters
 * into an array of typed segments for rendering.
 */
export function parseContent(content: string): MathSegment[] {
  const segments: MathSegment[] = [];
  // Match $$...$$ (display) and $...$ (inline), non-greedy
  const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
        display: false,
      });
    }

    const raw = match[0];
    const isDisplay = raw.startsWith("$$");
    const latex = isDisplay ? raw.slice(2, -2).trim() : raw.slice(1, -1).trim();

    segments.push({
      type: "math",
      content: latex,
      display: isDisplay,
    });

    lastIndex = pattern.lastIndex;
  }

  // Trailing text
  if (lastIndex < content.length) {
    segments.push({
      type: "text",
      content: content.slice(lastIndex),
      display: false,
    });
  }

  return segments;
}
