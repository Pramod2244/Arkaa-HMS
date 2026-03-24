"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Users, Stethoscope, BarChart3 } from "lucide-react";
import ArkaaBrand from "@/components/brand/ArkaaBrand";
import DotPatternBg from "@/components/auth/DotPatternBg";
import StatusChip from "@/components/auth/StatusChip";
import FeatureItem from "@/components/auth/FeatureItem";
import TenantCodeField from "@/components/auth/TenantCodeField";
import FormInput from "@/components/auth/FormInput";

export default function LoginPage() {
  const router = useRouter();
  const [tenantCode, setTenantCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tenantColor, setTenantColor] = useState("#E8640A");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const code = tenantCode.trim().toUpperCase();
    const em = email.trim();
    const p = password;
    if (!code || !em || !p) {
      setError("Tenant code, email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantCode: code, email: em, password: p }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        setLoading(false);
        return;
      }
      router.push(data.redirect ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1fr 400px",
        background: "#FFFAF5",
      }}
    >
      {/* Left Panel */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 64px",
          overflow: "hidden",
        }}
      >
        <DotPatternBg />
        <div style={{ position: "relative", zIndex: 10, maxWidth: 420 }}>
          <div style={{ marginBottom: 40 }}>
            <ArkaaBrand />
          </div>

          <h2
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#1A1208",
              lineHeight: 1.25,
              marginBottom: 12,
              letterSpacing: "-0.01em",
            }}
          >
            Your hospital,<br />fully connected.
          </h2>
          <p style={{ fontSize: 14, color: "#8A7060", lineHeight: 1.7, marginBottom: 36 }}>
            Manage patients, OPD queues, consultations, prescriptions,
            and your entire clinical workflow — in one place.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 40 }}>
            <FeatureItem icon={<Users size={14} />} text="Multi-department patient management with UHID tracking" />
            <FeatureItem icon={<Stethoscope size={14} />} text="Real-time OPD queues with consultation history" />
            <FeatureItem icon={<BarChart3 size={14} />} text="Pharmacy, billing, and analytics in one platform" />
          </div>

          <StatusChip />
        </div>
      </div>

      {/* Right Panel — Form */}
      <div
        style={{
          background: "#FFFFFF",
          borderLeft: "0.5px solid #F0E8DC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 32px",
        }}
      >
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ width: "100%", maxWidth: 320 }}
        >
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A1208", marginBottom: 5 }}>
              Sign in to your account
            </h1>
            <p style={{ fontSize: 13, color: "#8A7060" }}>
              Enter your tenant code and credentials below.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <TenantCodeField
              value={tenantCode}
              onChange={setTenantCode}
              onBrandingChange={(b) => {
                if (b?.primaryColor) setTenantColor(b.primaryColor);
              }}
            />

            <FormInput
              label="Email / Username"
              type="text"
              placeholder="you@hospital.com"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={14} />}
              disabled={loading}
            />

            <FormInput
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={14} />}
              disabled={loading}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    color: "#C0A890",
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />

            {error && (
              <p role="alert" style={{ fontSize: 12, color: "#E24B4A", marginTop: -4 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                height: 42,
                borderRadius: 9,
                background: loading ? "#F0B07A" : tenantColor,
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "24px 0",
            }}
          >
            <div style={{ flex: 1, height: "0.5px", background: "#F0E8DC" }} />
            <span style={{ fontSize: 11, color: "#C0A890" }}>or</span>
            <div style={{ flex: 1, height: "0.5px", background: "#F0E8DC" }} />
          </div>

          <p style={{ textAlign: "center", fontSize: 12, color: "#8A7060" }}>
            Platform administrator?{" "}
            <a
              href="/superadmin/login"
              style={{ color: "#C25A0A", textDecoration: "none", fontWeight: 500 }}
            >
              Super Admin Login
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}