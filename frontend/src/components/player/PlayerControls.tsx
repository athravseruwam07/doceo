"use client";

import { SegmentPlayerState } from "@/lib/types";

interface PlayerControlsProps {
  state: SegmentPlayerState;
  segmentCount: number;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onInterrupt: () => void;
  onSetSpeed: (speed: number) => void;
  onToggleVoice?: () => void;
  onSeek?: (segmentIndex: number) => void;
  onReplayChain?: () => void;
  canReplayChain?: boolean;
  onOpenChat?: () => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5];

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function PlayerControls({
  state,
  segmentCount,
  onPlay,
  onPause,
  onResume,
  onInterrupt,
  onSetSpeed,
  onToggleVoice,
  onSeek,
  onReplayChain,
  canReplayChain = false,
  onOpenChat,
}: PlayerControlsProps) {
  const isPlaying = state.status === "playing";
  const isPaused = state.status === "paused";
  const isComplete = state.status === "complete";

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else if (isPaused) {
      onResume();
    } else if (isComplete) {
      onPlay();
    }
  };

  return (
    <div className="player-controls flex items-center gap-3 px-4 py-3 bg-[var(--paper-warm)] border-t border-[var(--border)]">
      {/* Play/Pause */}
      <button
        onClick={handlePlayPause}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--emerald)] text-white hover:bg-[var(--emerald-light)] transition-colors cursor-pointer"
        aria-label={isComplete ? "Replay" : isPlaying ? "Pause" : "Play"}
      >
        {isComplete ? <ReplayIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* Segmented progress bar */}
      <div className="flex-1 flex items-center gap-3">
        <div className="flex-1 h-2 bg-[var(--cream-dark)] rounded-full overflow-hidden flex">
          {segmentCount > 0 ? (
            Array.from({ length: segmentCount }, (_, i) => {
              const isCurrent = i === state.currentSegmentIndex;
              const isCompleted = i < state.currentSegmentIndex;
              const segProgress = isCurrent ? state.segmentProgress : 0;

              return (
                <button
                  key={i}
                  className="relative h-full cursor-pointer hover:brightness-110 transition-all"
                  style={{
                    flex: 1,
                    marginRight: i < segmentCount - 1 ? 1 : 0,
                  }}
                  onClick={() => onSeek?.(i)}
                  aria-label={`Go to segment ${i + 1}`}
                >
                  <div className="absolute inset-0 bg-[var(--cream-dark)] rounded-sm" />
                  <div
                    className="absolute inset-0 bg-[var(--emerald)] rounded-sm transition-all duration-150"
                    style={{
                      width: isCompleted ? "100%" : isCurrent ? `${segProgress * 100}%` : "0%",
                    }}
                  />
                </button>
              );
            })
          ) : (
            <div
              className="h-full bg-[var(--emerald)] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${state.totalProgress * 100}%` }}
            />
          )}
        </div>
      </div>

      {/* Time display */}
      <span className="text-[12px] text-[var(--ink-tertiary)] font-[family-name:var(--font-body)] whitespace-nowrap tabular-nums">
        {formatTime(state.elapsed)} / {formatTime(state.totalDuration)}
      </span>

      {/* Step indicator */}
      {state.totalSteps > 0 && (
        <span className="text-[12px] text-[var(--ink-tertiary)] font-[family-name:var(--font-body)] whitespace-nowrap">
          Step {state.currentStep} of {state.totalSteps}
        </span>
      )}

      {/* Speed selector */}
      <div className="flex items-center gap-1">
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            onClick={() => onSetSpeed(speed)}
            className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors cursor-pointer font-[family-name:var(--font-body)] ${
              state.speed === speed
                ? "bg-[var(--emerald)] text-white"
                : "text-[var(--ink-tertiary)] hover:text-[var(--ink)] hover:bg-[var(--cream-dark)]"
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

      {/* Voice toggle */}
      {onToggleVoice && (
        <button
          onClick={onToggleVoice}
          className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors cursor-pointer ${
            state.voiceEnabled
              ? "bg-[var(--emerald)] text-white border-[var(--emerald)] shadow-[var(--shadow-sm)]"
              : "bg-[var(--paper)] text-[var(--ink-tertiary)] border-[var(--border)] hover:bg-[var(--cream-dark)]"
          }`}
          aria-label={state.voiceEnabled ? "Mute voice" : "Enable voice"}
          title={state.voiceEnabled ? "Mute" : "Unmute"}
        >
          {state.voiceEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
        </button>
      )}

      {/* Ask actions */}
      <div className="flex items-center gap-2">
        {!isComplete && onReplayChain && (
          <button
            onClick={onReplayChain}
            disabled={!canReplayChain}
            className="px-2.5 py-1.5 text-[12px] rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer font-[family-name:var(--font-body)]"
          >
            Replay chain
          </button>
        )}
        {isComplete ? (
          <button
            onClick={onOpenChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-white bg-[var(--emerald)] rounded-[var(--radius-md)] hover:bg-[var(--emerald-light)] transition-colors cursor-pointer font-[family-name:var(--font-body)]"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1C4.134 1 1 3.91 1 7.5c0 1.47.527 2.83 1.414 3.92L1.5 14.5l3.248-1.2A7.36 7.36 0 008 14c3.866 0 7-2.91 7-6.5S11.866 1 8 1z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <circle cx="5" cy="7.5" r="0.75" fill="currentColor" />
              <circle cx="8" cy="7.5" r="0.75" fill="currentColor" />
              <circle cx="11" cy="7.5" r="0.75" fill="currentColor" />
            </svg>
            Ask follow-up
          </button>
        ) : (
          <button
            onClick={onInterrupt}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-white bg-[var(--emerald)] rounded-[var(--radius-md)] hover:bg-[var(--emerald-light)] transition-colors cursor-pointer font-[family-name:var(--font-body)]"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1C4.134 1 1 3.91 1 7.5c0 1.47.527 2.83 1.414 3.92L1.5 14.5l3.248-1.2A7.36 7.36 0 008 14c3.866 0 7-2.91 7-6.5S11.866 1 8 1z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <circle cx="5" cy="7.5" r="0.75" fill="currentColor" />
              <circle cx="8" cy="7.5" r="0.75" fill="currentColor" />
              <circle cx="11" cy="7.5" r="0.75" fill="currentColor" />
            </svg>
            Quick ask
          </button>
        )}
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 1.5l9 5.5-9 5.5V1.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2.5" y="1.5" width="3" height="11" rx="0.5" fill="currentColor" />
      <rect x="8.5" y="1.5" width="3" height="11" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 7a5 5 0 019.33-2.5M12 7a5 5 0 01-9.33 2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M11 1.5v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpeakerOnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 4L9.5 8H6a2 2 0 00-2 2v4a2 2 0 002 2h3.5L14 20V4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 8.5a4.5 4.5 0 010 7M20 6a8 8 0 010 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 4L9.5 8H6a2 2 0 00-2 2v4a2 2 0 002 2h3.5L14 20V4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 9l4 4m0-4l-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
