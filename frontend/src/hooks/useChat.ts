"use client";

import { useState, useCallback } from "react";
import { sendChatMessage } from "@/lib/api";
import { ChatContextPayload, ChatMessage } from "@/lib/types";

interface UseChatResult {
  messages: ChatMessage[];
  loading: boolean;
  sendMessage: (text: string, context?: ChatContextPayload) => Promise<void>;
}

export function useChat(sessionId: string): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(
    async (text: string, context?: ChatContextPayload) => {
      if (!text.trim() || loading) return;

      const userMsg: ChatMessage = {
        role: "user",
        message: text.trim(),
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const tutorMsg = await sendChatMessage(sessionId, text.trim(), context);
        setMessages((prev) => [
          ...prev,
          {
            ...tutorMsg,
            created_at: new Date().toISOString(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "tutor",
            message: "Sorry, I couldn't process that. Try again?",
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [sessionId, loading]
  );

  return { messages, loading, sendMessage };
}
