"use client";
import React, { useEffect, useState } from "react";

type StatusType = "online" | "offline" | "degraded";

export default function StatusChip() {
  const [status, setStatus] = useState<StatusType>("online");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        if (d?.status === "degraded") setStatus("degraded");
        else if (d?.status === "offline") setStatus("offline");
        else setStatus("online");
      })
      .catch(() => setStatus("online"));
  }, []);

  const dotColor =
    status === "online" ? "#4CAF50" : status === "degraded" ? "#F59E0B" : "#EF4444";
  const label = status === "online" ? "Platform Live" : status === "degraded" ? "Degraded" : "Offline";
  const sublabel =
    status === "online"
      ? "All systems operational"
      : status === "degraded"
      ? "Some systems affected"
      : "Service unavailable";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "#FFFFFF",
        border: "0.5px solid #F0E8DC",
        borderRadius: 10,
        padding: "7px 12px",
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
        }}
      />
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: 12, color: "#1A1208", fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: "#8A7060" }}>{sublabel}</div>
      </div>
    </div>
  );
}
