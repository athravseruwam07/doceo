import { LessonStep, AnimationEvent } from "./types";

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
 * Converts a LessonStep array into a flat AnimationEvent timeline.
 * Each step produces: step_marker → narrate (title) → content events → math_blocks → pause
 */
export function stepsToTimeline(steps: LessonStep[]): AnimationEvent[] {
  eventCounter = 0;
  const events: AnimationEvent[] = [];

  for (const step of steps) {
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
      },
    });

    // Parse content into events
    const contentEvents = parseContentToEvents(step.content);
    events.push(...contentEvents);

    // Display math blocks that aren't already in content
    for (const mb of step.math_blocks) {
      // Check if this latex was already emitted via $$...$$ in content
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
        },
      });
    }
  }

  return events;
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
