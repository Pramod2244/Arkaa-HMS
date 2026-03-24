"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Check, Loader2 } from "lucide-react";

interface TenantCodeFieldProps {
  value: string;
  onChange: (val: string) => void;
  error?: string;
  onBrandingChange?: (branding: { primaryColor: string; name: string } | null) => void;
}

export default function TenantCodeField({
  value,
  onChange,
  error,
  onBrandingChange,
}: TenantCodeFieldProps) {
  const [dot, setDot] = useState<{ color: string; state: "idle" | "loading" | "valid" | "error" }>({
    color: "#E8640A",
    state: "idle",
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorId = "tenant-code-error";

  const lookup = useCallback(
    async (code: string) => {
      if (code.length < 3) {
        setDot({ color: "#E8640A", state: "idle" });
        onBrandingChange?.(null);
        return;
      }
      setDot((d) => ({ ...d, state: "loading" }));
      try {
        const res = await fetch(`/api/tenant/branding?code=${encodeURIComponent(code)}`);
        if (res.ok) {
          const data = await res.json();
          setDot({ color: data.primaryColor ?? "#4CAF50", state: "valid" });
          onBrandingChange?.(data);
        } else {
          setDot({ color: "#E8D8C8", state: "error" });
          onBrandingChange?.(null);
        }
      } catch {
        setDot({ color: "#E8D8C8", state: "error" });
        onBrandingChange?.(null);
      }
    },
    [onBrandingChange]
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => lookup(value), 600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, lookup]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label
        htmlFor="tenant-code-input"
        style={{ fontSize: 12, fontWeight: 500, color: "#8A7060", letterSpacing: "0.02em" }}
      >
        Tenant Code
      </label>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 11,
            display: "flex",
            alignItems: "center",
            color: "#C0A890",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <Lock size={14} />
        </span>
        <input
          id="tenant-code-input"
          type="text"
          autoComplete="organization"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="e.g. MEDCITY"
          aria-label="Tenant Code"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          style={{
            width: "100%",
            height: 40,
            background: "#FFFAF6",
            border: `0.5px solid ${error ? "#E24B4A" : "#E8D8C8"}`,
            borderRadius: 8,
            paddingLeft: 36,
            paddingRight: 40,
            fontSize: 13,
            color: "#1A1208",
            outline: "none",
            letterSpacing: "0.04em",
            fontWeight: 500,
          }}
          onFocus={(e) => {
            e.target.style.boxShadow = "0 0 0 3px rgba(232,100,10,0.10)";
            e.target.style.borderColor = "#E8640A";
          }}
          onBlur={(e) => {
            e.target.style.boxShadow = "none";
            e.target.style.borderColor = error ? "#E24B4A" : "#E8D8C8";
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 12,
            display: "flex",
            alignItems: "center",
          }}
        >
          {dot.state === "loading" ? (
            <Loader2 size={13} color="#C0A890" className="animate-spin" />
          ) : dot.state === "valid" ? (
            <Check size={13} color="#4CAF50" strokeWidth={2.5} />
          ) : (
            <div
              style={{ width: 12, height: 12, borderRadius: "50%", background: dot.color, transition: "background 0.3s" }}
            />
          )}
        </span>
      </div>
      {error && (
        <span id={errorId} role="alert" style={{ fontSize: 11, color: "#E24B4A", marginTop: 2 }}>
          {error}
        </span>
      )}
    </div>
  );
}
