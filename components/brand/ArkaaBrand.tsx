"use client";
import React from "react";
import ArkaaLogo from "./ArkaaLogo";

interface ArkaaBrandProps {
  logoColor?: string;
}

export default function ArkaaBrand({ logoColor = "#E8640A" }: ArkaaBrandProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "default" }}>
      <ArkaaLogo size={34} color={logoColor} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "#E8640A",
            letterSpacing: "0.01em",
          }}
        >
          Arkaa Digital
        </span>
        <span
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "#C0A890",
            marginTop: 2,
          }}
        >
          HIMS Platform
        </span>
      </div>
    </div>
  );
}
