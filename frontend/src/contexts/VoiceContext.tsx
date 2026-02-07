"use client";

import React, { createContext, useState, useCallback, useRef } from "react";
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

  const toggleVoice = useCallback(() => {
    setEnabled((prev) => !prev);
    // Save preference to localStorage
    localStorage.setItem("doceo-voice-enabled", JSON.stringify(!enabled));
  }, [enabled]);

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
