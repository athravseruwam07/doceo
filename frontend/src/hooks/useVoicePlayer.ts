"use client";

import { useContext, useCallback } from "react";
import { VoiceContext } from "@/contexts/VoiceContext";

export function useVoicePlayer() {
  const context = useContext(VoiceContext);

  // Extract values — use defaults when context is unavailable (SSR/outside provider)
  const enabled = context?.enabled ?? true;
  const toggleVoice = context?.toggleVoice;
  const audioPlayer = context?.audioPlayer ?? null;
  const playbackRate = context?.playbackRate ?? 1;
  const setPlaybackRate = context?.setPlaybackRate;

  /**
   * Preload audio for an upcoming narrate event
   */
  const preloadAudio = useCallback(
    async (eventId: string, audioUrl: string | null | undefined) => {
      if (!audioPlayer || !audioUrl) return;
      try {
        await audioPlayer.preloadSegment(eventId, audioUrl);
      } catch (error) {
        console.error("Error preloading audio:", error);
      }
    },
    [audioPlayer]
  );

  /**
   * Play audio for a narrate event. Fire-and-forget — the animation player
   * handles timing via its own setTimeout. This just plays the audio alongside.
   */
  const playAudio = useCallback(
    async (
      eventId: string,
      audioUrl: string | null | undefined,
      _duration: number
    ) => {
      if (!enabled || !audioPlayer || !audioUrl) {
        console.log(`[Voice] playAudio skipped: enabled=${enabled} player=${!!audioPlayer} url=${!!audioUrl}`);
        return;
      }

      console.log(`[Voice] playAudio called for ${eventId}: ${audioUrl}`);

      try {
        // Preload if not already loaded
        await audioPlayer.preloadSegment(eventId, audioUrl);
        // Play — passes audioUrl as fallback for on-the-fly creation
        await audioPlayer.playSegment(eventId, audioUrl);
      } catch (error) {
        console.error("[Voice] Error playing audio:", error);
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
      if (setPlaybackRate) {
        setPlaybackRate(speed);
      }
    },
    [setPlaybackRate]
  );

  const handleToggleVoice = useCallback(() => {
    if (toggleVoice) {
      toggleVoice();
    }
  }, [toggleVoice]);

  return {
    enabled,
    toggleVoice: handleToggleVoice,
    playbackRate,
    preloadAudio,
    playAudio,
    pauseAudio,
    resumeAudio,
    setSpeed,
  };
}
