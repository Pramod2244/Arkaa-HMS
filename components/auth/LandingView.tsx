"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import ArkaaBrand from "@/components/brand/ArkaaBrand";
import DotPatternBg from "@/components/auth/DotPatternBg";

const STATS = [
  { value: "3,000+", label: "Active Users" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "50+", label: "Healthcare Facilities" },
];

export default function LandingView() {
  return (
    <div style={{ minHeight: "100vh", background: "#FFFAF5", position: "relative", overflow: "hidden" }}>
      <DotPatternBg />

      {/* Top bar */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 40px",
          borderBottom: "0.5px solid #F0E8DC",
          background: "rgba(255,250,245,0.85)",
          backdropFilter: "blur(8px)",
        }}
      >
        <ArkaaBrand />
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/login">
            <button
              style={{
                height: 36,
                padding: "0 20px",
                borderRadius: 8,
                background: "#E8640A",
                color: "#fff",
                fontSize: 13,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
              }}
            >
              Tenant Login
            </button>
          </Link>
          <Link href="/superadmin/login">
            <button
              style={{
                height: 36,
                padding: "0 20px",
                borderRadius: 8,
                background: "transparent",
                color: "#C25A0A",
                fontSize: 13,
                fontWeight: 500,
                border: "0.5px solid #F0B07A",
                cursor: "pointer",
              }}
            >
              Super Admin
            </button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "calc(100vh - 81px)",
          padding: "60px 24px 80px",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ maxWidth: 640, width: "100%" }}
        >
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#FFF0E2",
              border: "0.5px solid #F0B07A",
              borderRadius: 20,
              padding: "5px 14px",
              fontSize: 12,
              color: "#C25A0A",
              fontWeight: 500,
              marginBottom: 28,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8640A", display: "inline-block" }} />
            Trusted by 50+ healthcare facilities
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 52px)",
              fontWeight: 700,
              color: "#1A1208",
              lineHeight: 1.15,
              marginBottom: 20,
              letterSpacing: "-0.02em",
            }}
          >
            Healthcare Management,{" "}
            <span style={{ color: "#E8640A" }}>Simplified</span>
          </h1>

          {/* Subtext */}
          <p
            style={{
              fontSize: "clamp(14px, 2vw, 16px)",
              color: "#8A7060",
              lineHeight: 1.7,
              marginBottom: 36,
              maxWidth: 500,
              margin: "0 auto 36px",
            }}
          >
            A complete multi-tenant HIMS platform for hospitals and clinics — patient management,
            OPD queues, prescriptions, and more.
          </p>

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/login">
              <button
                style={{
                  height: 44,
                  padding: "0 28px",
                  borderRadius: 10,
                  background: "#E8640A",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(232,100,10,0.25)",
                }}
              >
                Login to Your Hospital →
              </button>
            </Link>
            <Link href="/superadmin/login">
              <button
                style={{
                  height: 44,
                  padding: "0 28px",
                  borderRadius: 10,
                  background: "transparent",
                  color: "#C25A0A",
                  fontSize: 14,
                  fontWeight: 500,
                  border: "0.5px solid #F0B07A",
                  cursor: "pointer",
                }}
              >
                Platform Administration
              </button>
            </Link>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
          style={{
            display: "flex",
            gap: 0,
            marginTop: 64,
            background: "#FFFFFF",
            border: "0.5px solid #F0E8DC",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {STATS.map((s, i) => (
            <div
              key={s.label}
              style={{
                padding: "20px 40px",
                borderRight: i < STATS.length - 1 ? "0.5px solid #F0E8DC" : "none",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: "#E8640A" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#8A7060", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
