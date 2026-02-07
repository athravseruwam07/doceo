"use client";

import { useContext, useCallback } from "react";
import { VoiceContext } from "@/contexts/VoiceContext";

export function useVoicePlayer() {
  const context = useContext(VoiceContext);

  // Return default context during hydration/SSR
  if (context === undefined) {
    return {
      enabled: true,
      playbackRate: 1,
      preloadAudio: async () => {},
      playAudio: async () =>
        new Promise((resolve) => {
          setTimeout(resolve, 0);
        }),
      pauseAudio: () => {},
      resumeAudio: () => {},
      setSpeed: () => {},
      onAudioComplete: () => {},
    };
  }

  const { enabled, audioPlayer, playbackRate, setPlaybackRate } = context;

  /**
   * Preload audio for a lesson step
   */
  const preloadAudio = useCallback(
    async (eventId: string, audioUrl: string | null | undefined) => {
      if (!enabled || !audioPlayer || !audioUrl) {
        return;
      }
      try {
        await audioPlayer.preloadSegment(eventId, audioUrl);
      } catch (error) {
        console.error("Error preloading audio:", error);
      }
    },
    [enabled, audioPlayer]
  );

  /**
   * Play audio for a lesson step
   */
  const playAudio = useCallback(
    async (
      eventId: string,
      audioUrl: string | null | undefined,
      duration: number
    ) => {
      if (!enabled || !audioPlayer) {
        // Return a promise that resolves after duration
        return new Promise((resolve) => {
          setTimeout(resolve, duration * 1000);
        });
      }

      if (!audioUrl) {
        // No audio URL, just wait for duration
        return new Promise((resolve) => {
          setTimeout(resolve, duration * 1000);
        });
      }

      try {
        // Ensure segment is preloaded
        if (!audioPlayer.getIsPlaying()) {
          await audioPlayer.preloadSegment(eventId, audioUrl);
        }
        return await audioPlayer.playSegment(eventId, duration);
      } catch (error) {
        console.error("Error playing audio:", error);
        // Fallback: wait for duration
        return new Promise((resolve) => {
          setTimeout(resolve, duration * 1000);
        });
      }
    },
    [enabled, audioPlayer]
  );

  /**
   * Pause audio playback
   */
  const pauseAudio = useCallback(() => {
    if (audioPlayer) {
      audioPlayer.pause();
    }
  }, [audioPlayer]);

  /**
   * Resume audio playback
   */
  const resumeAudio = useCallback(() => {
    if (audioPlayer) {
      audioPlayer.resume();
    }
  }, [audioPlayer]);

  /**
   * Set audio playback speed
   */
  const setSpeed = useCallback(
    (speed: number) => {
      setPlaybackRate(speed);
    },
    [setPlaybackRate]
  );

  /**
   * Register callback for when audio segment ends
   */
  const onAudioComplete = useCallback(
    (callback: (eventId: string) => void) => {
      if (audioPlayer) {
        audioPlayer.onSegmentComplete(callback);
      }
    },
    [audioPlayer]
  );

  return {
    enabled,
    playbackRate,
    preloadAudio,
    playAudio,
    pauseAudio,
    resumeAudio,
    setSpeed,
    onAudioComplete,
  };
}
