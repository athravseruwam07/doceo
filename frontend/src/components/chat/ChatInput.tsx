"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";

interface ChatInputProps {
  onSend: (message: string) => void | Promise<void>;
  disabled?: boolean;
  onUserInteractionStart?: () => void;
  onVoiceStart?: () => void;
  onVoiceEnd?: () => void;
  onVoiceTranscript?: (text: string, isFinal: boolean) => void;
}

type SpeechRecognitionResultEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{
      transcript: string;
      confidence?: number;
    }>
    & {
      isFinal?: boolean;
    }
  >;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export default function ChatInput({
  onSend,
  disabled,
  onUserInteractionStart,
  onVoiceStart,
  onVoiceEnd,
  onVoiceTranscript,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const SpeechRecognition = useMemo(() => {
    if (typeof window === "undefined") return null;
    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const handleSend = useCallback(() => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleInteractionStart = useCallback(() => {
    onUserInteractionStart?.();
  }, [onUserInteractionStart]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    handleInteractionStart();
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const toggleListening = useCallback(() => {
    if (!SpeechRecognition || disabled) return;

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      handleInteractionStart();
      onVoiceStart?.();
    };
    recognition.onend = () => {
      setIsListening(false);
      onVoiceEnd?.();
    };
    recognition.onerror = () => {
      setIsListening(false);
      onVoiceEnd?.();
    };
    recognition.onresult = (event) => {
      let interim = "";
      const finalized: string[] = [];

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? "";
        if (!text) continue;
        if ((result as { isFinal?: boolean }).isFinal) {
          finalized.push(text);
        } else {
          interim += text;
        }
      }

      setValue(interim.trimStart());
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";

      const finalText = finalized.join(" ").trim();
      if (finalText) {
        onVoiceTranscript?.(finalText, true);
      } else if (interim.trim()) {
        onVoiceTranscript?.(interim.trim(), false);
      }
    };

    recognition.start();
  }, [
    SpeechRecognition,
    disabled,
    isListening,
    handleInteractionStart,
    onVoiceStart,
    onVoiceEnd,
    onVoiceTranscript,
  ]);

  return (
    <div className="flex items-end gap-2 p-3 border-t border-[var(--border)] bg-[var(--paper)]">
      <div className="flex-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleInteractionStart}
          onInput={handleInput}
          placeholder="Ask a question about what you're seeing now..."
          disabled={disabled}
          rows={1}
          className="
            w-full resize-none
            bg-transparent text-[13px] text-[var(--ink)]
            font-[family-name:var(--font-body)]
            placeholder:text-[var(--ink-faint)]
            focus:outline-none
            leading-[1.6]
            max-h-[120px]
          "
        />
        <p className="mt-1 text-[10px] text-[var(--ink-faint)] font-[family-name:var(--font-body)]">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
      {SpeechRecognition && (
        <button
          onClick={toggleListening}
          disabled={disabled}
          className="
            flex-shrink-0 w-7 h-7
            flex items-center justify-center
            rounded-full
            border border-[var(--border)]
            bg-[var(--paper-warm)] text-[var(--ink-secondary)]
            disabled:opacity-30 disabled:cursor-not-allowed
            hover:bg-[var(--cream-dark)]
            transition-colors duration-150
            cursor-pointer
          "
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
          title={isListening ? "Stop voice input" : "Start voice input"}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1.2a1.8 1.8 0 00-1.8 1.8v2a1.8 1.8 0 003.6 0V3A1.8 1.8 0 006 1.2zM3.3 5.5a.6.6 0 011.2 0 1.5 1.5 0 003 0 .6.6 0 111.2 0 2.7 2.7 0 01-2.1 2.62V9h1a.6.6 0 110 1.2H4.2a.6.6 0 010-1.2h1v-.88A2.7 2.7 0 013.3 5.5z"
              fill="currentColor"
            />
          </svg>
        </button>
      )}
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
