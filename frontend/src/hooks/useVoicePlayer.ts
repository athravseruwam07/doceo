"use client";

import { useCallback, useContext } from "react";
import { VoiceContext } from "@/contexts/VoiceContext";

const noop = () => {};
const noopSetRate = () => {};

export function useVoicePlayer() {
  const context = useContext(VoiceContext);

  const enabled = context?.enabled ?? true;
  const toggleVoice = context?.toggleVoice ?? noop;
  const audioPlayer = context?.audioPlayer ?? null;
  const playbackRate = context?.playbackRate ?? 1;
  const setPlaybackRate = context?.setPlaybackRate ?? noopSetRate;

  const preloadAudio = useCallback(
    async (eventId: string, audioUrl: string | null | undefined) => {
      if (!enabled || !audioPlayer || !audioUrl) return;
      try {
        await audioPlayer.preloadSegment(eventId, audioUrl);
      } catch (error) {
        console.error("Error preloading audio:", error);
      }
    },
    [enabled, audioPlayer]
  );

  const playAudio = useCallback(
    async (
      eventId: string,
      audioUrl: string | null | undefined,
      duration: number
    ) => {
      if (!enabled || !audioPlayer || !audioUrl) {
        return new Promise<void>((resolve) => {
          setTimeout(resolve, duration * 1000);
        });
      }

      try {
        if (!audioPlayer.getIsPlaying()) {
          await audioPlayer.preloadSegment(eventId, audioUrl);
        }
        await audioPlayer.playSegment(eventId, duration);
      } catch (error) {
        console.error("Error playing audio:", error);
        return new Promise<void>((resolve) => {
          setTimeout(resolve, duration * 1000);
        });
      }
    },
    [enabled, audioPlayer]
  );

  const pauseAudio = useCallback(() => {
    if (!audioPlayer) return;
    audioPlayer.pause();
  }, [audioPlayer]);

  const resumeAudio = useCallback(() => {
    if (!audioPlayer) return;
    audioPlayer.resume();
  }, [audioPlayer]);

  const setSpeed = useCallback(
    (speed: number) => {
      setPlaybackRate(speed);
    },
    [setPlaybackRate]
  );

  const onAudioComplete = useCallback(
    (callback: (eventId: string) => void) => {
      if (!audioPlayer) return;
      audioPlayer.onSegmentComplete(callback);
    },
    [audioPlayer]
  );

  return {
    enabled,
    toggleVoice,
    playbackRate,
    preloadAudio,
    playAudio,
    pauseAudio,
    resumeAudio,
    setSpeed,
    onAudioComplete,
  };
}
