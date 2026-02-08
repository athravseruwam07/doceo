import { LessonStep, AnimationEvent, AnimationEventType, BoardPoint, TimelineSegment } from "./types";

let eventCounter = 0;

function makeId(): string {
  return `evt-${++eventCounter}`;
}

function textDuration(text: string): number {
  return Math.max(800, text.length * 35);
}

function latexDuration(latex: string): number {
  return Math.max(1200, latex.length * 60);
}

/**
 * Convert a backend AnimationEvent (snake_case payload) into the
 * frontend AnimationEvent format (camelCase payload).
 */
function parsePoints(raw: unknown): BoardPoint[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const points: BoardPoint[] = [];
  for (const point of raw) {
    if (!point || typeof point !== "object") continue;
    const x = (point as Record<string, unknown>).x;
    const y = (point as Record<string, unknown>).y;
    if (typeof x === "number" && typeof y === "number") {
      points.push({ x, y });
    }
  }
  return points.length > 0 ? points : undefined;
}

export function convertBackendEvent(raw: Record<string, unknown>): AnimationEvent {
  const payload = (raw.payload || {}) as Record<string, unknown>;
  const rawStyle = (payload.style || payload.event_style) as Record<string, unknown> | undefined;
  return {
    id: raw.id as string,
    type: raw.type as AnimationEventType,
    duration: raw.duration as number,
    payload: {
      text: payload.text as string | undefined,
      latex: payload.latex as string | undefined,
      display: payload.display as boolean | undefined,
      position: payload.position as "top" | "center" | "bottom" | undefined,
      // snake_case → camelCase
      annotationType: (payload.annotation_type || payload.annotationType) as
        | "highlight"
        | "underline"
        | "circle"
        | "box"
        | undefined,
      targetId: (payload.target_id || payload.targetId) as string | undefined,
      stepNumber: (payload.step_number ?? payload.stepNumber) as
        | number
        | undefined,
      stepTitle: (payload.step_title ?? payload.stepTitle) as
        | string
        | undefined,
      audioUrl: (payload.audio_url || payload.audioUrl) as string | undefined,
      audioDuration: (payload.audio_duration ?? payload.audioDuration) as
        | number
        | undefined,
      zone: (payload.zone || payload.board_zone) as
        | "given"
        | "main"
        | "scratch"
        | "final"
        | undefined,
      anchor: (payload.anchor || payload.board_anchor) as
        | "given"
        | "work"
        | "scratch"
        | "final"
        | undefined,
      align: payload.align as "left" | "center" | "right" | undefined,
      groupId: (payload.group_id || payload.groupId) as string | undefined,
      intent: payload.intent as
        | "introduce"
        | "derive"
        | "emphasize"
        | "result"
        | "side_note"
        | undefined,
      temporary: payload.temporary as boolean | undefined,
      focusTarget: (payload.focus_target || payload.focusTarget) as string | undefined,
      teachingPhase: (payload.teaching_phase || payload.teachingPhase) as
        | "setup"
        | "derive"
        | "checkpoint"
        | "result"
        | undefined,
      boardPage: (payload.board_page ?? payload.boardPage) as number | undefined,
      lane: payload.lane as
        | "given"
        | "derivation"
        | "scratch"
        | "final"
        | undefined,
      slotIndex: (payload.slot_index ?? payload.slotIndex) as number | undefined,
      reserveHeight: (payload.reserve_height ?? payload.reserveHeight) as number | undefined,
      transformChainId: (payload.transform_chain_id || payload.transformChainId) as
        | string
        | undefined,
      renderOrder: (payload.render_order ?? payload.renderOrder) as number | undefined,
      layoutLocked: (payload.layout_locked ?? payload.layoutLocked) as boolean | undefined,
      isPageTurnMarker: (payload.is_page_turn_marker ?? payload.isPageTurnMarker) as
        | boolean
        | undefined,
      x: payload.x as number | undefined,
      y: payload.y as number | undefined,
      width: payload.width as number | undefined,
      height: payload.height as number | undefined,
      style: rawStyle
        ? {
            color: rawStyle.color as string | undefined,
            strokeWidth: (rawStyle.strokeWidth ?? rawStyle.stroke_width) as
              | number
              | undefined,
            emphasis: rawStyle.emphasis as "normal" | "key" | "final" | undefined,
          }
        : undefined,
      clearTarget: (payload.clear_target ?? payload.clearTarget) as
        | "zone"
        | "id"
        | undefined,
      clearZone: (payload.clear_zone ?? payload.clearZone) as
        | "given"
        | "main"
        | "scratch"
        | "final"
        | undefined,
      clearId: (payload.clear_id ?? payload.clearId) as string | undefined,
      x1: payload.x1 as number | undefined,
      y1: payload.y1 as number | undefined,
      x2: payload.x2 as number | undefined,
      y2: payload.y2 as number | undefined,
      cx: payload.cx as number | undefined,
      cy: payload.cy as number | undefined,
      r: payload.r as number | undefined,
      label: payload.label as string | undefined,
      xLabel: (payload.x_label ?? payload.xLabel) as string | undefined,
      yLabel: (payload.y_label ?? payload.yLabel) as string | undefined,
      ticks: payload.ticks as number | undefined,
      points: parsePoints(payload.points),
    },
  };
}

/**
 * Converts a LessonStep array into a flat AnimationEvent timeline.
 *
 * If a step has an `events` array from the backend (AI-choreographed),
 * those events are used directly (with snake_case → camelCase conversion).
 * Otherwise falls back to algorithmically generating events from content.
 */
export function stepsToTimeline(steps: LessonStep[]): AnimationEvent[] {
  eventCounter = 0;
  const events: AnimationEvent[] = [];

  for (const step of steps) {
    // Check if backend provided granular events
    if (step.events && step.events.length > 0) {
      // Use backend-choreographed events directly
      for (const rawEvent of step.events) {
        const converted = convertBackendEvent(rawEvent as unknown as Record<string, unknown>);
        if (converted.type === "narrate") {
          console.log(`[Timeline] Narrate event ${converted.id}: audioUrl=${converted.payload.audioUrl || "NONE"}`);
        }
        events.push(converted);
      }
      continue;
    }

    // ── Fallback: algorithmically generate events from flat content ──

    // Step marker
    events.push({
      id: makeId(),
      type: "step_marker",
      duration: 300,
      payload: {
        stepNumber: step.step_number,
        stepTitle: step.title,
      },
    });

    // Narrate the step title
    events.push({
      id: makeId(),
      type: "narrate",
      duration: textDuration(step.title),
        payload: {
          text: `Step ${step.step_number}: ${step.title}`,
          position: "top",
          zone: "given",
          anchor: "given",
          intent: "introduce",
        },
      });

    // Parse content into events
    const contentEvents = parseContentToEvents(step.content);
    events.push(...contentEvents);

    // Display math blocks that aren't already in content
    for (const mb of step.math_blocks) {
      const alreadyInContent = contentEvents.some(
        (e) => e.type === "write_equation" && e.payload.latex === mb.latex
      );
      if (!alreadyInContent) {
        events.push({
          id: makeId(),
          type: "write_equation",
          duration: latexDuration(mb.latex),
          payload: {
            latex: mb.latex,
            display: mb.display,
            position: "center",
            zone: "main",
            anchor: "work",
            intent: "derive",
          },
        });
      }
    }

    // Breathing pause between steps
    events.push({
      id: makeId(),
      type: "pause",
      duration: 1200,
      payload: {},
    });
  }

  return events;
}

/**
 * Parses step content (with inline $...$ and display $$...$$) into
 * a series of write_text and write_equation events.
 */
function parseContentToEvents(content: string): AnimationEvent[] {
  const events: AnimationEvent[] = [];
  // Split on double newlines to get paragraphs/blocks
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Check if the entire block is a display equation
    const displayMatch = trimmed.match(/^\$\$([\s\S]+?)\$\$$/);
    if (displayMatch) {
      events.push({
        id: makeId(),
        type: "write_equation",
        duration: latexDuration(displayMatch[1].trim()),
        payload: {
          latex: displayMatch[1].trim(),
          display: true,
          position: "center",
          zone: "main",
          anchor: "work",
          intent: "derive",
        },
      });
      continue;
    }

    // Split block into lines for list items or individual text lines
    const lines = trimmed.split(/\n/);
    for (const line of lines) {
      const lineTrimmed = line.trim();
      if (!lineTrimmed) continue;

      // Check if line is purely a display equation
      const lineDisplayMatch = lineTrimmed.match(/^\$\$([\s\S]+?)\$\$$/);
      if (lineDisplayMatch) {
        events.push({
          id: makeId(),
          type: "write_equation",
          duration: latexDuration(lineDisplayMatch[1].trim()),
          payload: {
            latex: lineDisplayMatch[1].trim(),
            display: true,
            position: "center",
          },
        });
        continue;
      }

      // Regular text line (may contain inline $...$)
      events.push({
        id: makeId(),
        type: "write_text",
        duration: textDuration(lineTrimmed),
        payload: {
          text: lineTrimmed,
          position: "center",
          zone: "main",
          anchor: "work",
          intent: "derive",
        },
      });
    }
  }

  return events;
}

/**
 * Convert a flat AnimationEvent array into TimelineSegments where
 * narration and visuals play concurrently within each segment.
 */
export function eventsToSegments(events: AnimationEvent[]): TimelineSegment[] {
  const segments: TimelineSegment[] = [];
  let current: TimelineSegment | null = null;
  let segCounter = 0;
  let pendingStepStart = false;
  let pendingStepNumber = 0;
  let pendingStepTitle: string | undefined;

  function pushCurrent() {
    if (current) {
      current.visualDuration = current.visuals.reduce((sum, v) => sum + v.duration, 0);
      current.duration = Math.max(
        current.audio?.duration ?? 0,
        current.visualDuration
      );
      // Add a small minimum duration for empty segments
      if (current.duration === 0) current.duration = 300;
      segments.push(current);
    }
  }

  function makeSegment(): TimelineSegment {
    segCounter++;
    const seg: TimelineSegment = {
      id: `seg-${segCounter}`,
      visuals: [],
      visualDuration: 0,
      duration: 0,
      stepNumber: pendingStepNumber,
      stepTitle: pendingStepTitle,
      isStepStart: pendingStepStart,
    };
    pendingStepStart = false;
    return seg;
  }

  for (const event of events) {
    switch (event.type) {
      case "step_marker":
        pendingStepStart = true;
        pendingStepNumber = event.payload.stepNumber ?? 0;
        pendingStepTitle = event.payload.stepTitle;
        break;

      case "narrate":
        // Narrate starts a new segment
        pushCurrent();
        current = makeSegment();
        current.audio = {
          eventId: event.id,
          url: event.payload.audioUrl,
          duration: event.duration,
          text: event.payload.text ?? "",
        };
        break;

      case "write_equation":
      case "write_text":
      case "annotate":
      case "draw_line":
      case "draw_arrow":
      case "draw_rect":
      case "draw_circle":
      case "draw_axes":
      case "plot_curve":
        // Visual events collect into the current segment
        if (!current) {
          // Visuals before any narrate → silent segment
          current = makeSegment();
        }
        current.visuals.push(event);
        break;

      case "pause":
        // Add padding to current segment's duration
        if (current) {
          current.duration += event.duration;
        }
        break;

      case "clear_section":
        // Treat as a visual in the current segment
        if (!current) {
          current = makeSegment();
        }
        current.visuals.push(event);
        break;
    }
  }

  // Push final segment
  pushCurrent();

  // Diagnostic: log segment audio state
  const withAudio = segments.filter(s => s.audio?.url);
  console.log(`[Timeline] Created ${segments.length} segments (${withAudio.length} with audio URLs)`);
  if (withAudio.length === 0 && segments.some(s => s.audio)) {
    console.warn(`[Timeline] ⚠️ Segments have audio fields but ALL URLs are missing/undefined`);
  }

  return segments;
}

/**
 * Convert LessonSteps directly into TimelineSegments.
 * Uses stepsToTimeline() to get flat events, then segments them.
 */
export function stepsToSegments(steps: LessonStep[]): TimelineSegment[] {
  const flatEvents = stepsToTimeline(steps);
  return eventsToSegments(flatEvents);
}

/**
 * Extracts all unique LaTeX equations from a timeline for the summary view.
 */
export function extractEquations(
  events: AnimationEvent[]
): { latex: string; display: boolean }[] {
  const seen = new Set<string>();
  const equations: { latex: string; display: boolean }[] = [];

  for (const event of events) {
    if (event.type === "write_equation" && event.payload.latex) {
      if (!seen.has(event.payload.latex)) {
        seen.add(event.payload.latex);
        equations.push({
          latex: event.payload.latex,
          display: event.payload.display ?? true,
        });
      }
    }
  }

  return equations;
}
