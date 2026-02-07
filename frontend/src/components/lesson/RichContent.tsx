"use client";

import { parseContent } from "@/lib/katex-utils";
import MathBlock from "./MathBlock";

interface RichContentProps {
  content: string;
}

export default function RichContent({ content }: RichContentProps) {
  const segments = parseContent(content);

  return (
    <span>
      {segments.map((seg, i) => {
        if (seg.type === "math") {
          return (
            <MathBlock key={i} latex={seg.content} display={seg.display} />
          );
        }
        return <span key={i}>{seg.content}</span>;
      })}
    </span>
  );
}
