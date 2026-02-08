"use client";

import { Circle, Group, Line } from "react-konva";

interface BoardCursorProps {
  x: number;
  y: number;
  visible: boolean;
}

export default function BoardCursor({ x, y, visible }: BoardCursorProps) {
  if (!visible) return null;

  return (
    <Group x={x} y={y} listening={false}>
      <Circle x={0} y={0} radius={6} fill="rgba(27, 27, 27, 0.16)" />
      <Line
        points={[-1, -7, 2, 8]}
        stroke="#2F3B44"
        strokeWidth={3}
        lineCap="round"
      />
      <Circle x={2} y={8} radius={2.2} fill="#1B6B52" />
    </Group>
  );
}
