"use client";
import React from "react";

interface ArkaaLogoProps {
  size?: number;
  color?: string;
}

// 8 spokes at 45-degree intervals, inner radius 9, outer radius 16
const SPOKE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function ArkaaLogo({ size = 34, color = "#E8640A" }: ArkaaLogoProps) {
  const cx = 17;
  const cy = 17;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 34 34"
      aria-hidden="true"
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      <circle cx={cx} cy={cy} r={7} fill={color} />
      {SPOKE_ANGLES.map((angle) => {
        const from = polarToCartesian(cx, cy, 9, angle);
        const to = polarToCartesian(cx, cy, 16, angle);
        return (
          <line
            key={angle}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
