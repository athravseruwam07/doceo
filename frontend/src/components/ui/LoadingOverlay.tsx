"use client";

import { motion } from "framer-motion";
import Spinner from "./Spinner";

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  subMessage?: string;
}

export default function LoadingOverlay({
  isVisible,
  message = "Generating lesson...",
  subMessage,
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-[var(--paper)] rounded-[var(--radius-lg)] p-8 shadow-lg flex flex-col items-center gap-4 max-w-sm"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <Spinner size={32} />
        <div className="text-center">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--ink)] mb-2">
            {message}
          </h2>
          {subMessage && (
            <p className="text-[13px] text-[var(--ink-secondary)] font-[family-name:var(--font-body)]">
              {subMessage}
            </p>
          )}
        </div>
        <div className="w-full h-1 bg-[var(--cream-dark)] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[var(--emerald)]"
            animate={{ width: ["0%", "100%"] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
        <p className="text-[11px] text-[var(--ink-tertiary)] font-[family-name:var(--font-body)] text-center">
          This usually takes 10-30 seconds. Hang tight!
        </p>
      </motion.div>
    </motion.div>
  );
}
