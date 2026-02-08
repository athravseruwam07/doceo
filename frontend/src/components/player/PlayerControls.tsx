"use client";

import { useState } from "react";
import { PlayerState } from "@/lib/types";

interface PlayerControlsProps {
  state: PlayerState;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onInterrupt: () => void;
  onSetSpeed: (speed: number) => void;
  onToggleVoice?: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

const SPEEDS = [0.5, 1, 1.5, 2];

export default function PlayerControls({
  state,
  onPlay,
  onPause,
  onResume,
  onInterrupt,
  onSetSpeed,
  onToggleVoice,
  theme,
  onToggleTheme,
}: PlayerControlsProps) {
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);
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
    <div className="player-controls border-t border-[var(--border)] bg-[var(--paper-warm)]/80 backdrop-blur-lg px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handlePlayPause}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--emerald)] text-white hover:bg-[var(--emerald-light)] transition-colors cursor-pointer"
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div
            className="relative flex-1 h-1.5 bg-[var(--cream-dark)] rounded-full overflow-hidden"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              setHoverProgress(ratio);
            }}
            onMouseLeave={() => setHoverProgress(null)}
          >
            <div
              className="h-full bg-[var(--emerald)] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${state.progress * 100}%` }}
            />
            {hoverProgress !== null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-white bg-[var(--emerald)]"
                style={{ left: `calc(${hoverProgress * 100}% - 5px)` }}
              />
            )}
          </div>

          {state.totalSteps > 0 && (
            <span className="text-[12px] text-[var(--ink-tertiary)] font-[family-name:var(--font-body)] whitespace-nowrap">
              Step {state.currentStep || 1} of {state.totalSteps}
            </span>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => onSetSpeed(speed)}
              className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors cursor-pointer font-[family-name:var(--font-body)] ${
                state.speed === speed
                  ? "bg-[var(--emerald)] text-white"
                  : "text-[var(--ink-tertiary)] hover:text-[var(--ink)] hover:bg-[var(--cream-dark)]"
              }`}
              title={`Set speed to ${speed}x`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {onToggleVoice && (
          <button
            onClick={onToggleVoice}
            className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors cursor-pointer ${
              state.voiceEnabled
                ? "bg-[var(--emerald)] text-white"
                : "bg-[var(--cream-dark)] text-[var(--ink-tertiary)] hover:bg-[var(--border-strong)]"
            }`}
            aria-label={state.voiceEnabled ? "Mute voice" : "Enable voice"}
            title={state.voiceEnabled ? "Mute (M)" : "Unmute (M)"}
          >
            {state.voiceEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
          </button>
        )}

        <button
          onClick={onToggleTheme}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--cream-dark)] text-[var(--ink-secondary)] hover:bg-[var(--border-strong)] transition-colors cursor-pointer"
          aria-label={theme === "light" ? "Enable dark mode" : "Enable light mode"}
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? <MoonIcon /> : <SunIcon />}
        </button>

        {!isComplete && (
          <button
            onClick={onInterrupt}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[var(--emerald)] border border-[var(--emerald)] rounded-[var(--radius-md)] hover:bg-[var(--emerald-subtle)] transition-colors cursor-pointer font-[family-name:var(--font-body)]"
            title="Pause and ask a question"
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
            Ask a question
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

function SpeakerOnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 5v4h2l3-3v6l-3-3H2a1 1 0 01-1-1V6a1 1 0 011-1z"
        fill="currentColor"
      />
      <path
        d="M11.5 7a3.5 3.5 0 010 2.5M12.5 4a6 6 0 010 6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 5v4h2l3-3v6l-3-3H2a1 1 0 01-1-1V6a1 1 0 011-1z"
        fill="currentColor"
      />
      <path
        d="M12.5 3.5l-2 2m0 2l2 2M10.5 3.5l2 2m0 2l-2 2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 1.5v2.2M10 16.3v2.2M1.5 10h2.2M16.3 10h2.2M3.5 3.5l1.6 1.6M14.9 14.9l1.6 1.6M16.5 3.5l-1.6 1.6M5.1 14.9l-1.6 1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path
        d="M16.5 11.7A7.2 7.2 0 018.3 3.5a7.2 7.2 0 108.2 8.2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
