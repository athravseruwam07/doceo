"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LessonStep, ChatMessage as ChatMessageType } from "@/lib/types";
import { stepsToTimeline } from "@/lib/timeline";
import { useAnimationPlayer } from "@/hooks/useAnimationPlayer";
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

  // Auto-play when events first become available
  useEffect(() => {
    if (events.length > 0 && player.state.status === "loading") {
      player.play();
    }
  }, [events.length, player.state.status, player.play]);

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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [player, chatOpen]);

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
        state={player.state}
        onPlay={player.play}
        onPause={player.pause}
        onResume={player.resume}
        onInterrupt={handleInterrupt}
        onSetSpeed={player.setSpeed}
      />
    </div>
  );
}
