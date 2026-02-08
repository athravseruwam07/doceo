"use client";

import { useContext, useCallback, useRef, useEffect } from "react";
import { VoiceContext } from "@/contexts/VoiceContext";

export function useVoicePlayer() {
  const context = useContext(VoiceContext);

  // Extract values — use defaults when context is unavailable (SSR/outside provider)
  const enabled = context?.enabled ?? true;
  const toggleVoice = context?.toggleVoice;
  const audioPlayer = context?.audioPlayer ?? null;
  const playbackRate = context?.playbackRate ?? 1;
  const setPlaybackRate = context?.setPlaybackRate;

  // Track current speech synthesis utterance for pause/resume/cancel
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeakingRef = useRef(false);
  // Store text & rate so we can re-speak on resume (pause/resume is unreliable)
  const pendingTextRef = useRef<string | null>(null);
  const pendingRateRef = useRef(1);

  // Preload browser voices (Chrome loads them async)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        console.log(`[Voice] Browser TTS: ${voices.length} voices loaded`);
      }
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  /**
   * Cancel any active browser TTS
   */
  const cancelSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    isSpeakingRef.current = false;
    pendingTextRef.current = null;
  }, []);

  /**
   * Speak text using browser Web Speech API (fallback when no audio URL)
   */
  const speakText = useCallback(
    (text: string, rate: number = 1) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        console.warn("[Voice] speechSynthesis not available");
        return;
      }
      // Cancel any in-progress speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.5, Math.min(2, rate));
      utterance.pitch = 1;
      utterance.volume = 1;

      // Pick a good English voice.
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") ||
            v.name.includes("Samantha") ||
            v.name.includes("Daniel") ||
            v.name.includes("Natural"))
      );
      if (preferred) {
        utterance.voice = preferred;
      } else {
        const english = voices.find((v) => v.lang.startsWith("en"));
        if (english) utterance.voice = english;
      }

      utterance.onend = () => {
        isSpeakingRef.current = false;
        utteranceRef.current = null;
        pendingTextRef.current = null;
      };
      utterance.onerror = () => {
        isSpeakingRef.current = false;
        utteranceRef.current = null;
        pendingTextRef.current = null;
      };

      utteranceRef.current = utterance;
      isSpeakingRef.current = true;
      pendingTextRef.current = text;
      pendingRateRef.current = rate;
      window.speechSynthesis.speak(utterance);
      console.log(`[Voice] Speaking via browser TTS (rate=${rate}): "${text.slice(0, 60)}..."`);
    },
    []
  );

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
   * Play audio for a narrate event. If audioUrl is available, uses AudioSyncPlayer.
   * If no audioUrl but fallbackText is provided, uses browser Speech Synthesis.
   */
  const playAudio = useCallback(
    async (
      eventId: string,
      audioUrl: string | null | undefined,
      _duration: number,
      fallbackText?: string
    ) => {
      if (!enabled) {
        console.log(`[Voice] playAudio: voice disabled, skipping ${eventId}`);
        return;
      }

      // Path 1: ElevenLabs audio URL available
      if (audioUrl && audioPlayer) {
        console.log(`[Voice] Playing ElevenLabs audio for ${eventId}: ${audioUrl}`);
        try {
          await audioPlayer.preloadSegment(eventId, audioUrl);
          await audioPlayer.playSegment(eventId, audioUrl);
          console.log(`[Voice] ElevenLabs playback succeeded for ${eventId}`);
        } catch (error) {
          console.error(`[Voice] ElevenLabs playback failed for ${eventId}:`, error);
          // Fall through to browser TTS
          if (fallbackText) {
            console.log(`[Voice] Falling back to browser TTS for ${eventId}`);
            speakText(fallbackText, playbackRate);
          }
        }
        return;
      }

      // Path 2: No audio URL — use browser TTS fallback
      if (fallbackText) {
        console.log(`[Voice] No audio URL for ${eventId}, using browser TTS`);
        speakText(fallbackText, playbackRate);
        return;
      }

      console.warn(`[Voice] No audio URL and no fallback text for ${eventId}`);
    },
    [enabled, audioPlayer, speakText, playbackRate]
  );

  /**
   * Pause audio playback (both AudioSyncPlayer and speech synthesis)
   */
  const pauseAudio = useCallback(() => {
    if (audioPlayer) {
      audioPlayer.pause();
    }
    if (typeof window !== "undefined" && window.speechSynthesis && isSpeakingRef.current) {
      window.speechSynthesis.pause();
    }
  }, [audioPlayer]);

  /**
   * Resume audio playback (both AudioSyncPlayer and speech synthesis)
   */
  const resumeAudio = useCallback(() => {
    if (audioPlayer) {
      audioPlayer.resume();
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
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
      // Speech synthesis rate can't be changed mid-utterance;
      // it will apply to the next speakText call
    },
    [setPlaybackRate]
  );

  const handleToggleVoice = useCallback(() => {
    if (toggleVoice) {
      toggleVoice();
    }
    // If disabling voice, cancel any speech synthesis
    if (enabled) {
      cancelSpeech();
    }
  }, [toggleVoice, enabled, cancelSpeech]);

  return {
    enabled,
    toggleVoice: handleToggleVoice,
    playbackRate,
    preloadAudio,
    playAudio,
    pauseAudio,
    resumeAudio,
    setSpeed,
    cancelSpeech,
  };
}
