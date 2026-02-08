"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getVoiceStreamUrl } from "@/lib/api";

interface UseVoiceSessionResult {
  connected: boolean;
  sendSpeechStart: () => void;
  sendSpeechEnd: () => void;
  sendTranscript: (text: string, isFinal: boolean) => void;
}

export function useVoiceSession(sessionId: string): UseVoiceSessionResult {
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(getVoiceStreamUrl(sessionId));
    socketRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => {
      ws.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [sessionId]);

  const send = useCallback((payload: Record<string, unknown>) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }, []);

  const sendSpeechStart = useCallback(() => {
    send({ type: "speech_start" });
  }, [send]);

  const sendSpeechEnd = useCallback(() => {
    send({ type: "speech_end" });
  }, [send]);

  const sendTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (!text.trim()) return;
      send({
        type: "transcript",
        text: text.trim(),
        is_final: isFinal,
      });
    },
    [send]
  );

  return { connected, sendSpeechStart, sendSpeechEnd, sendTranscript };
}
