"use client";

import { InlineMath, BlockMath } from "react-katex";
import { motion } from "framer-motion";

interface MathBlockProps {
  latex: string;
  display?: boolean;
}

export default function MathBlock({ latex, display = true }: MathBlockProps) {
  if (display) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <BlockMath math={latex} />
      </motion.div>
    );
  }

  return (
    <span className="inline">
      <InlineMath math={latex} />
    </span>
  );
}
