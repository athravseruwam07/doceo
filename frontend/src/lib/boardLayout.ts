import { AnimationEvent, BoardAnchor, BoardLane, BoardPoint, BoardZone } from "./types";

export const BOARD_WIDTH = 1600;
export const BOARD_HEIGHT = 900;

const ITEM_GAP = 16;
const BOUNDS_PADDING = 18;

export interface AnchorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ANCHOR_BOUNDS: Record<BoardAnchor, AnchorBounds> = {
  given: { x: 52, y: 46, width: 930, height: 190 },
  work: { x: 52, y: 252, width: 960, height: 448 },
  scratch: { x: 1036, y: 60, width: 520, height: 646 },
  final: { x: 52, y: 724, width: 1504, height: 130 },
};

const ANCHOR_X_LANES: Record<BoardAnchor, number> = {
  given: 74,
  work: 88,
  scratch: 1058,
  final: 74,
};

export const ZONE_BOUNDS: Record<BoardZone, AnchorBounds> = {
  given: ANCHOR_BOUNDS.given,
  main: ANCHOR_BOUNDS.work,
  scratch: ANCHOR_BOUNDS.scratch,
  final: ANCHOR_BOUNDS.final,
};

export interface AnchorLabelMeta {
  x: number;
  y: number;
  text: string;
}

export const ANCHOR_LABELS: Record<BoardAnchor, AnchorLabelMeta> = {
  given: { x: 64, y: 40, text: "Given" },
  work: { x: 64, y: 246, text: "Work" },
  scratch: { x: 1048, y: 54, text: "Scratch" },
  final: { x: 64, y: 718, text: "Final" },
};

export interface BoardObject {
  id: string;
  type: AnimationEvent["type"];
  page: number;
  lane: BoardLane;
  zone: BoardZone;
  anchor: BoardAnchor;
  x: number;
  y: number;
  width: number;
  height: number;
  payload: AnimationEvent["payload"];
  createdAt: number;
  groupId?: string;
}

export interface BoardAnnotation {
  id: string;
  annotationType: "highlight" | "underline" | "circle" | "box";
  targetId: string;
}

export interface BoardSnapshot {
  objects: BoardObject[];
  annotations: BoardAnnotation[];
  objectMap: Record<string, BoardObject>;
  cursors: Record<BoardAnchor, number>;
  usedAnchors: Record<BoardAnchor, boolean>;
}

const VISUAL_EVENT_TYPES = new Set<AnimationEvent["type"]>([
  "write_equation",
  "write_text",
  "draw_line",
  "draw_arrow",
  "draw_rect",
  "draw_circle",
  "draw_axes",
  "plot_curve",
]);

function isVisualEvent(event: AnimationEvent): boolean {
  return VISUAL_EVENT_TYPES.has(event.type);
}

function anchorToZone(anchor: BoardAnchor): BoardZone {
  if (anchor === "work") return "main";
  return anchor;
}

function anchorToLane(anchor: BoardAnchor): BoardLane {
  if (anchor === "work") return "derivation";
  return anchor;
}

function laneToAnchor(lane: BoardLane): BoardAnchor {
  if (lane === "derivation") return "work";
  return lane;
}

function zoneToAnchor(zone: BoardZone): BoardAnchor {
  if (zone === "main") return "work";
  return zone;
}

function makeInitialCursors(): Record<BoardAnchor, number> {
  return {
    given: ANCHOR_BOUNDS.given.y + BOUNDS_PADDING,
    work: ANCHOR_BOUNDS.work.y + BOUNDS_PADDING,
    scratch: ANCHOR_BOUNDS.scratch.y + BOUNDS_PADDING,
    final: ANCHOR_BOUNDS.final.y + BOUNDS_PADDING,
  };
}

function cloneCursors(cursors: Record<BoardAnchor, number>): Record<BoardAnchor, number> {
  return { ...cursors };
}

function eventAnchor(event: AnimationEvent): BoardAnchor {
  if (event.payload.lane) return laneToAnchor(event.payload.lane);
  if (event.payload.anchor) return event.payload.anchor;
  if (event.payload.zone) return zoneToAnchor(event.payload.zone);
  if (event.payload.intent === "result") return "final";
  if (
    event.type === "draw_axes" ||
    event.type === "plot_curve" ||
    event.type === "draw_line" ||
    event.type === "draw_arrow" ||
    event.type === "draw_rect" ||
    event.type === "draw_circle"
  ) {
    return "scratch";
  }
  if (event.type === "write_text") {
    const lower = (event.payload.text ?? "").trim().toLowerCase();
    if (lower.startsWith("given") || lower.startsWith("find")) return "given";
    if (lower.startsWith("final")) return "final";
  }
  return "work";
}

function anchorBottom(anchor: BoardAnchor): number {
  const bounds = ANCHOR_BOUNDS[anchor];
  return bounds.y + bounds.height - BOUNDS_PADDING;
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function hasCollision(
  objects: BoardObject[],
  anchor: BoardAnchor,
  candidate: { x: number; y: number; width: number; height: number },
  ignoreId?: string,
  page = 0
): boolean {
  return objects.some((obj) => {
    if (obj.anchor !== anchor) return false;
    if (obj.page !== page) return false;
    if (ignoreId && obj.id === ignoreId) return false;
    return rectsOverlap(candidate, obj);
  });
}

function clampToAnchor(anchor: BoardAnchor, x: number, y: number, width: number, height: number) {
  const bounds = ANCHOR_BOUNDS[anchor];
  const clampedX = Math.max(
    bounds.x + 6,
    Math.min(x, bounds.x + bounds.width - width - 6)
  );
  const clampedY = Math.max(
    bounds.y + 6,
    Math.min(y, bounds.y + bounds.height - height - 6)
  );
  return { x: clampedX, y: clampedY };
}

function resolveCollisionY(
  objects: BoardObject[],
  anchor: BoardAnchor,
  page: number,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  let nextY = y;
  const maxY = anchorBottom(anchor) - height;
  while (
    nextY <= maxY &&
    hasCollision(objects, anchor, { x, y: nextY, width, height }, undefined, page)
  ) {
    nextY += ITEM_GAP;
  }
  return Math.min(nextY, maxY);
}

function measureFromPoints(points: BoardPoint[]): { width: number; height: number } {
  if (points.length === 0) return { width: 200, height: 120 };
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return {
    width: Math.max(80, maxX - minX),
    height: Math.max(80, maxY - minY),
  };
}

function estimateSize(event: AnimationEvent): { width: number; height: number } {
  if (event.payload.width && event.payload.height) {
    return { width: event.payload.width, height: event.payload.height };
  }

  switch (event.type) {
    case "write_equation": {
      const latex = event.payload.latex ?? "";
      return {
        width: Math.min(900, Math.max(220, latex.length * 14)),
        height: event.payload.display === false ? 50 : 82,
      };
    }
    case "write_text": {
      const text = event.payload.text ?? "";
      return { width: Math.min(680, Math.max(170, text.length * 10)), height: 44 };
    }
    case "draw_line":
    case "draw_arrow": {
      const x1 = event.payload.x1 ?? 0;
      const y1 = event.payload.y1 ?? 0;
      const x2 = event.payload.x2 ?? x1 + 260;
      const y2 = event.payload.y2 ?? y1 + 80;
      return {
        width: Math.max(80, Math.abs(x2 - x1)),
        height: Math.max(40, Math.abs(y2 - y1)),
      };
    }
    case "draw_rect":
      return { width: event.payload.width ?? 220, height: event.payload.height ?? 120 };
    case "draw_circle": {
      const r = event.payload.r ?? 60;
      return { width: r * 2, height: r * 2 };
    }
    case "draw_axes":
      return { width: event.payload.width ?? 340, height: event.payload.height ?? 220 };
    case "plot_curve":
      return measureFromPoints(event.payload.points ?? []);
    default:
      return { width: 220, height: 100 };
  }
}

function recomputeCursor(objects: BoardObject[], anchor: BoardAnchor, page = 0): number {
  const bounds = ANCHOR_BOUNDS[anchor];
  const inAnchor = objects.filter((obj) => obj.anchor === anchor && obj.page === page);
  if (inAnchor.length === 0) return bounds.y + BOUNDS_PADDING;
  const maxBottom = Math.max(...inAnchor.map((obj) => obj.y + obj.height));
  return Math.min(anchorBottom(anchor), maxBottom + ITEM_GAP);
}

function removeObjectById(
  objects: BoardObject[],
  annotations: BoardAnnotation[],
  objectMap: Record<string, BoardObject>,
  id: string
) {
  const idx = objects.findIndex((obj) => obj.id === id);
  if (idx >= 0) objects.splice(idx, 1);
  delete objectMap[id];
  for (let i = annotations.length - 1; i >= 0; i -= 1) {
    if (annotations[i].targetId === id) annotations.splice(i, 1);
  }
}

function clearAnchor(
  objects: BoardObject[],
  annotations: BoardAnnotation[],
  objectMap: Record<string, BoardObject>,
  cursors: Record<BoardAnchor, number>,
  anchor: BoardAnchor,
  page?: number
) {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const samePage = page === undefined || objects[i].page === page;
    if (objects[i].anchor === anchor && samePage) {
      removeObjectById(objects, annotations, objectMap, objects[i].id);
    }
  }
  cursors[anchor] = recomputeCursor(objects, anchor, page ?? 0);
}

function hasRoom(cursors: Record<BoardAnchor, number>, anchor: BoardAnchor, height: number): boolean {
  return cursors[anchor] + height <= anchorBottom(anchor);
}

function compressAnchor(
  objects: BoardObject[],
  anchor: BoardAnchor,
  cursors: Record<BoardAnchor, number>,
  page: number
) {
  const bounds = ANCHOR_BOUNDS[anchor];
  const ordered = objects
    .filter((obj) => obj.anchor === anchor && obj.page === page)
    .sort((a, b) => a.y - b.y || a.createdAt - b.createdAt);

  let cursor = bounds.y + BOUNDS_PADDING;
  for (const obj of ordered) {
    obj.y = cursor;
    cursor = Math.min(anchorBottom(anchor), obj.y + obj.height + ITEM_GAP);
  }
  cursors[anchor] = cursor;
}

function clearScratchOldestFirst(
  objects: BoardObject[],
  annotations: BoardAnnotation[],
  objectMap: Record<string, BoardObject>,
  cursors: Record<BoardAnchor, number>,
  targetAnchor: BoardAnchor,
  targetHeight: number,
  page: number
) {
  while (
    !hasRoom(cursors, targetAnchor, targetHeight) &&
    objects.some((obj) => obj.anchor === "scratch" && obj.page === page)
  ) {
    const oldestScratch = objects
      .filter((obj) => obj.anchor === "scratch" && obj.page === page)
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!oldestScratch) break;
    removeObjectById(objects, annotations, objectMap, oldestScratch.id);
    cursors.scratch = recomputeCursor(objects, "scratch", page);
    cursors[targetAnchor] = recomputeCursor(objects, targetAnchor, page);
  }
}

function clearOldestWorkGroupUntilRoom(
  objects: BoardObject[],
  annotations: BoardAnnotation[],
  objectMap: Record<string, BoardObject>,
  cursors: Record<BoardAnchor, number>,
  targetHeight: number,
  page: number
) {
  while (!hasRoom(cursors, "work", targetHeight)) {
    const workObjects = objects
      .filter((obj) => obj.anchor === "work" && obj.page === page)
      .sort((a, b) => a.createdAt - b.createdAt);
    if (workObjects.length === 0) break;

    const oldest = workObjects[0];
    if (oldest.groupId) {
      const grouped = workObjects.filter((obj) => obj.groupId === oldest.groupId);
      for (const obj of grouped) {
        removeObjectById(objects, annotations, objectMap, obj.id);
      }
    } else {
      removeObjectById(objects, annotations, objectMap, oldest.id);
    }
    cursors.work = recomputeCursor(objects, "work", page);
  }
}

function alignX(event: AnimationEvent, anchor: BoardAnchor, width: number): number {
  if (typeof event.payload.x === "number") return event.payload.x;
  const bounds = ANCHOR_BOUNDS[anchor];
  const laneX = ANCHOR_X_LANES[anchor];

  if (anchor === "work" && event.type === "write_equation" && (event.payload.latex ?? "").includes("=")) {
    return laneX + 58;
  }
  if (event.payload.align === "center") return bounds.x + (bounds.width - width) / 2;
  if (event.payload.align === "right") return bounds.x + bounds.width - width - BOUNDS_PADDING;
  return laneX;
}

function alignY(
  event: AnimationEvent,
  anchor: BoardAnchor,
  cursors: Record<BoardAnchor, number>
): number {
  if (typeof event.payload.y === "number") return event.payload.y;
  return cursors[anchor];
}

function pruneIfNoRoom(
  objects: BoardObject[],
  annotations: BoardAnnotation[],
  objectMap: Record<string, BoardObject>,
  cursors: Record<BoardAnchor, number>,
  anchor: BoardAnchor,
  sizeHeight: number,
  page: number
) {
  if (hasRoom(cursors, anchor, sizeHeight)) return;

  if (anchor !== "scratch") {
    clearScratchOldestFirst(objects, annotations, objectMap, cursors, anchor, sizeHeight, page);
  }
  if (hasRoom(cursors, anchor, sizeHeight)) return;

  if (anchor === "work") {
    compressAnchor(objects, "work", cursors, page);
    if (hasRoom(cursors, "work", sizeHeight)) return;
    clearOldestWorkGroupUntilRoom(objects, annotations, objectMap, cursors, sizeHeight, page);
  } else if (anchor === "scratch") {
    clearScratchOldestFirst(objects, annotations, objectMap, cursors, "scratch", sizeHeight, page);
  } else if (anchor === "given") {
    while (!hasRoom(cursors, "given", sizeHeight)) {
      const oldest = objects
        .filter((obj) => obj.anchor === "given" && obj.page === page)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!oldest) break;
      removeObjectById(objects, annotations, objectMap, oldest.id);
      cursors.given = recomputeCursor(objects, "given", page);
    }
  } else if (anchor === "final") {
    while (!hasRoom(cursors, "final", sizeHeight)) {
      const oldestFinal = objects
        .filter((obj) => obj.anchor === "final" && obj.page === page)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!oldestFinal) break;
      removeObjectById(objects, annotations, objectMap, oldestFinal.id);
      cursors.final = recomputeCursor(objects, "final", page);
    }
  }
}

function buildObject(
  event: AnimationEvent,
  createdAt: number,
  objects: BoardObject[],
  annotations: BoardAnnotation[],
  objectMap: Record<string, BoardObject>,
  cursors: Record<BoardAnchor, number>
): BoardObject {
  const page = event.payload.boardPage ?? 0;
  const lane = event.payload.lane ?? anchorToLane(eventAnchor(event));
  const anchor = laneToAnchor(lane);
  const zone = event.payload.zone ?? anchorToZone(anchor);
  const hasLockedGeometry =
    event.payload.layoutLocked === true &&
    typeof event.payload.x === "number" &&
    typeof event.payload.y === "number" &&
    typeof event.payload.width === "number" &&
    typeof event.payload.height === "number";
  const size = hasLockedGeometry
    ? { width: event.payload.width as number, height: event.payload.height as number }
    : estimateSize(event);

  if (!hasLockedGeometry && typeof event.payload.y !== "number" && page > 0) {
    cursors[anchor] = recomputeCursor(objects, anchor, page);
  }

  if (!hasLockedGeometry && typeof event.payload.y !== "number") {
    pruneIfNoRoom(objects, annotations, objectMap, cursors, anchor, size.height, page);
  }

  let x: number;
  let y: number;
  if (hasLockedGeometry) {
    x = event.payload.x as number;
    y = event.payload.y as number;
  } else {
    x = alignX(event, anchor, size.width);
    y = alignY(event, anchor, cursors);
    const clamped = clampToAnchor(anchor, x, y, size.width, size.height);
    x = clamped.x;
    y = clamped.y;

    if (typeof event.payload.y !== "number") {
      y = resolveCollisionY(objects, anchor, page, x, y, size.width, size.height);
    }
  }

  const groupId = event.payload.groupId;
  const obj: BoardObject = {
    id: event.id,
    type: event.type,
    page,
    lane,
    zone,
    anchor,
    x,
    y,
    width: size.width,
    height: size.height,
    payload: event.payload,
    createdAt,
    groupId,
  };

  cursors[anchor] = Math.min(anchorBottom(anchor), y + size.height + ITEM_GAP);
  return obj;
}

function applyClearEvent(
  event: AnimationEvent,
  objects: BoardObject[],
  annotations: BoardAnnotation[],
  objectMap: Record<string, BoardObject>,
  cursors: Record<BoardAnchor, number>
) {
  const clearPage = typeof event.payload.boardPage === "number" ? event.payload.boardPage : undefined;
  const clearTarget = event.payload.clearTarget ?? "zone";
  if (clearTarget === "id" && event.payload.clearId) {
    const target = objectMap[event.payload.clearId];
    if (target) {
      removeObjectById(objects, annotations, objectMap, target.id);
      cursors[target.anchor] = recomputeCursor(objects, target.anchor, target.page);
    }
    return;
  }

  if (event.payload.clearZone) {
    clearAnchor(
      objects,
      annotations,
      objectMap,
      cursors,
      zoneToAnchor(event.payload.clearZone),
      clearPage
    );
    return;
  }

  let anchor: BoardAnchor = "scratch";
  if (event.payload.anchor) {
    anchor = event.payload.anchor;
  } else if (event.payload.zone) {
    anchor = zoneToAnchor(event.payload.zone);
  }
  clearAnchor(objects, annotations, objectMap, cursors, anchor, clearPage);
}

export function buildBoardSnapshot(events: AnimationEvent[]): BoardSnapshot {
  const sortedEvents = events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const aHasOrder = typeof a.event.payload.renderOrder === "number";
      const bHasOrder = typeof b.event.payload.renderOrder === "number";
      if (aHasOrder && bHasOrder) {
        const diff = (a.event.payload.renderOrder as number) - (b.event.payload.renderOrder as number);
        if (diff !== 0) return diff;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.event);
  const objects: BoardObject[] = [];
  const annotations: BoardAnnotation[] = [];
  const objectMap: Record<string, BoardObject> = {};
  const cursors = makeInitialCursors();

  for (let i = 0; i < sortedEvents.length; i += 1) {
    const event = sortedEvents[i];
    if (event.type === "clear_section") {
      applyClearEvent(event, objects, annotations, objectMap, cursors);
      continue;
    }
    if (event.type === "annotate") {
      if (event.payload.targetId && event.payload.annotationType) {
        annotations.push({
          id: event.id,
          annotationType: event.payload.annotationType,
          targetId: event.payload.targetId,
        });
      }
      continue;
    }
    if (!isVisualEvent(event)) continue;
    const obj = buildObject(event, i, objects, annotations, objectMap, cursors);
    objects.push(obj);
    objectMap[obj.id] = obj;
  }

  const usedAnchors: Record<BoardAnchor, boolean> = {
    given: false,
    work: false,
    scratch: false,
    final: false,
  };
  for (const object of objects) {
    usedAnchors[object.anchor] = true;
  }

  return { objects, annotations, objectMap, cursors, usedAnchors };
}

export function placeActiveEvent(snapshot: BoardSnapshot, event: AnimationEvent | null): BoardObject | null {
  if (!event || !isVisualEvent(event)) return null;
  const objects = [...snapshot.objects];
  const annotations = [...snapshot.annotations];
  const objectMap = { ...snapshot.objectMap };
  const cursors = cloneCursors(snapshot.cursors);
  return buildObject(event, Number.MAX_SAFE_INTEGER, objects, annotations, objectMap, cursors);
}
