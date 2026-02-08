"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LessonStep,
  ChatMessage as ChatMessageType,
  ChatContextPayload,
} from "@/lib/types";
import { stepsToTimeline } from "@/lib/timeline";
import { useAnimationPlayer } from "@/hooks/useAnimationPlayer";
import { useTheme } from "@/hooks/useTheme";
import { useVoicePlayer } from "@/hooks/useVoicePlayer";
import WhiteboardCanvas from "./WhiteboardCanvas";
import PlayerControls from "./PlayerControls";
import LessonSummary from "./LessonSummary";
import SidePanelWork from "./SidePanelWork";
import ChatSidebar from "../chat/ChatSidebar";

interface PlayerShellProps {
  sessionId: string;
  title: string;
  subject: string;
  steps: LessonStep[];
  isLessonComplete: boolean;
  messages: ChatMessageType[];
  chatLoading: boolean;
  onSendMessage: (
    message: string,
    context?: ChatContextPayload
  ) => Promise<void>;
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
  const { theme, toggleTheme } = useTheme();
  const voice = useVoicePlayer();

  // Auto-play when events first become available
  useEffect(() => {
    if (events.length > 0 && player.state.status === "loading") {
      player.play();
    }
  }, [events.length, player.state.status, player.play, player]);

  // Get current narration text
  const narration = useMemo(() => {
    // Find the latest narrate event in visibleEvents
    for (let i = player.visibleEvents.length - 1; i >= 0; i--) {
      if (player.visibleEvents[i].type === "narrate") {
        return player.visibleEvents[i].payload.text ?? "";
      }
    }
    // Check active event
    if (player.activeEvent?.type === "narrate") {
      return player.activeEvent.payload.text ?? "";
    }
    return "";
  }, [player.visibleEvents, player.activeEvent]);

  const currentStepTitle = useMemo(() => {
    const step = steps.find((item) => item.step_number === player.state.currentStep);
    return step?.title;
  }, [steps, player.state.currentStep]);

  const latestTutorMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "tutor") {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in chat
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

      if ((e.key === "m" || e.key === "M") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        voice.toggleVoice();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [player, chatOpen, voice]);

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

  const handleSetSpeed = useCallback(
    (speed: number) => {
      player.setSpeed(speed);
      voice.setSpeed(speed);
    },
    [player, voice]
  );

  const handleSendChatMessage = useCallback(
    async (message: string) => {
      const context: ChatContextPayload = {
        currentStep:
          player.state.currentStep > 0 ? player.state.currentStep : undefined,
        currentStepTitle,
        currentEventType: player.activeEvent?.type,
        activeNarration: narration || undefined,
      };
      await onSendMessage(message, context);
    },
    [onSendMessage, player.state.currentStep, player.activeEvent, currentStepTitle, narration]
  );

  const controlsState = useMemo(
    () => ({
      ...player.state,
      voiceEnabled: voice.enabled,
    }),
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
          onSendMessage={(message) => onSendMessage(message)}
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

        {/* Side panel work — desktop */}
        <AnimatePresence>
          {chatOpen && latestTutorMessage?.events?.length ? (
            <motion.div
              className="hidden xl:flex w-[350px] flex-shrink-0 border-l border-[var(--border)] bg-[var(--paper)]"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 350, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-[350px]">
                <SidePanelWork
                  message={latestTutorMessage}
                  voiceEnabled={voice.enabled}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

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
                  onSend={handleSendChatMessage}
                  onClose={handleCloseChat}
                  isInterrupted={player.state.status === "interrupted"}
                  onContinue={handleContinue}
                  voiceEnabled={voice.enabled}
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
                onSend={handleSendChatMessage}
                onClose={handleCloseChat}
                isMobileOverlay
                isInterrupted={player.state.status === "interrupted"}
                onContinue={handleContinue}
                voiceEnabled={voice.enabled}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls bar */}
      <PlayerControls
        state={controlsState}
        onPlay={player.play}
        onPause={player.pause}
        onResume={player.resume}
        onInterrupt={handleInterrupt}
        onSetSpeed={handleSetSpeed}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleVoice={voice.toggleVoice}
      />
    </div>
  );
}
