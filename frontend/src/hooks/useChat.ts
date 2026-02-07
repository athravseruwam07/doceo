"use client";

import { useState, useCallback } from "react";
import { sendChatMessage } from "@/lib/api";
import { ChatMessage } from "@/lib/types";

interface UseChatResult {
  messages: ChatMessage[];
  loading: boolean;
  sendMessage: (text: string) => Promise<void>;
}

export function useChat(sessionId: string): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: ChatMessage = { role: "user", message: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const tutorMsg = await sendChatMessage(sessionId, text.trim());
        setMessages((prev) => [...prev, tutorMsg]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "tutor",
            message: "Sorry, I couldn't process that. Try again?",
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
