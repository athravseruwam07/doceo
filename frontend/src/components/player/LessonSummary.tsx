"use client";

import { useState } from "react";
import { BlockMath } from "react-katex";
import { AnimationEvent, ChatMessage as ChatMessageType } from "@/lib/types";
import { extractEquations } from "@/lib/timeline";
import { getExport } from "@/lib/api";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import ChatSidebar from "../chat/ChatSidebar";

interface LessonSummaryProps {
  sessionId: string;
  title: string;
  subject: string;
  events: AnimationEvent[];
  messages: ChatMessageType[];
  chatLoading: boolean;
  onSendMessage: (message: string) => Promise<void>;
}

export default function LessonSummary({
  sessionId,
  title,
  subject,
  events,
  messages,
  chatLoading,
  onSendMessage,
}: LessonSummaryProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const equations = extractEquations(events);

  const handleExport = async () => {
    try {
      const blob = await getExport(sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `doceo-${sessionId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent fail
    }
  };

  return (
    <div className="flex h-full">
      {/* Main summary */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-10">
          {/* Header */}
          <div className="text-center mb-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)] p-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--emerald-subtle)] mb-4 shadow-[var(--shadow-sm)]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 12l2 2 4-4"
                  stroke="var(--emerald)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="var(--emerald)"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <h1 className="text-[24px] font-bold text-[var(--ink)] font-[family-name:var(--font-heading)] mb-2">
              Lesson Complete
            </h1>
            <p className="text-[15px] text-[var(--ink-secondary)] font-[family-name:var(--font-body)]">
              {title}
            </p>
            <Badge variant="emerald" className="mt-2">
              {subject}
            </Badge>
            <p className="mt-3 text-[12px] text-[var(--ink-tertiary)] font-[family-name:var(--font-body)]">
              You completed {Math.max(1, new Set(events.map((e) => e.payload.stepNumber).filter(Boolean)).size)} learning steps and reviewed {equations.length} key equations.
            </p>
          </div>

          {/* Equation reference sheet */}
          {equations.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[16px] font-semibold text-[var(--ink)] font-[family-name:var(--font-heading)] mb-4">
                Key Equations
              </h2>
              <div className="space-y-2 bg-[var(--paper)] p-5 rounded-[var(--radius-lg)] border border-[var(--border)]">
                {equations.map((eq, i) => (
                  <div key={i} className="equation-summary-item">
                    <BlockMath math={eq.latex} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3">
            <Button variant="primary" onClick={handleExport}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 11v2.5A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V11M8 1v9M4.5 6.5L8 10l3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Download notes
            </Button>
            <Button variant="secondary" onClick={() => setChatOpen(true)}>
              Ask more questions
            </Button>
            <Button variant="ghost" onClick={() => (window.location.href = "/")}>
              New lesson
            </Button>
          </div>
        </div>
      </div>

      {/* Chat sidebar */}
      {chatOpen && (
        <div className="w-[380px] flex-shrink-0 border-l border-[var(--border)] hidden md:flex">
          <div className="w-[380px]">
            <ChatSidebar
              messages={messages}
              loading={chatLoading}
              onSend={onSendMessage}
              onClose={() => setChatOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
