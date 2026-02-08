"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Arrow, Circle, Ellipse, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { AnimationEvent, BoardAnchor, TimelineSegment } from "@/lib/types";
import { useTheme } from "@/hooks/useTheme";
import {
  ANCHOR_LABELS,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BoardObject,
  buildBoardSnapshot,
  placeActiveEvent,
  getEffectiveBounds,
} from "@/lib/boardLayout";
import AnimatedEquation from "./AnimatedEquation";
import AnimatedText from "./AnimatedText";

interface WhiteboardStageProps {
  completedVisuals: AnimationEvent[];
  activeVisual: AnimationEvent | null;
  activeVisualProgress: number;
  currentSegment: TimelineSegment | null;
  isPlaying: boolean;
  overlayActive?: boolean;
}

interface StageSize {
  width: number;
  height: number;
}

interface ThemePalette {
  pageBg: string;
  boardBg: string;
  boardShadow: string;
  boardTexture: string;
  label: string;
  ink: string;
  inkSoft: string;
  accent: string;
  highlight: string;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function readCssColor(token: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
}

function resolveThemePalette(isDark: boolean): ThemePalette {
  if (isDark) {
    return {
      pageBg: readCssColor("--board-page-bg", "#0d1620"),
      boardBg: readCssColor("--board-bg", "#172431"),
      boardShadow: "rgba(0, 0, 0, 0.42)",
      boardTexture: "rgba(146, 186, 219, 0.08)",
      label: readCssColor("--board-muted", "rgba(208, 227, 241, 0.66)"),
      ink: readCssColor("--board-ink", "#eaf4fc"),
      inkSoft: "rgba(206, 228, 246, 0.72)",
      accent: readCssColor("--board-focus", "#7cc0ff"),
      highlight: readCssColor("--board-highlight", "rgba(188, 201, 121, 0.18)"),
    };
  }

  return {
    pageBg: readCssColor("--board-page-bg", "#e6eef5"),
    boardBg: readCssColor("--board-bg", "#f8fcff"),
    boardShadow: "rgba(18, 40, 58, 0.14)",
    boardTexture: "rgba(56, 98, 130, 0.08)",
    label: readCssColor("--board-muted", "rgba(28, 58, 81, 0.64)"),
    ink: readCssColor("--board-ink", "#18384d"),
    inkSoft: "rgba(35, 69, 92, 0.74)",
    accent: readCssColor("--board-focus", "#2d8ce7"),
    highlight: readCssColor("--board-highlight", "rgba(211, 186, 95, 0.22)"),
  };
}

function isTextLike(obj: BoardObject): boolean {
  return obj.type === "write_equation" || obj.type === "write_text";
}

function shouldSkipLabelLikeText(obj: BoardObject): boolean {
  if (obj.type !== "write_text") return false;
  const text = (obj.payload.text ?? "").trim().toLowerCase();
  if (obj.anchor === "given" && (text === "given" || text === "given:")) return true;
  if (obj.anchor === "scratch" && (text === "scratch" || text === "scratch:")) return true;
  if (obj.anchor === "work" && (text === "work" || text === "work:")) return true;
  if (obj.anchor === "final" && (text === "final" || text === "final:")) return true;
  return false;
}

function drawGraphicObject(
  obj: BoardObject,
  palette: ThemePalette,
  progress = 1,
  isActive = false
) {
  const opacity = isActive ? 0.82 + progress * 0.18 : 1;
  const strokeColor = obj.payload.style?.color ?? palette.ink;
  const strokeWidth = obj.payload.style?.strokeWidth ?? 3;

  if (obj.type === "draw_line" || obj.type === "draw_arrow") {
    const x1 = obj.payload.x1 ?? obj.x;
    const y1 = obj.payload.y1 ?? obj.y;
    const x2 = obj.payload.x2 ?? obj.x + obj.width;
    const y2 = obj.payload.y2 ?? obj.y + obj.height;
    const px = x1 + (x2 - x1) * progress;
    const py = y1 + (y2 - y1) * progress;

    if (obj.type === "draw_arrow") {
      return (
        <Group>
          <Arrow
            points={[x1, y1, px, py]}
            stroke={strokeColor}
            fill={strokeColor}
            strokeWidth={strokeWidth}
            pointerLength={12}
            pointerWidth={10}
            lineCap="round"
            lineJoin="round"
            opacity={opacity}
          />
          {obj.payload.label && progress > 0.7 && (
            <Text
              x={Math.min(x1, x2)}
              y={Math.min(y1, y2) - 24}
              text={obj.payload.label}
              fontSize={20}
              fill={palette.inkSoft}
            />
          )}
        </Group>
      );
    }

    return (
      <Line
        points={[x1, y1, px, py]}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        lineCap="round"
        lineJoin="round"
        opacity={opacity}
      />
    );
  }

  if (obj.type === "draw_rect") {
    return (
      <Rect
        x={obj.x}
        y={obj.y}
        width={obj.width * progress}
        height={obj.height}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        cornerRadius={8}
        opacity={opacity}
      />
    );
  }

  if (obj.type === "draw_circle") {
    const r = (obj.payload.r ?? obj.width / 2) * progress;
    return (
      <Circle
        x={obj.payload.cx ?? obj.x + obj.width / 2}
        y={obj.payload.cy ?? obj.y + obj.height / 2}
        radius={Math.max(1, r)}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={opacity}
      />
    );
  }

  if (obj.type === "draw_axes") {
    const ticks = obj.payload.ticks ?? 4;
    const x = obj.x;
    const y = obj.y;
    const w = obj.width;
    const h = obj.height;
    return (
      <Group opacity={opacity}>
        <Line points={[x, y + h, x + w * progress, y + h]} stroke={strokeColor} strokeWidth={strokeWidth} />
        <Line points={[x, y + h, x, y + h - h * progress]} stroke={strokeColor} strokeWidth={strokeWidth} />
        {Array.from({ length: ticks }).map((_, idx) => {
          const tx = x + ((idx + 1) / ticks) * w * progress;
          const ty = y + h - ((idx + 1) / ticks) * h * progress;
          return (
            <Group key={idx}>
              <Line points={[tx, y + h - 7, tx, y + h + 7]} stroke={strokeColor} strokeWidth={2} />
              <Line points={[x - 7, ty, x + 7, ty]} stroke={strokeColor} strokeWidth={2} />
            </Group>
          );
        })}
        {obj.payload.xLabel && <Text x={x + w + 10} y={y + h - 16} text={obj.payload.xLabel} fontSize={20} fill={palette.inkSoft} />}
        {obj.payload.yLabel && <Text x={x - 20} y={y - 26} text={obj.payload.yLabel} fontSize={20} fill={palette.inkSoft} />}
      </Group>
    );
  }

  if (obj.type === "plot_curve") {
    const points = obj.payload.points ?? [];
    if (points.length < 2) return null;
    const revealCount = Math.max(2, Math.floor(points.length * progress));
    const linePoints = points.slice(0, revealCount).flatMap((p) => [p.x, p.y]);
    return (
      <Line
        points={linePoints}
        stroke={obj.payload.style?.color ?? "#2A6EA0"}
        strokeWidth={strokeWidth}
        lineCap="round"
        lineJoin="round"
        opacity={opacity}
      />
    );
  }

  return null;
}

function annotationShape(
  annotationType: "highlight" | "underline" | "circle" | "box",
  target: BoardObject,
  key: string,
  palette: ThemePalette
) {
  if (annotationType === "highlight") {
    return (
      <Rect
        key={key}
        x={target.x - 8}
        y={target.y + target.height * 0.52}
        width={target.width + 16}
        height={Math.max(14, target.height * 0.45)}
        fill={palette.highlight}
        cornerRadius={5}
      />
    );
  }
  if (annotationType === "underline") {
    return (
      <Line
        key={key}
        points={[
          target.x - 2,
          target.y + target.height + 7,
          target.x + target.width + 2,
          target.y + target.height + 7,
        ]}
        stroke={palette.accent}
        strokeWidth={4}
        lineCap="round"
      />
    );
  }
  if (annotationType === "circle") {
    return (
      <Ellipse
        key={key}
        x={target.x + target.width / 2}
        y={target.y + target.height / 2}
        radiusX={target.width / 2 + 18}
        radiusY={target.height / 2 + 12}
        stroke={palette.accent}
        strokeWidth={3}
      />
    );
  }
  const canUseFinalBox = target.anchor === "final" || target.payload.intent === "result";
  if (!canUseFinalBox) {
    return (
      <Line
        key={key}
        points={[
          target.x + 2,
          target.y + target.height + 8,
          target.x + target.width - 2,
          target.y + target.height + 8,
        ]}
        stroke={palette.accent}
        strokeWidth={3}
        lineCap="round"
      />
    );
  }
  return (
    <Rect
      key={key}
      x={target.x - 8}
      y={target.y - 8}
      width={target.width + 16}
      height={target.height + 16}
      stroke={palette.accent}
      strokeWidth={2.5}
      cornerRadius={8}
      shadowBlur={0}
    />
  );
}

function renderTextObject(
  obj: BoardObject,
  scale: number,
  offsetX: number,
  offsetY: number,
  progress: number,
  isActive: boolean,
  isDark: boolean,
  key: string
) {
  if (shouldSkipLabelLikeText(obj)) return null;
  const left = offsetX + obj.x * scale;
  const top = offsetY + obj.y * scale;
  const width = obj.width * scale;
  const minHeight = obj.height * scale;

  return (
    <div
      key={key}
      className={`board-v2-item ${isDark ? "is-dark" : "is-light"}`}
      style={{ left, top, width, minHeight }}
    >
      {obj.type === "write_equation" ? (
        <AnimatedEquation
          latex={obj.payload.latex ?? ""}
          duration={obj.payload.display === false ? 520 : 950}
          display={obj.payload.display ?? true}
          isAnimating={isActive}
          animationProgress={isActive ? progress : 1}
          teachingPhase={obj.payload.teachingPhase}
        />
      ) : (
        <AnimatedText
          text={obj.payload.text ?? ""}
          duration={Math.max(450, (obj.payload.text ?? "").length * 20)}
          isAnimating={isActive}
          animationProgress={isActive ? progress : 1}
          teachingPhase={obj.payload.teachingPhase}
        />
      )}
    </div>
  );
}

function getCueObject(
  snapshot: ReturnType<typeof buildBoardSnapshot>,
  activeVisual: AnimationEvent | null,
  activeObject: BoardObject | null,
  currentPage: number
): BoardObject | null {
  if (!activeVisual) {
    if (activeObject?.page === currentPage) return activeObject;
    return null;
  }

  if (activeVisual.type === "annotate" && activeVisual.payload.targetId) {
    const target = snapshot.objectMap[activeVisual.payload.targetId];
    if (target && target.page === currentPage) return target;
  }
  if (activeVisual.payload.focusTarget) {
    const target = snapshot.objectMap[activeVisual.payload.focusTarget];
    if (target && target.page === currentPage) return target;
  }
  if (activeObject?.page === currentPage) return activeObject;
  return null;
}

function collectVisibleLabels(
  objects: BoardObject[],
  activeAnchor: BoardAnchor | null
): BoardAnchor[] {
  const used = new Set<BoardAnchor>(objects.map((obj) => obj.anchor));
  const labels: BoardAnchor[] = [];
  (Object.keys(ANCHOR_LABELS) as BoardAnchor[]).forEach((anchor) => {
    if (used.has(anchor) || anchor === activeAnchor) labels.push(anchor);
  });
  return labels;
}

export default function WhiteboardStage({
  completedVisuals,
  activeVisual,
  activeVisualProgress,
  currentSegment,
  isPlaying,
  overlayActive,
}: WhiteboardStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<StageSize>({ width: 1200, height: 760 });
  const [scratchTrayState, setScratchTrayState] = useState<{ open: boolean; step: number | null }>({
    open: false,
    step: null,
  });
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      setStageSize({
        width: Math.max(320, rect.width),
        height: Math.max(220, rect.height),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const palette = useMemo(() => resolveThemePalette(isDark), [isDark]);
  const snapshot = useMemo(() => buildBoardSnapshot(completedVisuals), [completedVisuals]);
  const activeObject = useMemo(() => placeActiveEvent(snapshot, activeVisual), [snapshot, activeVisual]);
  const activeProgress = clamp(activeVisualProgress);

  const currentPage = useMemo(() => {
    if (activeObject) return activeObject.page;
    if (typeof activeVisual?.payload.boardPage === "number") return activeVisual.payload.boardPage;
    if (snapshot.objects.length === 0) return 0;
    return snapshot.objects[snapshot.objects.length - 1].page;
  }, [activeObject, activeVisual, snapshot.objects]);

  const totalPages = useMemo(() => {
    const pages = [
      ...snapshot.objects.map((obj) => obj.page),
      typeof activeObject?.page === "number" ? activeObject.page : 0,
      typeof activeVisual?.payload.boardPage === "number" ? activeVisual.payload.boardPage : 0,
    ];
    return Math.max(1, Math.max(...pages) + 1);
  }, [snapshot.objects, activeObject, activeVisual]);

  const pageTurnMessage = activeVisual?.payload.isPageTurnMarker && activeProgress < 0.65
    ? `Continue on board ${currentPage + 1}`
    : null;

  const scale = Math.min(stageSize.width / BOARD_WIDTH, stageSize.height / BOARD_HEIGHT);
  const contentWidth = BOARD_WIDTH * scale;
  const contentHeight = BOARD_HEIGHT * scale;
  const offsetX = (stageSize.width - contentWidth) / 2;
  const offsetY = (stageSize.height - contentHeight) / 2;
  const compactMode = stageSize.width < 980;
  const currentStepNumber = currentSegment?.stepNumber ?? null;
  const isScratchTrayOpen =
    compactMode &&
    scratchTrayState.open &&
    scratchTrayState.step === currentStepNumber &&
    !overlayActive;

  const pageObjects = useMemo(
    () => snapshot.objects.filter((obj) => obj.page === currentPage),
    [snapshot.objects, currentPage]
  );

  const hasScratchContent = useMemo(
    () => pageObjects.some((obj) => obj.anchor === "scratch"),
    [pageObjects]
  );
  const { bounds: effectiveBounds, labels: effectiveLabels } = useMemo(
    () => getEffectiveBounds(hasScratchContent),
    [hasScratchContent]
  );

  const scratchObjects = useMemo(
    () => pageObjects.filter((obj) => obj.anchor === "scratch"),
    [pageObjects]
  );
  const visiblePageObjects = useMemo(
    () => (compactMode ? pageObjects.filter((obj) => obj.anchor !== "scratch") : pageObjects),
    [compactMode, pageObjects]
  );
  const textObjects = visiblePageObjects.filter(isTextLike);
  const graphicObjects = visiblePageObjects.filter((obj) => !isTextLike(obj));
  const activeOnPage = activeObject && activeObject.page === currentPage ? activeObject : null;
  const activeVisibleObject =
    activeOnPage && !(compactMode && activeOnPage.anchor === "scratch")
      ? activeOnPage
      : null;
  const activeIsText = activeVisibleObject ? isTextLike(activeVisibleObject) : false;

  const cueObject = getCueObject(snapshot, activeVisual, activeVisibleObject, currentPage);
  const cueTarget = cueObject && !(compactMode && cueObject.anchor === "scratch")
    && cueObject.anchor === "work"
    ? { x: cueObject.x, y: cueObject.y, width: cueObject.width, height: cueObject.height, anchor: cueObject.anchor }
    : null;
  const cueStyle = cueTarget
    ? {
        left: offsetX + (effectiveBounds.work.x + 92) * scale,
        top: offsetY + cueTarget.y * scale - 2,
        width: Math.max(2, scale * 2.5),
        height: cueTarget.height * scale + 4,
      }
    : null;
  const activeLineStyle = cueTarget
    ? {
        left: offsetX + cueTarget.x * scale,
        top: offsetY + (cueTarget.y + cueTarget.height + 4) * scale,
        width: cueTarget.width * scale,
      }
    : null;

  const derivationGuideStyle = {
    left: offsetX + (effectiveBounds.work.x + 96) * scale,
    top: offsetY + (effectiveBounds.work.y + 6) * scale,
    height: (effectiveBounds.work.height - 12) * scale,
  };
  const labelAnchors = collectVisibleLabels(
    visiblePageObjects,
    cueObject?.anchor ?? activeOnPage?.anchor ?? null
  ).filter((anchor) => hasScratchContent || anchor !== "scratch");
  const derivationGuide = isDark ? "rgba(178, 214, 242, 0.12)" : "rgba(53, 105, 138, 0.14)";

  return (
    <div className={`board-v2-shell h-full rounded-xl overflow-hidden ${isDark ? "is-dark" : "is-light"}`}>
      {currentSegment && currentSegment.stepNumber > 0 && (
        <div className="board-v2-step-indicator">
          <span className="board-v2-step-pill">Step {currentSegment.stepNumber}</span>
          {currentSegment.stepTitle && (
            <span className="board-v2-step-title">{currentSegment.stepTitle}</span>
          )}
          <span className="board-v2-page-indicator">Board {currentPage + 1} / {totalPages}</span>
        </div>
      )}

      <div ref={containerRef} className="board-v2-stage-wrap">
        <Stage width={stageSize.width} height={stageSize.height}>
          <Layer>
            <Rect
              x={offsetX}
              y={offsetY}
              width={contentWidth}
              height={contentHeight}
              fill={palette.boardBg}
              cornerRadius={18}
              shadowColor={palette.boardShadow}
              shadowBlur={20}
              shadowOffsetY={8}
            />
            <Rect
              x={offsetX}
              y={offsetY}
              width={contentWidth}
              height={contentHeight}
              fillLinearGradientStartPoint={{ x: offsetX, y: offsetY }}
              fillLinearGradientEndPoint={{ x: offsetX + contentWidth, y: offsetY + contentHeight }}
              fillLinearGradientColorStops={[0, "rgba(255,255,255,0.035)", 1, "rgba(0,0,0,0.035)"]}
              cornerRadius={18}
              listening={false}
            />
            <Rect
              x={offsetX}
              y={offsetY}
              width={contentWidth}
              height={contentHeight}
              fill={palette.boardTexture}
              opacity={0.12}
              cornerRadius={18}
              listening={false}
            />
          </Layer>

          <Layer x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
            <Line
              points={[
                effectiveBounds.final.x + 8,
                effectiveBounds.final.y - 8,
                effectiveBounds.final.x + effectiveBounds.final.width - 8,
                effectiveBounds.final.y - 8,
              ]}
              stroke={isDark ? "rgba(177, 209, 236, 0.1)" : "rgba(40, 90, 124, 0.12)"}
              strokeWidth={1}
              listening={false}
            />
            <Line
              points={[
                effectiveBounds.work.x + 96,
                effectiveBounds.work.y + 8,
                effectiveBounds.work.x + 96,
                effectiveBounds.work.y + effectiveBounds.work.height - 12,
              ]}
              stroke={derivationGuide}
              strokeWidth={1.5}
              listening={false}
            />
            {labelAnchors.map((anchor) => (
              compactMode && anchor === "scratch"
                ? null
                : (
              <Text
                key={anchor}
                x={effectiveLabels[anchor].x}
                y={effectiveLabels[anchor].y}
                text={effectiveLabels[anchor].text}
                fontSize={22}
                fill={palette.label}
                fontStyle="bold"
              />
                )
            ))}
          </Layer>

          <Layer x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
            {graphicObjects.map((obj) => (
              <Group key={obj.id} listening={false}>
                {drawGraphicObject(obj, palette)}
              </Group>
            ))}
            {activeVisibleObject && !activeIsText && activeVisual && (
              <Group key={`active-${activeVisual.id}`} listening={false}>
                {drawGraphicObject(activeVisibleObject, palette, activeProgress, true)}
              </Group>
            )}
          </Layer>

          <Layer x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
            {snapshot.annotations.map((annotation) => {
              const target = snapshot.objectMap[annotation.targetId];
              if (!target || target.page !== currentPage) return null;
              if (compactMode && target.anchor === "scratch") return null;
              return annotationShape(annotation.annotationType, target, annotation.id, palette);
            })}
            {activeVisual?.type === "annotate" &&
              activeVisual.payload.targetId &&
              activeVisual.payload.annotationType &&
              snapshot.objectMap[activeVisual.payload.targetId] &&
              snapshot.objectMap[activeVisual.payload.targetId].page === currentPage &&
              (!compactMode || snapshot.objectMap[activeVisual.payload.targetId].anchor !== "scratch") &&
              annotationShape(
                activeVisual.payload.annotationType,
                snapshot.objectMap[activeVisual.payload.targetId],
                `active-annotation-${activeVisual.id}`,
                palette
              )}
          </Layer>
        </Stage>

        <div className="board-v2-html-layer" aria-hidden>
          {textObjects.map((obj) =>
            renderTextObject(obj, scale, offsetX, offsetY, 1, false, isDark, obj.id)
          )}
          {activeVisibleObject && activeVisual && activeIsText &&
            renderTextObject(
              activeVisibleObject,
              scale,
              offsetX,
              offsetY,
              activeProgress,
              true,
              isDark,
              `active-${activeVisual.id}`
            )}
        </div>

        {pageTurnMessage && (
          <div className="board-v2-page-turn">{pageTurnMessage}</div>
        )}

        <div className="board-v2-derivation-guide" style={derivationGuideStyle} />
        {cueStyle && (
          <div
            className={`board-v2-row-marker ${isPlaying ? "is-playing" : "is-paused"}`}
            style={cueStyle}
          />
        )}
        {activeLineStyle && (
          <div
            className={`board-v2-active-line ${isPlaying ? "is-playing" : "is-paused"}`}
            style={activeLineStyle}
          />
        )}

        {compactMode && (
          <div className={`board-v2-scratch-tray ${isScratchTrayOpen ? "is-open" : ""}`}>
            <button
              className="board-v2-scratch-toggle"
              type="button"
              onClick={() =>
                setScratchTrayState((prev) => ({
                  open: !(prev.open && prev.step === currentStepNumber),
                  step: currentStepNumber,
                }))
              }
            >
              Scratch
              <span>{scratchObjects.length}</span>
            </button>
            {isScratchTrayOpen && (
              <div className="board-v2-scratch-list">
                {scratchObjects.length === 0 && (
                  <p className="board-v2-scratch-empty">Scratch work will appear here.</p>
                )}
                {scratchObjects.map((obj) => (
                  <div key={`tray-${obj.id}`} className="board-v2-scratch-item">
                    {obj.type === "write_equation" ? (
                      <AnimatedEquation
                        latex={obj.payload.latex ?? ""}
                        duration={700}
                        display={obj.payload.display ?? true}
                        isAnimating={false}
                        animationProgress={1}
                        teachingPhase={obj.payload.teachingPhase}
                      />
                    ) : obj.type === "write_text" ? (
                      <AnimatedText
                        text={obj.payload.text ?? ""}
                        duration={600}
                        isAnimating={false}
                        animationProgress={1}
                        teachingPhase={obj.payload.teachingPhase}
                      />
                    ) : (
                      <p className="board-v2-scratch-diagram">Diagram update</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
