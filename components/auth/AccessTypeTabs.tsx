"use client";
import React from "react";

const TABS = [
  { label: "Platform Admin" },
  { label: "Tenant Manager" },
  { label: "Audit Access" },
];

export default function AccessTypeTabs({ active = 0 }: { active?: number }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {TABS.map((tab, i) => {
        const isActive = i === active;
        return (
          <div
            key={tab.label}
            style={{
              fontSize: 11,
              fontWeight: isActive ? 500 : 400,
              padding: "5px 10px",
              borderRadius: 20,
              background: isActive ? "#FFF0E2" : "#FFFAF6",
              border: `0.5px solid ${isActive ? "#F0B07A" : "#F0E8DC"}`,
              color: isActive ? "#C25A0A" : "#C0A890",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </div>
        );
      })}
    </div>
  );
}
