"use client";

import React, { createContext, useCallback, useState, useEffect } from "react";
import { AudioSyncPlayer } from "@/lib/audioPlayer";

interface VoiceContextType {
  enabled: boolean;
  toggleVoice: () => void;
  audioPlayer: AudioSyncPlayer | null;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
}

export const VoiceContext = createContext<VoiceContextType | undefined>(
  undefined
);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("doceo-voice-enabled");
    return saved === null ? true : saved === "true";
  });
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioPlayer] = useState(() => new AudioSyncPlayer());

  // Load preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("doceo-voice-enabled");
    if (saved !== null) {
      try {
        const val = JSON.parse(saved);
        console.log(`[VoiceContext] Loaded voice preference from localStorage: ${val}`);
        setEnabled(val);
      } catch {
        // ignore invalid JSON — keep default (true)
      }
    } else {
      console.log("[VoiceContext] No saved preference, voice enabled by default");
    }
  }, []);

  const toggleVoice = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("doceo-voice-enabled", JSON.stringify(next));
      }
      if (!next) {
        audioPlayer.pause();
      }
      return next;
    });
  }, [audioPlayer]);

  const handleSetPlaybackRate = useCallback(
    (rate: number) => {
      setPlaybackRate(rate);
      audioPlayer.setSpeed(rate);
    },
    [audioPlayer]
  );

  return (
    <VoiceContext.Provider
      value={{
        enabled,
        toggleVoice,
        audioPlayer,
        playbackRate,
        setPlaybackRate: handleSetPlaybackRate,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}
