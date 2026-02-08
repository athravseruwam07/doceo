"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LessonStep, ChatMessage as ChatMessageType } from "@/lib/types";
import { stepsToTimeline } from "@/lib/timeline";
import { useAnimationPlayer } from "@/hooks/useAnimationPlayer";
import { useVoicePlayer } from "@/hooks/useVoicePlayer";
import WhiteboardCanvas from "./WhiteboardCanvas";
import PlayerControls from "./PlayerControls";
import LessonSummary from "./LessonSummary";
import ChatSidebar from "../chat/ChatSidebar";

interface PlayerShellProps {
  sessionId: string;
  title: string;
  subject: string;
  steps: LessonStep[];
  isLessonComplete: boolean;
  messages: ChatMessageType[];
  chatLoading: boolean;
  onSendMessage: (message: string) => Promise<void>;
}

export default function PlayerShell({
  sessionId,
  title,
  subject,
  steps,
  isLessonComplete,
  messages,
  chatLoading,
  onSendMessage,
}: PlayerShellProps) {
  const [chatOpen, setChatOpen] = useState(false);

  const events = useMemo(() => stepsToTimeline(steps), [steps]);
  const player = useAnimationPlayer(events);
  const voice = useVoicePlayer();

  // Track which narrate event we last started playing audio for
  const lastPlayedEventIdRef = useRef<string | null>(null);
  // Track player status to detect pause/resume transitions
  const prevStatusRef = useRef(player.state.status);

  // Auto-play when events first become available
  useEffect(() => {
    if (events.length > 0 && player.state.status === "loading") {
      player.play();
    }
  }, [events.length, player.state.status, player.play]);

  // ─── Voice: Play audio when a narrate event becomes active ───
  const voiceEnabled = voice.enabled;
  const voicePlayAudio = voice.playAudio;
  useEffect(() => {
    const event = player.activeEvent;
    if (!event) return;
    if (!voiceEnabled) return;
    if (event.type !== "narrate") return;
    if (!event.payload.audioUrl) {
      console.log(`[PlayerShell] Narrate event ${event.id} has no audioUrl`);
      return;
    }
    if (event.id === lastPlayedEventIdRef.current) return;

    lastPlayedEventIdRef.current = event.id;
    console.log(`[PlayerShell] Playing audio for narrate event ${event.id}: ${event.payload.audioUrl}`);

    // Fire and forget — animation timing is driven by the player's setTimeout,
    // which already uses the real audio duration set by the backend.
    voicePlayAudio(
      event.id,
      event.payload.audioUrl,
      event.payload.audioDuration || event.duration / 1000
    );
  }, [player.activeEvent, voiceEnabled, voicePlayAudio]);

  // ─── Voice: Preload upcoming narrate events ───
  const voicePreloadAudio = voice.preloadAudio;
  useEffect(() => {
    if (!voiceEnabled) return;
    const currentIdx = player.state.currentEventIndex;
    if (currentIdx < 0) return;

    let preloaded = 0;
    for (let i = currentIdx + 1; i < events.length && preloaded < 3; i++) {
      const ev = events[i];
      if (ev.type === "narrate" && ev.payload.audioUrl) {
        voicePreloadAudio(ev.id, ev.payload.audioUrl);
        preloaded++;
      }
    }
  }, [player.state.currentEventIndex, voiceEnabled, voicePreloadAudio, events]);

  // ─── Voice: Sync pause/resume with animation player ───
  const voicePauseAudio = voice.pauseAudio;
  const voiceResumeAudio = voice.resumeAudio;
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    const currStatus = player.state.status;
    prevStatusRef.current = currStatus;

    // Animation paused/interrupted → pause audio
    if (
      prevStatus === "playing" &&
      (currStatus === "paused" || currStatus === "interrupted")
    ) {
      voicePauseAudio();
    }

    // Animation resumed → resume audio
    if (
      (prevStatus === "paused" || prevStatus === "interrupted") &&
      currStatus === "playing"
    ) {
      voiceResumeAudio();
    }
  }, [player.state.status, voicePauseAudio, voiceResumeAudio]);

  // ─── Voice: Sync playback speed ───
  const voiceSetSpeed = voice.setSpeed;
  useEffect(() => {
    voiceSetSpeed(player.state.speed);
  }, [player.state.speed, voiceSetSpeed]);

  // Get current narration text for display
  const narration = useMemo(() => {
    for (let i = player.visibleEvents.length - 1; i >= 0; i--) {
      if (player.visibleEvents[i].type === "narrate") {
        return player.visibleEvents[i].payload.text ?? "";
      }
    }
    if (player.activeEvent?.type === "narrate") {
      return player.activeEvent.payload.text ?? "";
    }
    return "";
  }, [player.visibleEvents, player.activeEvent]);

  // Keyboard shortcuts
  const voiceToggle = voice.toggleVoice;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (player.state.status === "playing") {
          player.pause();
        } else if (
          player.state.status === "paused" ||
          player.state.status === "interrupted"
        ) {
          if (chatOpen) setChatOpen(false);
          player.resume();
        }
      }

      if (e.code === "Escape" && chatOpen) {
        setChatOpen(false);
        if (player.state.status === "interrupted") {
          player.resume();
        }
      }

      // M key toggles voice mute/unmute
      if (e.code === "KeyM") {
        e.preventDefault();
        voiceToggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [player, chatOpen, voiceToggle]);

  const handleInterrupt = useCallback(() => {
    player.interrupt();
    setChatOpen(true);
  }, [player]);

  const handleContinue = useCallback(() => {
    setChatOpen(false);
    player.resume();
  }, [player]);

  const handleCloseChat = useCallback(() => {
    setChatOpen(false);
    if (player.state.status === "interrupted") {
      player.resume();
    }
  }, [player]);

  // Build player state with voice enabled flag for the controls bar
  const playerStateWithVoice = useMemo(
    () => ({ ...player.state, voiceEnabled: voice.enabled }),
    [player.state, voice.enabled]
  );

  const isComplete = player.state.status === "complete";

  if (isComplete && isLessonComplete) {
    return (
      <div className="h-screen flex flex-col">
        <LessonSummary
          sessionId={sessionId}
          title={title}
          subject={subject}
          events={events}
          messages={messages}
          chatLoading={chatLoading}
          onSendMessage={onSendMessage}
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--cream)]">
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Whiteboard */}
        <motion.div
          className="flex-1 p-3 overflow-hidden"
          animate={{
            marginRight: chatOpen ? 0 : 0,
          }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <WhiteboardCanvas
            visibleEvents={player.visibleEvents}
            activeEvent={player.activeEvent}
            narration={narration}
            isPlaying={player.state.status === "playing"}
          />
        </motion.div>

        {/* Chat sidebar — desktop */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              className="hidden md:flex w-[380px] flex-shrink-0 border-l border-[var(--border)]"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-[380px]">
                <ChatSidebar
                  messages={messages}
                  loading={chatLoading}
                  onSend={onSendMessage}
                  onClose={handleCloseChat}
                  isInterrupted={player.state.status === "interrupted"}
                  onContinue={handleContinue}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat — mobile overlay */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              className="md:hidden fixed inset-0 z-50"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <ChatSidebar
                messages={messages}
                loading={chatLoading}
                onSend={onSendMessage}
                onClose={handleCloseChat}
                isMobileOverlay
                isInterrupted={player.state.status === "interrupted"}
                onContinue={handleContinue}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls bar */}
      <PlayerControls
        state={playerStateWithVoice}
        onPlay={player.play}
        onPause={player.pause}
        onResume={player.resume}
        onInterrupt={handleInterrupt}
        onSetSpeed={player.setSpeed}
        onToggleVoice={voice.toggleVoice}
      />
    </div>
  );
}
