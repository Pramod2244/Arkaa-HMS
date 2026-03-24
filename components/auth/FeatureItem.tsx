"use client";
import React from "react";

interface FeatureItemProps {
  icon: React.ReactNode;
  text: string;
}

export default function FeatureItem({ icon, text }: FeatureItemProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 28,
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFF0E2",
          border: "0.5px solid #F0B07A",
          borderRadius: 7,
          flexShrink: 0,
          color: "#E8640A",
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: 12, color: "#8A7060", lineHeight: 1.4 }}>{text}</span>
    </div>
  );
}
