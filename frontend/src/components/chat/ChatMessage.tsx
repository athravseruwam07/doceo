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
  const timestamp = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`
          chat-bubble max-w-[88%] px-3.5 py-2.5 rounded-[var(--radius-md)]
          text-[13px] leading-[1.7] font-[family-name:var(--font-body)]
          ${
            isUser
              ? "bg-[var(--emerald)] text-white rounded-br-sm shadow-[var(--shadow-sm)]"
              : "bg-[var(--paper-warm)] text-[var(--ink-secondary)] border border-[var(--border)] rounded-bl-sm shadow-[var(--shadow-sm)]"
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
          <span className="inline-flex mt-2 px-2 py-0.5 rounded-full text-[11px] border border-[var(--border)] bg-[var(--paper)] text-[var(--ink-tertiary)]">
            About step {message.related_step}
          </span>
        )}

        {!isUser && message.adaptation_reason && (
          <p className="mt-2 text-[11px] text-[var(--ink-faint)] italic">
            {message.adaptation_reason}
          </p>
        )}

        {timestamp && (
          <p
            className={`mt-1 text-[10px] ${
              isUser ? "text-white/70" : "text-[var(--ink-faint)]"
            }`}
          >
            {timestamp}
          </p>
        )}
      </div>
    </motion.div>
  );
}
