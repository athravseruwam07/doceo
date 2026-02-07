"use client";

import { useState, useRef, useCallback } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <div className="flex items-end gap-2 p-3 border-t border-[var(--border)] bg-[var(--paper)]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Ask a question..."
        disabled={disabled}
        rows={1}
        className="
          flex-1 resize-none
          bg-transparent text-[13px] text-[var(--ink)]
          font-[family-name:var(--font-body)]
          placeholder:text-[var(--ink-faint)]
          focus:outline-none
          leading-[1.6]
          max-h-[120px]
        "
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || disabled}
        className="
          flex-shrink-0 w-7 h-7
          flex items-center justify-center
          rounded-full
          bg-[var(--emerald)] text-white
          disabled:opacity-30 disabled:cursor-not-allowed
          hover:bg-[var(--emerald-light)]
          transition-colors duration-150
          cursor-pointer
        "
        aria-label="Send message"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M12 7H2M7 2l5 5-5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
