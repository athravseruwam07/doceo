"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { AnimationEvent, ChatMessage } from "@/lib/types";
import { useAnimationPlayer } from "@/hooks/useAnimationPlayer";
import AnimatedEquation from "./AnimatedEquation";
import AnimatedText from "./AnimatedText";

interface SidePanelWorkProps {
  message: ChatMessage;
  voiceEnabled: boolean;
}

function estimateDuration(text: string, minimum = 900, maximum = 4200): number {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return minimum;
  const estimated = clean.length * 22;
  return Math.max(minimum, Math.min(maximum, estimated));
}

function buildFallbackEvents(message: ChatMessage): AnimationEvent[] {
  const events: AnimationEvent[] = [];

  if (message.related_step) {
    events.push({
      id: `fallback-step-${message.related_step}`,
      type: "step_marker",
      duration: 320,
      payload: {
        stepNumber: message.related_step,
        stepTitle: `Step ${message.related_step}`,
        position: "side",
      },
    });
  }

  if (message.narration) {
    events.push({
      id: `fallback-narrate-${message.related_step ?? "x"}`,
      type: "narrate",
      duration: estimateDuration(message.narration, 1200, 6500),
      payload: {
        text: message.narration,
        position: "side",
      },
    });
  }

  if (message.message) {
    events.push({
      id: `fallback-text-${message.related_step ?? "x"}`,
      type: "write_text",
      duration: estimateDuration(message.message),
      payload: {
        text: message.message,
        position: "side",
      },
    });
  }

  for (const [index, block] of (message.math_blocks ?? []).entries()) {
    if (!block?.latex) continue;
    events.push({
      id: `fallback-math-${index}-${message.related_step ?? "x"}`,
      type: "write_equation",
      duration: estimateDuration(block.latex, 1400, 3000),
      payload: {
        latex: block.latex,
        display: block.display,
        position: "side",
      },
    });
  }

  if (events.length > 0) {
    events.push({
      id: `fallback-pause-${message.related_step ?? "x"}`,
      type: "pause",
      duration: 650,
      payload: { position: "side" },
    });
  }

  return events;
}

export default function SidePanelWork({ message, voiceEnabled }: SidePanelWorkProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedRef = useRef<string>("");
  const events = useMemo(
    () => (message.events && message.events.length > 0 ? message.events : buildFallbackEvents(message)),
    [message]
  );
  const player = useAnimationPlayer(events);
  const playbackKey = `${message.created_at ?? ""}:${message.message}`;

  useEffect(() => {
    if (events.length === 0) return;
    if (lastPlayedRef.current === playbackKey) return;
    lastPlayedRef.current = playbackKey;
    player.play();
  }, [events, playbackKey, player.play, player]);

  useEffect(() => {
    if (audioRef.current && !voiceEnabled) {
      audioRef.current.pause();
    }
  }, [voiceEnabled]);

  useEffect(() => {
    if (!voiceEnabled || !message.audio_url) return;

    const audio = new Audio(message.audio_url);
    audioRef.current = audio;
    void audio.play().catch(() => {
      // Autoplay may be blocked by browser policy.
    });

    return () => {
      audio.pause();
      audio.currentTime = 0;
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, [message.audio_url, message.created_at, voiceEnabled]);

  const renderedEvents = useMemo(() => {
    const visible = player.visibleEvents.filter(
      (event) => event.type === "write_equation" || event.type === "write_text"
    );

    if (
      player.activeEvent &&
      (player.activeEvent.type === "write_equation" ||
        player.activeEvent.type === "write_text")
    ) {
      return [...visible, player.activeEvent];
    }
    return visible;
  }, [player.visibleEvents, player.activeEvent]);

  const narration = useMemo(() => {
    if (player.activeEvent?.type === "narrate") {
      return player.activeEvent.payload.text ?? "";
    }
    for (let i = player.visibleEvents.length - 1; i >= 0; i--) {
      if (player.visibleEvents[i].type === "narrate") {
        return player.visibleEvents[i].payload.text ?? "";
      }
    }
    return message.narration ?? "";
  }, [player.activeEvent, player.visibleEvents, message.narration]);

  return (
    <motion.div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--paper-warm)]">
        <p className="text-[11px] font-medium text-[var(--ink-tertiary)] tracking-wide uppercase font-[family-name:var(--font-body)]">
          Side Work
        </p>
        {message.related_step ? (
          <p className="mt-1 text-[13px] text-[var(--ink-secondary)] font-[family-name:var(--font-body)]">
            Your question about Step {message.related_step}
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-[var(--ink-secondary)] font-[family-name:var(--font-body)]">
            Follow-up explanation
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto whiteboard-grid bg-[var(--cream)]">
        <div className="p-4 space-y-3">
          {renderedEvents.map((event, index) => {
            if (event.type === "write_equation") {
              return (
                <motion.div
                  key={`${event.id}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  <AnimatedEquation
                    latex={event.payload.latex || ""}
                    duration={event.duration}
                    isAnimating={
                      player.activeEvent?.id === event.id &&
                      player.state.status === "playing"
                    }
                    display={event.payload.display ?? true}
                  />
                </motion.div>
              );
            }

            if (event.type === "write_text") {
              return (
                <motion.div
                  key={`${event.id}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  <AnimatedText
                    text={event.payload.text || ""}
                    duration={event.duration}
                    isAnimating={
                      player.activeEvent?.id === event.id &&
                      player.state.status === "playing"
                    }
                  />
                </motion.div>
              );
            }

            return null;
          })}

          {narration && (
            <motion.div
              className="mt-4 rounded-[var(--radius-md)] border border-[var(--emerald-light)] bg-[var(--emerald-subtle)]/70 p-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-[13px] text-[var(--ink-secondary)] leading-relaxed font-[family-name:var(--font-body)]">
                {narration}
              </p>
            </motion.div>
          )}

          {renderedEvents.length === 0 && !narration && (
            <div className="py-12 text-center">
              <p className="text-[13px] text-[var(--ink-faint)] font-[family-name:var(--font-body)]">
                Waiting for tutor response...
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
