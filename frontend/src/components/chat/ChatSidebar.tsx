"use client";

import { useEffect, useRef } from "react";
import { ChatMessage as ChatMessageType } from "@/lib/types";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import TypingIndicator from "./TypingIndicator";

interface ChatSidebarProps {
  messages: ChatMessageType[];
  loading: boolean;
  onSend: (message: string) => void;
  onClose?: () => void;
  isMobileOverlay?: boolean;
  isInterrupted?: boolean;
  onContinue?: () => void;
}

export default function ChatSidebar({
  messages,
  loading,
  onSend,
  onClose,
  isMobileOverlay = false,
  isInterrupted = false,
  onContinue,
}: ChatSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, loading]);

  return (
    <div
      className={`
        flex flex-col bg-[var(--paper)]
        ${
          isMobileOverlay
            ? "fixed inset-0 z-50"
            : "border-l border-[var(--border)] h-full"
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--ink)] font-[family-name:var(--font-heading)]">
            Ask your tutor
          </h2>
          <p className="text-[11px] text-[var(--ink-tertiary)] font-[family-name:var(--font-body)]">
            {isInterrupted
              ? "Lesson paused — ask your question"
              : "Ask about any step or concept"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[var(--cream-dark)] transition-colors cursor-pointer"
              aria-label="Close chat"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="var(--ink-tertiary)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Continue lesson button */}
      {isInterrupted && onContinue && (
        <button
          onClick={onContinue}
          className="mx-3 mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--emerald)] text-white text-[13px] font-medium rounded-[var(--radius-md)] hover:bg-[var(--emerald-light)] transition-colors cursor-pointer font-[family-name:var(--font-body)]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 1.5l9 5.5-9 5.5V1.5z" fill="currentColor" />
          </svg>
          Continue lesson
        </button>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[13px] text-[var(--ink-faint)] font-[family-name:var(--font-body)]">
              No messages yet. Ask a question about the lesson!
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {loading && <TypingIndicator />}
      </div>

      {/* Input */}
      <ChatInput onSend={onSend} disabled={loading} />
    </div>
  );
}
