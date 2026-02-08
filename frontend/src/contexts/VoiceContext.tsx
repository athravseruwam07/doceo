"use client";

import React, { createContext, useState, useCallback, useRef, useEffect } from "react";
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
  const [enabled, setEnabled] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioPlayerRef = useRef<AudioSyncPlayer | null>(null);

  // Initialize audio player on first render
  if (!audioPlayerRef.current) {
    audioPlayerRef.current = new AudioSyncPlayer();
  }

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
      localStorage.setItem("doceo-voice-enabled", JSON.stringify(next));
      if (!next && audioPlayerRef.current) {
        // Muting — stop any playing audio immediately
        audioPlayerRef.current.pause();
      }
      return next;
    });
  }, []);

  const handleSetPlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.setSpeed(rate);
    }
  }, []);

  return (
    <VoiceContext.Provider
      value={{
        enabled,
        toggleVoice,
        audioPlayer: audioPlayerRef.current,
        playbackRate,
        setPlaybackRate: handleSetPlaybackRate,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}
