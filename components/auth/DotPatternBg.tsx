"use client";
import React from "react";

export default function DotPatternBg() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "radial-gradient(circle, #F0B07A 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        opacity: 0.22,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
