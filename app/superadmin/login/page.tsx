"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Eye, EyeOff, User, Lock } from "lucide-react";
import DotPatternBg from "@/components/auth/DotPatternBg";
import AccessTypeTabs from "@/components/auth/AccessTypeTabs";
import FormInput from "@/components/auth/FormInput";
import ArkaaBrand from "@/components/brand/ArkaaBrand";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const u = username.trim();
    const p = password;
    if (!u || !p) {
      setError("Username and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/superadmin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        setLoading(false);
        return;
      }
      router.push(data.redirect ?? "/superadmin/dashboard");
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
        background: "#FFFAF5",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        overflow: "hidden",
      }}
    >
      <DotPatternBg />

      {/* Top-left brand */}
      <div style={{ position: "absolute", top: 20, left: 36, zIndex: 10 }}>
        <ArkaaBrand />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: 380,
          background: "#FFFFFF",
          border: "0.5px solid #F0E8DC",
          borderRadius: 16,
          padding: "36px 32px 32px",
          boxShadow: "0 8px 32px rgba(26,18,8,0.06)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#FFF0E2",
              border: "0.5px solid #F0B07A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              color: "#E8640A",
            }}
          >
            <ShieldCheck size={26} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1208", marginBottom: 4 }}>
            Platform Administration
          </h1>
          <p style={{ fontSize: 12, color: "#8A7060" }}>
            Secured access for Arkaa platform operators
          </p>
        </div>

        {/* Security bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            background: "#FFF5EC",
            border: "0.5px solid #F0B07A",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 20,
          }}
        >
          <ShieldCheck size={12} color="#C25A0A" />
          <span style={{ fontSize: 11, color: "#C25A0A", fontWeight: 500 }}>
            Privileged access — activity is logged
          </span>
        </div>

        {/* Access type chips */}
        <div style={{ marginBottom: 22 }}>
          <AccessTypeTabs active={0} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormInput
            label="Username"
            type="text"
            placeholder="superadmin"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            icon={<User size={14} />}
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
              marginTop: 6,
              height: 42,
              borderRadius: 9,
              background: loading ? "#F0B07A" : "#E8640A",
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

        {/* Divider + Tenant link */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "20px 0 16px",
          }}
        >
          <div style={{ flex: 1, height: "0.5px", background: "#F0E8DC" }} />
          <span style={{ fontSize: 11, color: "#C0A890" }}>or</span>
          <div style={{ flex: 1, height: "0.5px", background: "#F0E8DC" }} />
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#8A7060" }}>
          Looking for your hospital?{" "}
          <a
            href="/login"
            style={{ color: "#C25A0A", textDecoration: "none", fontWeight: 500 }}
          >
            Tenant Login
          </a>
        </p>
      </motion.div>
    </div>
  );
}
