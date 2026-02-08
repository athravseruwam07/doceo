"use client";

import { useEffect, useMemo, useState } from "react";
import { Group, Image as KonvaImage, Rect } from "react-konva";
import { getMathJaxSvg } from "@/lib/mathjax-svg";

interface EquationSpriteProps {
  latex: string;
  display: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  progress?: number;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function humanizedProgress(raw: number, latex: string): number {
  const operatorCount = (latex.match(/[=+\-]/g) ?? []).length;
  const operatorSlowdown = Math.min(0.12, operatorCount * 0.012);
  const jitter = Math.sin(raw * Math.PI * 7) * 0.01;
  return clamp(easeInOut(raw) * (1 - operatorSlowdown) + jitter);
}

export default function EquationSprite({
  latex,
  display,
  x,
  y,
  width,
  height,
  progress = 1,
}: EquationSpriteProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const reveal = useMemo(() => humanizedProgress(progress, latex), [progress, latex]);

  useEffect(() => {
    let disposed = false;

    getMathJaxSvg(latex, display, 1).then((asset) => {
      if (disposed) return;
      const img = new window.Image();
      img.onload = () => {
        if (!disposed) setImage(img);
      };
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.svg)}`;
    });

    return () => {
      disposed = true;
    };
  }, [latex, display]);

  if (!image) {
    return (
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="rgba(0, 0, 0, 0)"
        cornerRadius={8}
      />
    );
  }

  return (
    <Group x={x} y={y} clipX={0} clipY={0} clipWidth={Math.max(1, width * reveal)} clipHeight={height}>
      <KonvaImage image={image} x={0} y={0} width={width} height={height} listening={false} />
    </Group>
  );
}
