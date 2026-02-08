"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimationEvent, TimelineSegment, SegmentPlayerState } from "@/lib/types";

interface VisualSlot {
  visual: AnimationEvent;
  startTime: number;
  endTime: number;
}

interface UseSegmentPlayerResult {
  state: SegmentPlayerState;
  completedVisuals: AnimationEvent[];
  currentSegment: TimelineSegment | null;
  activeVisual: AnimationEvent | null;
  activeVisualProgress: number;
  play: () => void;
  pause: () => void;
  resume: () => void;
  interrupt: () => void;
  setSpeed: (speed: number) => void;
  seekToSegment: (index: number) => void;
  onAudioEnded: () => void;
}

export function useSegmentPlayer(
  segments: TimelineSegment[]
): UseSegmentPlayerResult {
  // ─── All mutable playback state lives in refs ───
  // React state is ONLY updated for rendering, never read inside the rAF loop.
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const segIndexRef = useRef(-1);
  const segStartRef = useRef(0);
  const pauseElapsedRef = useRef(0);
  const speedRef = useRef(1);
  const segmentsRef = useRef(segments);
  const slotsRef = useRef<VisualSlot[]>([]);
  const visualIdxRef = useRef(-1);
  const completedRef = useRef<AnimationEvent[]>([]);
  const audioEndedRef = useRef(false);

  // React state for rendering
  const [state, setState] = useState<SegmentPlayerState>({
    status: "loading",
    currentSegmentIndex: -1,
    segmentProgress: 0,
    totalProgress: 0,
    speed: 1,
    currentStep: 0,
    totalSteps: 0,
    voiceEnabled: false,
    elapsed: 0,
    totalDuration: 0,
  });
  const [completedVisuals, setCompletedVisuals] = useState<AnimationEvent[]>([]);
  const [activeVisual, setActiveVisual] = useState<AnimationEvent | null>(null);
  const [activeVisualProgress, setActiveVisualProgress] = useState(0);
  const [currentSegment, setCurrentSegment] = useState<TimelineSegment | null>(null);

  // Keep segments ref in sync
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // Compute totals when segments change
  useEffect(() => {
    if (segments.length > 0) {
      const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
      const stepSet = new Set(segments.filter(s => s.isStepStart).map(s => s.stepNumber));
      setState(prev => ({ ...prev, totalSteps: stepSet.size, totalDuration }));
    }
  }, [segments]);

  // ─── Visual slot computation ───
  function computeSlots(segment: TimelineSegment): VisualSlot[] {
    if (segment.visuals.length === 0) return [];
    const segDur = segment.duration;
    const visDur = segment.visualDuration;
    if (visDur === 0) return [];

    if (visDur <= segDur) {
      const slots: VisualSlot[] = [];
      const n = segment.visuals.length;
      const slack = Math.max(0, segDur - visDur);
      // Keep visuals aligned with narration start; distribute extra time between visuals,
      // not before the first one (prevents audio from feeling ahead).
      const interGap = n > 1 ? Math.min(220, slack / (n - 1)) : 0;
      let t = 0;
      for (let i = 0; i < n; i += 1) {
        const v = segment.visuals[i];
        slots.push({ visual: v, startTime: t, endTime: t + v.duration });
        t += v.duration + (i < n - 1 ? interGap : 0);
      }
      return slots;
    }

    let t = 0;
    return segment.visuals.map(v => {
      const s = { visual: v, startTime: t, endTime: t + v.duration };
      t += v.duration;
      return s;
    });
  }

  // ─── Elapsed time up to a segment index ───
  function priorElapsed(index: number): number {
    let sum = 0;
    const segs = segmentsRef.current;
    for (let i = 0; i < index && i < segs.length; i++) sum += segs[i].duration;
    return sum;
  }

  // ─── Current step at a given segment index ───
  function stepAt(index: number): number {
    const segs = segmentsRef.current;
    let step = 0;
    for (let i = 0; i <= index && i < segs.length; i++) {
      if (segs[i].isStepStart) step = segs[i].stepNumber;
    }
    return step;
  }

  // ─── Start a segment (ref-only, then flush to React state) ───
  function beginSegment(index: number) {
    const segs = segmentsRef.current;

    if (index >= segs.length) {
      // Lesson complete
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      segIndexRef.current = index;

      setActiveVisual(null);
      setActiveVisualProgress(0);
      setCurrentSegment(null);
      setState(prev => ({
        ...prev,
        status: "complete",
        currentSegmentIndex: index,
        segmentProgress: 1,
        totalProgress: 1,
        elapsed: prev.totalDuration,
      }));
      return;
    }

    const seg = segs[index];
    segIndexRef.current = index;
    audioEndedRef.current = !seg.audio;
    slotsRef.current = computeSlots(seg);
    visualIdxRef.current = -1;
    segStartRef.current = performance.now();
    pauseElapsedRef.current = 0;

    const pe = priorElapsed(index);

    // Flush to React
    setCurrentSegment(seg);
    setActiveVisual(null);
    setActiveVisualProgress(0);
    setState(prev => ({
      ...prev,
      status: "playing",
      currentSegmentIndex: index,
      segmentProgress: 0,
      currentStep: stepAt(index),
      totalProgress: prev.totalDuration > 0 ? pe / prev.totalDuration : 0,
      elapsed: pe,
    }));

    // Always schedule rAF — cancelAnimationFrame prevents double-scheduling.
    // This is critical: when called from tick() during segment transitions,
    // runningRef is already true, so a conditional check would skip scheduling.
    runningRef.current = true;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }

  // ─── The rAF tick — reads ONLY refs, writes to React state ───
  function tick() {
    if (!runningRef.current) return;

    const segs = segmentsRef.current;
    const idx = segIndexRef.current;
    if (idx < 0 || idx >= segs.length) {
      runningRef.current = false;
      return;
    }

    const seg = segs[idx];
    const now = performance.now();
    const rawElapsed = (now - segStartRef.current) * speedRef.current + pauseElapsedRef.current;
    const segElapsed = Math.min(rawElapsed, seg.duration);

    const slots = slotsRef.current;
    let vIdx = visualIdxRef.current;

    // Advance visual slots
    for (let i = vIdx + 1; i < slots.length; i++) {
        if (segElapsed >= slots[i].startTime) {
          // Complete previous visual
          if (vIdx >= 0 && vIdx < slots.length) {
            const prev = slots[vIdx].visual;
            completedRef.current = [...completedRef.current, prev];
            setCompletedVisuals(completedRef.current);
          }
          vIdx = i;
          visualIdxRef.current = i;
          setActiveVisual(slots[i].visual);
      }
    }

    // Update active visual progress
    if (vIdx >= 0 && vIdx < slots.length) {
      const slot = slots[vIdx];
      const dur = slot.endTime - slot.startTime;
      if (dur > 0) {
        const prog = Math.min(1, Math.max(0, (segElapsed - slot.startTime) / dur));
        setActiveVisualProgress(prog);

        // Complete this visual if its slot is done
        if (segElapsed >= slot.endTime) {
          const vis = slot.visual;
          completedRef.current = [...completedRef.current, vis];
          setCompletedVisuals(completedRef.current);
          setActiveVisual(null);
          setActiveVisualProgress(0);
          visualIdxRef.current = vIdx + 1;
        }
      }
    }

    // Progress update
    const pe = priorElapsed(idx);
    const totalEl = pe + segElapsed;
    setState(prev => ({
      ...prev,
      segmentProgress: seg.duration > 0 ? segElapsed / seg.duration : 1,
      totalProgress: prev.totalDuration > 0 ? totalEl / prev.totalDuration : 0,
      elapsed: totalEl,
    }));

    // Segment complete?
    const allVisualsDone = slots.length === 0 || visualIdxRef.current >= slots.length;
    const segTimeDone = segElapsed >= seg.duration;

    if (segTimeDone && allVisualsDone) {
      // Move to next segment — do NOT stop the rAF loop
      beginSegment(idx + 1);
      return; // beginSegment either continues the loop or stops it
    }

    // Continue the loop
    rafRef.current = requestAnimationFrame(tick);
  }

  // ─── Public controls ───

  const play = useCallback(() => {
    if (segmentsRef.current.length === 0) return;
    cancelAnimationFrame(rafRef.current);
    runningRef.current = false;
    completedRef.current = [];
    setCompletedVisuals([]);
    setActiveVisual(null);
    setActiveVisualProgress(0);
    beginSegment(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pause = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    const now = performance.now();
    pauseElapsedRef.current += (now - segStartRef.current) * speedRef.current;
    setState(prev => ({ ...prev, status: "paused" }));
  }, []);

  const resume = useCallback(() => {
    if (segIndexRef.current < 0) return;
    segStartRef.current = performance.now();
    runningRef.current = true;
    setState(prev => ({ ...prev, status: "playing" }));
    rafRef.current = requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const interrupt = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    const now = performance.now();
    pauseElapsedRef.current += (now - segStartRef.current) * speedRef.current;
    setState(prev => ({ ...prev, status: "interrupted" }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    // Capture elapsed at current speed before switching
    if (runningRef.current) {
      const now = performance.now();
      pauseElapsedRef.current += (now - segStartRef.current) * speedRef.current;
      segStartRef.current = now;
    }
    speedRef.current = speed;
    setState(prev => ({ ...prev, speed }));
  }, []);

  const seekToSegment = useCallback((index: number) => {
    const segs = segmentsRef.current;
    if (index < 0 || index >= segs.length) return;

    cancelAnimationFrame(rafRef.current);
    runningRef.current = false;

    // Build completed visuals from prior segments
    const completed: AnimationEvent[] = [];
    for (let i = 0; i < index; i++) {
      for (const v of segs[i].visuals) {
        completed.push(v);
      }
    }
    completedRef.current = completed;
    setCompletedVisuals(completed);

    beginSegment(index);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAudioEnded = useCallback(() => {
    audioEndedRef.current = true;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    state,
    completedVisuals,
    currentSegment,
    activeVisual,
    activeVisualProgress,
    play,
    pause,
    resume,
    interrupt,
    setSpeed,
    seekToSegment,
    onAudioEnded,
  };
}
