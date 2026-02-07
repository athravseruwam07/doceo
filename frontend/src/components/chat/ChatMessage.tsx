"use client";

import { ChatMessage as ChatMessageType } from "@/lib/types";
import RichContent from "@/components/lesson/RichContent";
import MathBlock from "@/components/lesson/MathBlock";
import { motion } from "framer-motion";

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`
          max-w-[85%] px-3.5 py-2.5 rounded-[var(--radius-md)]
          text-[13px] leading-[1.7] font-[family-name:var(--font-body)]
          ${
            isUser
              ? "bg-[var(--emerald)] text-white rounded-br-sm"
              : "bg-[var(--paper-warm)] text-[var(--ink-secondary)] border border-[var(--border)] rounded-bl-sm"
          }
        `}
      >
        <RichContent content={message.message} />

        {/* Extra display math blocks from tutor */}
        {!isUser &&
          message.math_blocks?.map((block, i) => (
            <MathBlock key={i} latex={block.latex} display={block.display} />
          ))}

        {/* Related step reference */}
        {message.related_step && (
          <span className="block mt-1.5 text-[11px] opacity-60">
            See step {message.related_step}
          </span>
        )}
      </div>
    </motion.div>
  );
}
