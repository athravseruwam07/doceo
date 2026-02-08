"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimationEvent, PlayerState } from "@/lib/types";

interface UseAnimationPlayerResult {
  state: PlayerState;
  visibleEvents: AnimationEvent[];
  activeEvent: AnimationEvent | null;
  play: () => void;
  pause: () => void;
  resume: () => void;
  interrupt: () => void;
  setSpeed: (speed: number) => void;
}

export function useAnimationPlayer(
  events: AnimationEvent[]
): UseAnimationPlayerResult {
  const [state, setState] = useState<PlayerState>({
    status: "loading",
    currentEventIndex: -1,
    progress: 0,
    speed: 1,
    currentStep: 0,
    totalSteps: 0,
    voiceEnabled: true,
  });

  const [visibleEvents, setVisibleEvents] = useState<AnimationEvent[]>([]);
  const [activeEvent, setActiveEvent] = useState<AnimationEvent | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingTimeRef = useRef<number>(0);
  const eventStartTimeRef = useRef<number>(0);
  const speedRef = useRef<number>(1);
  const indexRef = useRef<number>(-1);
  const eventsRef = useRef<AnimationEvent[]>(events);
  const advanceToEventRef = useRef<(index: number) => void>(() => {});

  // Keep refs in sync
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    speedRef.current = state.speed;
  }, [state.speed]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advanceToEvent = useCallback(
    (index: number) => {
      const evts = eventsRef.current;
      if (index >= evts.length) {
        // Lesson complete
        setActiveEvent(null);
        setState((prev) => ({
          ...prev,
          status: "complete",
          currentEventIndex: evts.length,
          progress: 1,
        }));
        return;
      }

      const event = evts[index];
      indexRef.current = index;

      // Track step markers
      let currentStep = 0;
      for (let i = 0; i <= index; i++) {
        if (evts[i].type === "step_marker" && evts[i].payload.stepNumber) {
          currentStep = evts[i].payload.stepNumber!;
        }
      }

      setActiveEvent(event);
      setState((prev) => ({
        ...prev,
        status: "playing",
        currentEventIndex: index,
        progress: index / evts.length,
        currentStep,
      }));

      const duration = event.duration / speedRef.current;
      remainingTimeRef.current = duration;
      eventStartTimeRef.current = Date.now();

      timerRef.current = setTimeout(() => {
        // Event completed — add to visible events (except pause/step_marker)
        if (event.type !== "pause" && event.type !== "step_marker") {
          setVisibleEvents((prev) => [...prev, event]);
        }
        // Advance to next
        advanceToEventRef.current(index + 1);
      }, duration);
    },
    [] // no deps — uses refs
  );

  useEffect(() => {
    advanceToEventRef.current = advanceToEvent;
  }, [advanceToEvent]);

  const play = useCallback(() => {
    if (eventsRef.current.length === 0) return;
    const stepCount = eventsRef.current.filter(
      (event) => event.type === "step_marker"
    ).length;
    clearTimer();
    setVisibleEvents([]);
    setActiveEvent(null);
    setState((prev) => ({
      ...prev,
      status: "loading",
      currentStep: 0,
      currentEventIndex: -1,
      progress: 0,
      totalSteps: stepCount,
    }));
    indexRef.current = -1;
    advanceToEventRef.current(0);
  }, [clearTimer]);

  const pause = useCallback(() => {
    clearTimer();
    const elapsed = Date.now() - eventStartTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    setState((prev) => ({ ...prev, status: "paused" }));
  }, [clearTimer]);

  const resume = useCallback(() => {
    if (indexRef.current < 0 || indexRef.current >= eventsRef.current.length) return;

    setState((prev) => ({ ...prev, status: "playing" }));
    eventStartTimeRef.current = Date.now();
    const remaining = remainingTimeRef.current / speedRef.current;

    timerRef.current = setTimeout(() => {
      const event = eventsRef.current[indexRef.current];
      if (event && event.type !== "pause" && event.type !== "step_marker") {
        setVisibleEvents((prev) => [...prev, event]);
      }
      advanceToEventRef.current(indexRef.current + 1);
    }, remaining);
  }, []);

  const interrupt = useCallback(() => {
    clearTimer();
    const elapsed = Date.now() - eventStartTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    setState((prev) => ({ ...prev, status: "interrupted" }));
  }, [clearTimer]);

  const setSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    state,
    visibleEvents,
    activeEvent,
    play,
    pause,
    resume,
    interrupt,
    setSpeed,
  };
}
