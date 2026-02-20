"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChatContextPayload, LessonStep, ChatMessage as ChatMessageType, TimelineSegment, VoiceStatus } from "@/lib/types";
import { eventsToSegments, stepsToSegments } from "@/lib/timeline";
import { inferCurrentBoardPage, planInterruptionSegments, planSegmentsForBoard } from "@/lib/boardPlan";
import { getVoiceHealth } from "@/lib/api";
import { useSegmentPlayer } from "@/hooks/useSegmentPlayer";
import { useVoicePlayer } from "@/hooks/useVoicePlayer";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import WhiteboardCanvas from "./WhiteboardCanvas";
import PlayerControls from "./PlayerControls";
import ChatSidebar from "../chat/ChatSidebar";

interface PlayerShellProps {
  sessionId: string;
  steps: LessonStep[];
  messages: ChatMessageType[];
  chatLoading: boolean;
  onSendMessage: (message: string, context?: ChatContextPayload) => Promise<void>;
  voiceStatus?: VoiceStatus;
  problemText?: string;
}

interface InjectedSegments {
  id: string;
  insertAt: number;
  segments: TimelineSegment[];
}

function ensureTemporaryCleanup(segments: TimelineSegment[]): TimelineSegment[] {
  const tempVisualIds = new Set<string>();
  const clearedIds = new Set<string>();

  for (const segment of segments) {
    for (const visual of segment.visuals) {
      if (
        visual.payload.temporary &&
        visual.type !== "annotate" &&
        visual.type !== "clear_section" &&
        visual.type !== "pause" &&
        visual.type !== "step_marker" &&
        visual.type !== "narrate"
      ) {
        tempVisualIds.add(visual.id);
      }
      if (visual.type === "clear_section" && visual.payload.clearTarget === "id" && visual.payload.clearId) {
        clearedIds.add(visual.payload.clearId);
      }
    }
  }

  const missingCleanup = [...tempVisualIds].filter((id) => !clearedIds.has(id));
  if (missingCleanup.length === 0) return segments;

  const cleanupVisuals = missingCleanup.map((id, index) => ({
    id: `cleanup-${id}-${index}`,
    type: "clear_section" as const,
    duration: 220,
    payload: {
      clearTarget: "id" as const,
      clearId: id,
      temporary: true,
    },
  }));

  return [
    ...segments,
    {
      id: `cleanup-seg-${Date.now()}`,
      visuals: cleanupVisuals,
      visualDuration: cleanupVisuals.reduce((sum, v) => sum + v.duration, 0),
      duration: cleanupVisuals.reduce((sum, v) => sum + v.duration, 0),
      stepNumber: segments[segments.length - 1]?.stepNumber ?? 0,
      stepTitle: "Return to lesson",
      isStepStart: false,
    },
  ];
}

const InteractiveLessonStage = dynamic(() => import("./InteractiveLessonStage"), {
  ssr: false,
});

const POST_AUDIO_BUFFER_MS = 140;

function applyInjectedSegments(
  baseSegments: TimelineSegment[],
  batches: InjectedSegments[]
): TimelineSegment[] {
  if (batches.length === 0) return baseSegments;
  const result = [...baseSegments];
  const sorted = [...batches].sort((a, b) => a.insertAt - b.insertAt);
  let offset = 0;
  for (const batch of sorted) {
    const at = Math.max(0, Math.min(result.length, batch.insertAt + offset));
    const tagged = batch.segments.map((segment, idx) => ({
      ...segment,
      id: `${batch.id}-${segment.id}-${idx}`,
    }));
    result.splice(at, 0, ...tagged);
    offset += tagged.length;
  }
  return result;
}

export default function PlayerShell({
  sessionId,
  steps,
  messages,
  chatLoading,
  onSendMessage,
  voiceStatus,
  problemText,
}: PlayerShellProps) {
  const [quickAskOpen, setQuickAskOpen] = useState(false);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [quickQuestion, setQuickQuestion] = useState("");
  const [injectedSegments, setInjectedSegments] = useState<InjectedSegments[]>([]);
  const [healthVoiceStatus, setHealthVoiceStatus] = useState<VoiceStatus | undefined>(undefined);
  const voiceHealthCheckedRef = useRef(false);
  const whiteboardV2Enabled = process.env.NEXT_PUBLIC_WHITEBOARD_V2 === "true";

  // Build segments for playback
  const rawBaseSegments = useMemo(() => stepsToSegments(steps), [steps]);
  const baseSegments = useMemo(
    () => (whiteboardV2Enabled ? planSegmentsForBoard(rawBaseSegments, steps) : rawBaseSegments),
    [rawBaseSegments, steps, whiteboardV2Enabled]
  );
  const injectedTimeline = useMemo(
    () => applyInjectedSegments(baseSegments, injectedSegments),
    [baseSegments, injectedSegments]
  );
  const segments = useMemo(
    () =>
      injectedTimeline.map((segment) => {
        const syncHoldMs = segment.syncHoldMs ?? 0;
        const pacedDuration = Math.max(
          segment.duration,
          (segment.audio?.duration ?? 0) + syncHoldMs + POST_AUDIO_BUFFER_MS
        );
        if (pacedDuration === segment.duration) return segment;
        return { ...segment, duration: pacedDuration };
      }),
    [injectedTimeline]
  );
  const player = useSegmentPlayer(segments);
  const voice = useVoicePlayer();
  const voiceSession = useVoiceSession(sessionId);
  const lastProcessedTutorMessageRef = useRef<number>(-1);
  const playerStatus = player.state.status;
  const playerPlay = player.play;
  const shouldProbeVoice = !voiceStatus || voiceStatus === "unknown";
  const resolvedVoiceStatus = useMemo(() => {
    if (voiceStatus && voiceStatus !== "unknown") return voiceStatus;
    return healthVoiceStatus ?? voiceStatus;
  }, [voiceStatus, healthVoiceStatus]);

  useEffect(() => {
    if (!shouldProbeVoice) return;
    if (voiceHealthCheckedRef.current) return;
    voiceHealthCheckedRef.current = true;
    let active = true;
    getVoiceHealth()
      .then((result) => {
        if (!active) return;
        const status = result.status;
        if (
          status === "ok" ||
          status === "missing_tts_permission" ||
          status === "unauthorized" ||
          status === "rate_limited" ||
          status === "unknown"
        ) {
          setHealthVoiceStatus(status);
        } else {
          setHealthVoiceStatus("unknown");
        }
      })
      .catch(() => {
        if (!active) return;
        setHealthVoiceStatus("unknown");
      });
    return () => {
      active = false;
    };
  }, [shouldProbeVoice]);

  // Track which segment INDEX we last started playing audio for
  const lastAudioSegIdxRef = useRef<number>(-1);
  const prevStatusRef = useRef(player.state.status);

  // Stable references from voice hook for useEffect dependencies
  const voiceEnabled = voice.enabled;
  const voicePlayAudio = voice.playAudio;
  const voicePreload = voice.preloadAudio;
  const voicePause = voice.pauseAudio;
  const voiceResume = voice.resumeAudio;
  const voiceSetSpeed = voice.setSpeed;
  const voiceToggle = voice.toggleVoice;
  const voiceCancelSpeech = voice.cancelSpeech;
  const onAudioEnded = player.onAudioEnded;
  const resolvedProblemText = problemText?.trim() ? problemText : undefined;

  // Inject interruption visuals from tutor chat messages into playback queue.
  useEffect(() => {
    const lastIndex = messages.length - 1;
    if (lastIndex < 0) return;
    if (lastIndex <= lastProcessedTutorMessageRef.current) return;
    lastProcessedTutorMessageRef.current = lastIndex;

    const message = messages[lastIndex];
    if (message.role !== "tutor" || !message.events || message.events.length === 0) return;

    const miniSegments = ensureTemporaryCleanup(eventsToSegments(message.events));
    if (miniSegments.length === 0) return;
    const currentBoardPage = whiteboardV2Enabled
      ? inferCurrentBoardPage(segments, player.state.currentSegmentIndex)
      : 0;
    const plannedMiniSegments = whiteboardV2Enabled
      ? planInterruptionSegments(miniSegments, currentBoardPage)
      : miniSegments;

    const insertAt = Math.max(0, player.state.currentSegmentIndex + 1);
    const batchId = `interrupt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    queueMicrotask(() => {
      setInjectedSegments((prev) => [
        ...prev,
        { id: batchId, insertAt, segments: plannedMiniSegments },
      ]);
    });
  }, [messages, player.state.currentSegmentIndex, segments, whiteboardV2Enabled]);

  // Auto-play when segments first become available
  useEffect(() => {
    if (segments.length > 0 && playerStatus === "loading") {
      lastAudioSegIdxRef.current = -1;
      playerPlay();
    }
  }, [segments.length, playerStatus, playerPlay]);

  // ─── Voice: Play audio when segment INDEX changes ───
  // Uses generated narration audio URL when available, falls back to browser TTS
  const currentSegIdx = player.state.currentSegmentIndex;
  useEffect(() => {
    if (currentSegIdx < 0 || currentSegIdx >= segments.length) return;
    if (!voiceEnabled) {
      lastAudioSegIdxRef.current = currentSegIdx;
      onAudioEnded();
      return;
    }
    if (currentSegIdx === lastAudioSegIdxRef.current) return;

    const segment = segments[currentSegIdx];
    if (!segment.audio) {
      lastAudioSegIdxRef.current = currentSegIdx;
      onAudioEnded();
      return;
    }

    lastAudioSegIdxRef.current = currentSegIdx;

    voicePlayAudio(
      segment.audio.eventId,
      segment.audio.url,
      segment.audio.duration / 1000,
      undefined,
      () => onAudioEnded()
    );
  }, [currentSegIdx, segments, voiceEnabled, voicePlayAudio, onAudioEnded]);

  // ─── Voice: Preload upcoming segments' audio ───
  useEffect(() => {
    if (!voiceEnabled) return;
    if (currentSegIdx < 0) return;

    let preloaded = 0;
    for (let i = currentSegIdx + 1; i < segments.length && preloaded < 3; i++) {
      const seg = segments[i];
      if (seg.audio?.url) {
        voicePreload(seg.audio.eventId, seg.audio.url);
        preloaded++;
      }
    }
  }, [currentSegIdx, voiceEnabled, voicePreload, segments]);

  // ─── Voice: Sync pause/resume ───
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    const currStatus = player.state.status;
    prevStatusRef.current = currStatus;

    if (
      prevStatus === "playing" &&
      (currStatus === "paused" || currStatus === "interrupted")
    ) {
      voicePause();
    }

    if (
      (prevStatus === "paused" || prevStatus === "interrupted") &&
      currStatus === "playing"
    ) {
      voiceResume();
    }
  }, [player.state.status, voicePause, voiceResume]);

  // ─── Voice: Sync playback speed ───
  useEffect(() => {
    voiceSetSpeed(player.state.speed);
  }, [player.state.speed, voiceSetSpeed]);

  // Keyboard shortcuts
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
          if (chatDrawerOpen) setChatDrawerOpen(false);
          player.resume();
        }
      }

      if (e.code === "Escape" && chatDrawerOpen) {
        setChatDrawerOpen(false);
        return;
      }

      if (e.code === "Escape" && quickAskOpen) {
        setQuickAskOpen(false);
        if (player.state.status === "interrupted") player.resume();
      }

      // M key toggles voice mute/unmute
      if (e.code === "KeyM") {
        e.preventDefault();
        voiceToggle();
      }

      // Arrow keys for segment navigation
      if (e.code === "ArrowRight") {
        e.preventDefault();
        const nextIdx = player.state.currentSegmentIndex + 1;
        if (nextIdx < segments.length) {
          player.seekToSegment(nextIdx);
        }
      }

      if (e.code === "ArrowLeft") {
        e.preventDefault();
        const prevIdx = player.state.currentSegmentIndex - 1;
        if (prevIdx >= 0) {
          player.seekToSegment(prevIdx);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [player, chatDrawerOpen, quickAskOpen, voiceToggle, segments.length]);

  const handleReplay = useCallback(() => {
    lastAudioSegIdxRef.current = -1;
    setInjectedSegments([]);
    lastProcessedTutorMessageRef.current = messages.length - 1;
    voiceCancelSpeech();
    player.play();
  }, [messages.length, player, voiceCancelSpeech]);

  const handleInterrupt = useCallback(() => {
    voiceCancelSpeech();
    player.interrupt();
    setQuickAskOpen(true);
  }, [player, voiceCancelSpeech]);

  const handleContinue = useCallback(() => {
    setQuickAskOpen(false);
    setChatDrawerOpen(false);
    player.resume();
  }, [player]);

  const handleCloseChat = useCallback(() => {
    setChatDrawerOpen(false);
  }, []);

  const handleSeek = useCallback((segmentIndex: number) => {
    // Reset audio tracking so the target segment's audio plays
    lastAudioSegIdxRef.current = -1;
    voiceCancelSpeech();
    player.seekToSegment(segmentIndex);
  }, [player, voiceCancelSpeech]);

  const handleQuickAskSend = useCallback(async () => {
    const msg = quickQuestion.trim();
    if (!msg || chatLoading) return;
    const context: ChatContextPayload = {
      currentStep: player.state.currentStep > 0 ? player.state.currentStep : undefined,
      currentStepTitle: player.currentSegment?.stepTitle,
      currentEventType: player.activeVisual?.type,
      activeNarration: player.currentSegment?.audio?.text,
    };
    await onSendMessage(msg, context);
    setQuickQuestion("");
  }, [quickQuestion, chatLoading, onSendMessage, player.activeVisual, player.currentSegment, player.state.currentStep]);

  const handleSendChatMessage = useCallback(
    async (message: string) => {
      const context: ChatContextPayload = {
        currentStep: player.state.currentStep > 0 ? player.state.currentStep : undefined,
        currentStepTitle: player.currentSegment?.stepTitle,
        currentEventType: player.activeVisual?.type,
        activeNarration: player.currentSegment?.audio?.text,
      };
      await onSendMessage(message, context);
    },
    [onSendMessage, player.activeVisual, player.currentSegment, player.state.currentStep]
  );

  const handleUserInteractionStart = useCallback(() => {
    if (player.state.status === "playing") {
      player.interrupt();
    }
  }, [player]);

  const handleVoiceStart = useCallback(() => {
    handleUserInteractionStart();
    voiceSession.sendSpeechStart();
  }, [handleUserInteractionStart, voiceSession]);

  const handleVoiceEnd = useCallback(() => {
    voiceSession.sendSpeechEnd();
  }, [voiceSession]);

  const handleVoiceTranscript = useCallback(
    async (text: string, isFinal: boolean) => {
      voiceSession.sendTranscript(text, isFinal);
      if (isFinal && text.trim()) {
        await handleSendChatMessage(text.trim());
      }
    },
    [handleSendChatMessage, voiceSession]
  );

  const latestTutorMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === "tutor"),
    [messages]
  );

  // Build player state with voice enabled flag for the controls bar
  const playerStateWithVoice = useMemo(
    () => ({ ...player.state, voiceEnabled: voiceEnabled }),
    [player.state, voiceEnabled]
  );

  const voiceNotice = useMemo(() => {
    if (!resolvedVoiceStatus || resolvedVoiceStatus === "ok" || resolvedVoiceStatus === "unknown") return null;
    if (resolvedVoiceStatus === "missing_tts_permission") {
      return "Voice disabled: active TTS key is missing text_to_speech permission.";
    }
    if (resolvedVoiceStatus === "unauthorized") {
      return "Voice disabled: TTS provider rejected the current API key.";
    }
    if (resolvedVoiceStatus === "rate_limited") {
      return "Voice limited: TTS provider rate limit reached. Retrying automatically.";
    }
    return "Voice narration is currently unavailable. Lesson visuals continue normally.";
  }, [resolvedVoiceStatus]);

  const currentChainId = useMemo(() => {
    if (player.activeVisual?.payload.transformChainId) {
      return player.activeVisual.payload.transformChainId;
    }
    for (let i = player.completedVisuals.length - 1; i >= 0; i -= 1) {
      const chainId = player.completedVisuals[i].payload.transformChainId;
      if (chainId) return chainId;
    }
    return undefined;
  }, [player.activeVisual, player.completedVisuals]);

  const handleReplayCurrentChain = useCallback(() => {
    if (!currentChainId) return;
    const chainStart = segments.findIndex((segment) =>
      segment.visuals.some((visual) => visual.payload.transformChainId === currentChainId)
    );
    if (chainStart < 0) return;
    lastAudioSegIdxRef.current = -1;
    voiceCancelSpeech();
    player.seekToSegment(chainStart);
  }, [currentChainId, segments, player, voiceCancelSpeech]);

  return (
    <div className="h-screen flex flex-col bg-[var(--cream)]">
      <div className="mx-3 mt-3 mb-0 z-30 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--paper)]/90 px-2 py-1.5 backdrop-blur-sm shadow-[var(--shadow-sm)]">
        <Link href="/app" className="px-2 py-1 text-[12px] text-[var(--ink-secondary)] hover:text-[var(--ink)]">
          Home
        </Link>
        <Link href="/exam-cram" className="px-2 py-1 text-[12px] text-[var(--ink-secondary)] hover:text-[var(--ink)]">
          Cram
        </Link>
        <Link href="/history" className="px-2 py-1 text-[12px] text-[var(--ink-secondary)] hover:text-[var(--ink)]">
          History
        </Link>
      </div>
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        <motion.div className="relative flex-1 p-3 overflow-hidden">
          {voiceNotice && (
            <div className="absolute top-3 right-4 z-20 max-w-[320px] rounded-xl border border-[var(--error)]/35 bg-[var(--paper)]/96 px-3 py-2 text-[12px] text-[var(--error)] shadow-[var(--shadow-sm)] backdrop-blur-sm">
              {voiceNotice}
            </div>
          )}
          {whiteboardV2Enabled ? (
            <InteractiveLessonStage
              completedVisuals={player.completedVisuals}
              activeVisual={player.activeVisual}
              activeVisualProgress={player.activeVisualProgress}
              currentSegment={player.currentSegment}
              isPlaying={player.state.status === "playing"}
              problemText={resolvedProblemText}
            />
          ) : (
            <WhiteboardCanvas
              completedVisuals={player.completedVisuals}
              activeVisual={player.activeVisual}
              activeVisualProgress={player.activeVisualProgress}
              currentSegment={player.currentSegment}
              isPlaying={player.state.status === "playing"}
            />
          )}

          <AnimatePresence>
            {quickAskOpen && (
              <motion.div
                className="absolute bottom-5 right-5 z-20 w-[min(460px,calc(100%-2.5rem))] rounded-2xl border border-[var(--border)] bg-[var(--paper)]/95 backdrop-blur-md shadow-[var(--shadow-lg)]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="px-4 pt-3 pb-2 border-b border-[var(--border)]">
                  <p className="text-[13px] font-semibold text-[var(--ink)] font-[family-name:var(--font-heading)]">
                    Ask while we pause
                  </p>
                  <p className="text-[11px] text-[var(--ink-tertiary)] font-[family-name:var(--font-body)]">
                    Get a quick explanation, then continue the lesson.
                  </p>
                </div>

                {latestTutorMessage && (
                  <div className="px-4 pt-3">
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--paper-warm)] px-3 py-2">
                      <p className="text-[11px] text-[var(--ink-tertiary)] mb-1 font-medium">Tutor</p>
                      <p className="text-[12px] text-[var(--ink-secondary)] leading-relaxed line-clamp-4">
                        {latestTutorMessage.message}
                      </p>
                    </div>
                  </div>
                )}

                <div className="px-4 py-3">
                  <textarea
                    value={quickQuestion}
                    onChange={(e) => setQuickQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleQuickAskSend();
                      }
                    }}
                    rows={2}
                    placeholder="Ask about this exact step..."
                    className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--emerald)]/25"
                  />
                </div>

                <div className="flex items-center justify-between px-4 pb-3">
                  <button
                    onClick={() => setChatDrawerOpen(true)}
                    className="text-[12px] text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors"
                  >
                    Open full chat
                  </button>
                  <div className="flex items-center gap-2">
                    {player.state.status === "interrupted" && (
                      <button
                        onClick={handleContinue}
                        className="px-3 py-1.5 text-[12px] rounded-lg border border-[var(--border)] text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)] transition-colors"
                      >
                        Continue lesson
                      </button>
                    )}
                    <button
                      onClick={() => void handleQuickAskSend()}
                      disabled={!quickQuestion.trim() || chatLoading}
                      className="px-3 py-1.5 text-[12px] rounded-lg bg-[var(--emerald)] text-white hover:bg-[var(--emerald-light)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {chatLoading ? "Thinking..." : "Ask"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Chat sidebar — desktop */}
        <AnimatePresence>
          {chatDrawerOpen && (
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
                  onUserInteractionStart={handleUserInteractionStart}
                  onVoiceStart={handleVoiceStart}
                  onVoiceEnd={handleVoiceEnd}
                  onVoiceTranscript={handleVoiceTranscript}
                  onClose={handleCloseChat}
                  isInterrupted={player.state.status === "interrupted"}
                  onContinue={handleContinue}
                  voiceNotice={voiceNotice}
                  voiceEnabled={voiceEnabled}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat — mobile overlay */}
        <AnimatePresence>
          {chatDrawerOpen && (
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
                onUserInteractionStart={handleUserInteractionStart}
                onVoiceStart={handleVoiceStart}
                onVoiceEnd={handleVoiceEnd}
                onVoiceTranscript={handleVoiceTranscript}
                onClose={handleCloseChat}
                isMobileOverlay
                isInterrupted={player.state.status === "interrupted"}
                onContinue={handleContinue}
                voiceNotice={voiceNotice}
                voiceEnabled={voiceEnabled}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls bar */}
      <PlayerControls
        state={playerStateWithVoice}
        segmentCount={segments.length}
        onPlay={handleReplay}
        onPause={player.pause}
        onResume={player.resume}
        onInterrupt={handleInterrupt}
        onSetSpeed={player.setSpeed}
        onToggleVoice={voiceToggle}
        onSeek={handleSeek}
        onReplayChain={handleReplayCurrentChain}
        canReplayChain={Boolean(currentChainId)}
      />
    </div>
  );
}
