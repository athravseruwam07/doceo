import { AnimationEvent, BoardAnchor, BoardLane, BoardZone, LessonStep, TimelineSegment } from "./types";
import { BOARD_HEIGHT, BOARD_WIDTH } from "./boardLayout";
import { renderToString } from "katex";

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LaneState {
  y: number;
  slotIndex: number;
}

interface PageState {
  lanes: Record<BoardLane, LaneState>;
}

const LANE_BOUNDS: Record<BoardLane, Bounds> = {
  given: { x: 72, y: 56, width: 920, height: 168 },
  derivation: { x: 86, y: 248, width: 936, height: 444 },
  scratch: { x: 1044, y: 66, width: 506, height: 638 },
  final: { x: 72, y: 724, width: 1482, height: 132 },
};

const PAGE_MIN = 0;
const PAGE_MAX = 8;
const LANE_GAP = 14;
const METRIC_SAMPLE_TEXT = "Given: identify known values and target.";

let metricRoot: HTMLDivElement | null = null;
const equationMetricCache = new Map<string, { width: number; height: number }>();
const textMetricCache = new Map<string, { width: number; height: number }>();
let textMeasureContext: CanvasRenderingContext2D | null | undefined;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getMetricRoot(): HTMLDivElement | null {
  if (typeof window === "undefined") return null;
  if (metricRoot) return metricRoot;
  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.position = "absolute";
  root.style.left = "-10000px";
  root.style.top = "0";
  root.style.visibility = "hidden";
  root.style.pointerEvents = "none";
  root.style.contain = "layout style paint";
  root.style.width = "0";
  root.style.height = "0";
  document.body.appendChild(root);
  metricRoot = root;
  return metricRoot;
}

function measureEquation(latex: string, display: boolean): { width: number; height: number } | null {
  if (typeof window === "undefined") return null;
  const key = `${display ? "d" : "i"}:${latex}`;
  const cached = equationMetricCache.get(key);
  if (cached) return cached;
  const root = getMetricRoot();
  if (!root) return null;

  const node = document.createElement("div");
  node.style.position = "absolute";
  node.style.left = "0";
  node.style.top = "0";
  node.style.whiteSpace = "nowrap";
  node.style.fontSize = display ? "34px" : "30px";
  node.style.lineHeight = "1.2";

  try {
    node.innerHTML = renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      strict: "ignore",
    });
  } catch {
    return null;
  }

  root.appendChild(node);
  const rect = node.getBoundingClientRect();
  root.removeChild(node);
  const measured = {
    width: Math.ceil(rect.width),
    height: Math.ceil(rect.height),
  };
  equationMetricCache.set(key, measured);
  return measured;
}

function getTextMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof window === "undefined") return null;
  if (textMeasureContext !== undefined) return textMeasureContext;
  const canvas = document.createElement("canvas");
  textMeasureContext = canvas.getContext("2d");
  return textMeasureContext;
}

function measureTextBlock(text: string, maxWidth: number): { width: number; height: number } | null {
  if (typeof window === "undefined") return null;
  const clean = text.trim() || METRIC_SAMPLE_TEXT;
  const key = `${maxWidth}:${clean}`;
  const cached = textMetricCache.get(key);
  if (cached) return cached;

  const ctx = getTextMeasureContext();
  if (!ctx) return null;
  ctx.font = "500 34px var(--font-body), 'Source Sans 3', sans-serif";
  const measuredWidth = ctx.measureText(clean).width;
  const wrappedLines = Math.max(1, Math.ceil((measuredWidth + 32) / Math.max(220, maxWidth - 16)));
  const measured = {
    width: Math.min(maxWidth, Math.ceil(measuredWidth + 34)),
    height: Math.ceil(wrappedLines * 46 + 8),
  };
  textMetricCache.set(key, measured);
  return measured;
}

function anchorFromZone(zone?: BoardZone): BoardAnchor | undefined {
  if (!zone) return undefined;
  if (zone === "main") return "work";
  return zone;
}

function laneFromEvent(event: AnimationEvent): BoardLane {
  const explicitLane = event.payload.lane;
  if (explicitLane) return explicitLane;

  const anchor = event.payload.anchor ?? anchorFromZone(event.payload.zone);
  if (anchor === "given") return "given";
  if (anchor === "scratch") return "scratch";
  if (anchor === "final") return "final";

  if (event.payload.intent === "introduce") return "given";
  if (event.payload.intent === "result") return "final";
  if (event.payload.intent === "side_note") return "scratch";

  if (
    event.type === "draw_line" ||
    event.type === "draw_arrow" ||
    event.type === "draw_rect" ||
    event.type === "draw_circle" ||
    event.type === "draw_axes" ||
    event.type === "plot_curve"
  ) {
    return "scratch";
  }

  return "derivation";
}

function zoneFromLane(lane: BoardLane): BoardZone {
  if (lane === "derivation") return "main";
  return lane;
}

function anchorFromLane(lane: BoardLane): BoardAnchor {
  if (lane === "derivation") return "work";
  return lane;
}

function latexComplexity(latex: string): number {
  const operators = (latex.match(/[=+\-*/]/g) ?? []).length;
  const radicals = (latex.match(/\\sqrt/g) ?? []).length;
  const fractions = (latex.match(/\\frac/g) ?? []).length;
  return latex.length * 0.55 + operators * 7 + radicals * 12 + fractions * 14;
}

function estimateEventFootprint(event: AnimationEvent, lane: BoardLane): { width: number; height: number } {
  const laneWidth = LANE_BOUNDS[lane].width - 12;

  const diagramSizedByPayload =
    event.type === "draw_line" ||
    event.type === "draw_arrow" ||
    event.type === "draw_rect" ||
    event.type === "draw_circle" ||
    event.type === "draw_axes" ||
    event.type === "plot_curve";

  if (diagramSizedByPayload && event.payload.width && event.payload.height) {
    return {
      width: clamp(event.payload.width, 90, laneWidth),
      height: clamp(event.payload.height, 28, 240),
    };
  }

  const reserveHeight = event.payload.reserveHeight;

  if (event.type === "write_equation") {
    const latex = event.payload.latex ?? "";
    const display = event.payload.display ?? true;
    const measured = measureEquation(latex, display);
    const complexity = latexComplexity(latex);
    const measuredWidth = measured?.width ?? latex.length * 12 + complexity * 1.2;
    const measuredHeight = measured?.height ?? 56 + complexity * 0.15;
    return {
      width: Math.min(laneWidth, Math.max(220, measuredWidth + (display ? 32 : 20))),
      height: reserveHeight ?? Math.min(200, Math.max(58, measuredHeight + (display ? 18 : 12))),
    };
  }

  if (event.type === "write_text") {
    const text = event.payload.text ?? "";
    const measured = measureTextBlock(text, laneWidth);
    return {
      width: Math.min(laneWidth, Math.max(170, measured?.width ?? text.length * 9 + 80)),
      height: reserveHeight ?? Math.min(124, Math.max(40, measured?.height ?? 34 + text.length * 0.22)),
    };
  }

  if (event.type === "draw_line" || event.type === "draw_arrow") {
    const x1 = event.payload.x1 ?? 0;
    const y1 = event.payload.y1 ?? 0;
    const x2 = event.payload.x2 ?? x1 + 220;
    const y2 = event.payload.y2 ?? y1 + 80;
    return {
      width: Math.max(90, Math.abs(x2 - x1)),
      height: reserveHeight ?? Math.max(44, Math.abs(y2 - y1)),
    };
  }

  if (event.type === "draw_rect") {
    return {
      width: Math.min(laneWidth, event.payload.width ?? 220),
      height: reserveHeight ?? event.payload.height ?? 130,
    };
  }

  if (event.type === "draw_circle") {
    const r = event.payload.r ?? 54;
    return {
      width: Math.max(64, r * 2),
      height: reserveHeight ?? Math.max(64, r * 2),
    };
  }

  if (event.type === "draw_axes") {
    return {
      width: Math.min(laneWidth, event.payload.width ?? 330),
      height: reserveHeight ?? event.payload.height ?? 224,
    };
  }

  if (event.type === "plot_curve") {
    return {
      width: Math.min(laneWidth, event.payload.width ?? 360),
      height: reserveHeight ?? event.payload.height ?? 220,
    };
  }

  return {
    width: Math.min(laneWidth, event.payload.width ?? 240),
    height: reserveHeight ?? event.payload.height ?? 90,
  };
}

function isVisual(event: AnimationEvent): boolean {
  return (
    event.type === "write_equation" ||
    event.type === "write_text" ||
    event.type === "draw_line" ||
    event.type === "draw_arrow" ||
    event.type === "draw_rect" ||
    event.type === "draw_circle" ||
    event.type === "draw_axes" ||
    event.type === "plot_curve"
  );
}

function shouldAutoChain(event: AnimationEvent): boolean {
  return event.type === "write_equation" || event.type === "write_text";
}

function makePageState(): PageState {
  return {
    lanes: {
      given: { y: LANE_BOUNDS.given.y + 8, slotIndex: 0 },
      derivation: { y: LANE_BOUNDS.derivation.y + 8, slotIndex: 0 },
      scratch: { y: LANE_BOUNDS.scratch.y + 8, slotIndex: 0 },
      final: { y: LANE_BOUNDS.final.y + 8, slotIndex: 0 },
    },
  };
}

function lessonComplexityScore(steps: LessonStep[], segments: TimelineSegment[]): number {
  const questionTextLen = steps.reduce((sum, step) => sum + (step.content?.length ?? 0), 0);

  let equationCount = 0;
  let textCount = 0;
  let diagramCount = 0;
  let latexChars = 0;

  for (const segment of segments) {
    for (const visual of segment.visuals) {
      if (visual.type === "write_equation") {
        equationCount += 1;
        latexChars += (visual.payload.latex ?? "").length;
      } else if (visual.type === "write_text") {
        textCount += 1;
      } else if (isVisual(visual)) {
        diagramCount += 1;
      }
    }
  }

  const avgLatex = equationCount > 0 ? latexChars / equationCount : 0;
  return (
    questionTextLen * 0.018 +
    equationCount * 2.4 +
    textCount * 0.9 +
    diagramCount * 2.1 +
    avgLatex * 0.08
  );
}

function plannedPageBudget(score: number): number {
  if (score < 22) return 1;
  if (score < 42) return 2;
  if (score < 66) return 3;
  if (score < 92) return 4;
  return 5;
}

function cloneEvent(event: AnimationEvent): AnimationEvent {
  return {
    ...event,
    payload: {
      ...event.payload,
      style: event.payload.style ? { ...event.payload.style } : undefined,
      points: event.payload.points ? [...event.payload.points] : undefined,
    },
  };
}

function cloneSegments(segments: TimelineSegment[]): TimelineSegment[] {
  return segments.map((segment) => ({
    ...segment,
    audio: segment.audio ? { ...segment.audio } : undefined,
    visuals: segment.visuals.map(cloneEvent),
  }));
}

function laneX(lane: BoardLane, event: AnimationEvent, width: number): number {
  const bounds = LANE_BOUNDS[lane];
  if (typeof event.payload.x === "number") {
    return clamp(event.payload.x, bounds.x + 4, bounds.x + bounds.width - width - 4);
  }

  if (event.payload.align === "center") {
    return bounds.x + (bounds.width - width) / 2;
  }
  if (event.payload.align === "right") {
    return bounds.x + bounds.width - width - 8;
  }

  if (lane === "derivation" && event.type === "write_equation" && (event.payload.latex ?? "").includes("=")) {
    return bounds.x + 36;
  }

  return bounds.x + 12;
}

function laneBottom(lane: BoardLane): number {
  const bounds = LANE_BOUNDS[lane];
  return bounds.y + bounds.height - 8;
}

function normalizeVisualPayload(event: AnimationEvent): void {
  const lane = laneFromEvent(event);
  event.payload.lane = lane;
  event.payload.anchor = anchorFromLane(lane);
  event.payload.zone = zoneFromLane(lane);

  if (!event.payload.intent) {
    if (lane === "given") event.payload.intent = "introduce";
    else if (lane === "final") event.payload.intent = "result";
    else if (lane === "scratch") event.payload.intent = "side_note";
    else event.payload.intent = "derive";
  }

  if (!event.payload.teachingPhase) {
    if (event.payload.intent === "introduce") event.payload.teachingPhase = "setup";
    else if (event.payload.intent === "result") event.payload.teachingPhase = "result";
    else if (event.payload.intent === "emphasize") event.payload.teachingPhase = "checkpoint";
    else event.payload.teachingPhase = "derive";
  }
}

function reserveHeight(event: AnimationEvent, fallbackHeight: number): number {
  if (typeof event.payload.reserveHeight === "number") {
    return clamp(Math.max(event.payload.reserveHeight, fallbackHeight), 28, 240);
  }
  return clamp(fallbackHeight, 28, 240);
}

function applyPlacement(
  event: AnimationEvent,
  page: number,
  lane: BoardLane,
  slotIndex: number,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  event.payload.boardPage = page;
  event.payload.lane = lane;
  event.payload.slotIndex = slotIndex;
  event.payload.x = x;
  event.payload.y = y;
  event.payload.width = width;
  event.payload.height = height;
  event.payload.reserveHeight = reserveHeight(event, height);
  event.payload.layoutLocked = true;
}

function planVisuals(
  planned: TimelineSegment[],
  pageBudget: number
): TimelineSegment[] {
  const pages: PageState[] = [makePageState()];
  const chainState = new Map<
    string,
    { page: number; x: number; nextY: number; nextSlotIndex: number }
  >();
  const pageCeiling = clamp(Math.max(pageBudget + 1, 2), PAGE_MIN, PAGE_MAX);
  let currentPage = 0;
  let lastDerivationChain: string | undefined;
  let pageTurnFlagNeeded = false;
  let renderOrder = 0;

  for (const segment of planned) {
    for (const event of segment.visuals) {
      if (!isVisual(event)) {
        if (event.type === "clear_section") {
          event.payload.boardPage = currentPage;
        }
        continue;
      }

      normalizeVisualPayload(event);
      const lane = laneFromEvent(event);

      if (shouldAutoChain(event) && lane === "derivation" && !event.payload.transformChainId) {
        if (!lastDerivationChain) {
          lastDerivationChain = `chain-${segment.stepNumber}-${event.id}`;
        }
        event.payload.transformChainId = lastDerivationChain;
      }

      const bounds = LANE_BOUNDS[lane];
      const footprint = estimateEventFootprint(event, lane);
      const width = clamp(footprint.width, 90, bounds.width - 12);
      const height = reserveHeight(event, footprint.height);
      const chainId = lane === "derivation" ? event.payload.transformChainId : undefined;
      const existingChain = chainId ? chainState.get(chainId) : undefined;

      if (typeof event.payload.boardPage === "number") {
        currentPage = clamp(
          Math.max(currentPage, event.payload.boardPage),
          PAGE_MIN,
          pageCeiling
        );
      } else if (existingChain && typeof event.payload.y !== "number") {
        currentPage = existingChain.page;
      }
      while (!pages[currentPage]) {
        pages.push(makePageState());
      }

      let laneState = pages[currentPage].lanes[lane];
      const baseY = existingChain?.nextY ?? laneState.y;
      let y = typeof event.payload.y === "number" ? event.payload.y : baseY;

      const overflows = y + height > laneBottom(lane);
      if (overflows && typeof event.payload.y !== "number") {
        currentPage = clamp(currentPage + 1, PAGE_MIN, pageCeiling);
        while (!pages[currentPage]) {
          pages.push(makePageState());
        }
        laneState = pages[currentPage].lanes[lane];
        y = laneState.y;
        pageTurnFlagNeeded = true;
      }

      const x = existingChain && typeof event.payload.x !== "number"
        ? existingChain.x
        : laneX(lane, event, width);
      const slotIndex = typeof existingChain?.nextSlotIndex === "number"
        ? Math.max(laneState.slotIndex, existingChain.nextSlotIndex)
        : laneState.slotIndex;
      applyPlacement(event, currentPage, lane, slotIndex, x, y, width, height);
      event.payload.renderOrder = renderOrder;
      renderOrder += 1;

      laneState.y = Math.max(laneState.y, y + height + LANE_GAP);
      laneState.slotIndex = Math.max(laneState.slotIndex, slotIndex + 1);
      if (chainId) {
        chainState.set(chainId, {
          page: currentPage,
          x,
          nextY: y + height + LANE_GAP,
          nextSlotIndex: slotIndex + 1,
        });
      }

      if (pageTurnFlagNeeded) {
        event.payload.isPageTurnMarker = true;
        pageTurnFlagNeeded = false;
      }

      if (lane !== "derivation") {
        lastDerivationChain = undefined;
      }
    }
  }

  return planned;
}

export function planSegmentsForBoard(
  segments: TimelineSegment[],
  steps: LessonStep[] = []
): TimelineSegment[] {
  if (segments.length === 0) return segments;

  const cloned = cloneSegments(segments);
  const score = lessonComplexityScore(steps, cloned);
  const pageBudget = plannedPageBudget(score);
  return planVisuals(cloned, pageBudget);
}

export function inferCurrentBoardPage(
  segments: TimelineSegment[],
  currentSegmentIndex: number
): number {
  if (segments.length === 0 || currentSegmentIndex < 0) return 0;
  const lastIdx = Math.min(currentSegmentIndex, segments.length - 1);
  let page = 0;

  for (let i = 0; i <= lastIdx; i += 1) {
    const visuals = segments[i].visuals;
    for (const visual of visuals) {
      const boardPage = visual.payload.boardPage;
      if (typeof boardPage === "number") {
        page = Math.max(page, boardPage);
      }
    }
  }

  return page;
}

export function planInterruptionSegments(
  segments: TimelineSegment[],
  boardPage: number
): TimelineSegment[] {
  const planned = cloneSegments(segments);

  let yCursor = LANE_BOUNDS.scratch.y + 16;
  let slot = 0;
  const maxY = laneBottom("scratch");

  for (const segment of planned) {
    for (const visual of segment.visuals) {
      visual.payload.temporary = true;
      visual.payload.boardPage = boardPage;

      if (visual.type === "clear_section") {
        if (!visual.payload.clearTarget && !visual.payload.clearZone) {
          visual.payload.clearTarget = "zone";
          visual.payload.clearZone = "scratch";
        }
        continue;
      }

      if (!isVisual(visual)) continue;

      normalizeVisualPayload(visual);
      visual.payload.lane = "scratch";
      visual.payload.anchor = "scratch";
      visual.payload.zone = "scratch";
      visual.payload.intent = visual.payload.intent ?? "side_note";

      const footprint = estimateEventFootprint(visual, "scratch");
      const width = clamp(footprint.width, 120, LANE_BOUNDS.scratch.width - 24);
      const height = reserveHeight(visual, footprint.height);

      if (yCursor + height > maxY) {
        yCursor = LANE_BOUNDS.scratch.y + 16;
        slot = 0;
      }

      const x = laneX("scratch", visual, width);
      applyPlacement(visual, boardPage, "scratch", slot, x, yCursor, width, height);
      visual.payload.renderOrder = slot;
      yCursor += height + 12;
      slot += 1;
    }
  }

  return planned;
}

export function maxBoardPage(segments: TimelineSegment[]): number {
  let max = 0;
  for (const segment of segments) {
    for (const visual of segment.visuals) {
      if (typeof visual.payload.boardPage === "number") {
        max = Math.max(max, visual.payload.boardPage);
      }
    }
  }
  return max;
}

export function getBoardDimensions() {
  return { width: BOARD_WIDTH, height: BOARD_HEIGHT };
}
