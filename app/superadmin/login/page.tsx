"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { TenantLogo } from "@/components/ui/TenantLogo";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50 overflow-hidden">
      <img
        src="/login-bg.jpg"
        alt="Healthcare background"
        className="absolute inset-0 w-full h-full object-cover object-center z-0"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-emerald-400/60 opacity-80 z-10" />
      <div className="absolute inset-0 bg-black/30 z-20" />
      <div className="relative z-30 flex flex-col items-center justify-center w-full min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="w-full max-w-md px-4"
        >
          <GlassCard className="shadow-2xl animate-fade-in-up">
            <div className="flex flex-col items-center gap-2 mb-6">
              <TenantLogo size={48} name="HMS Cloud" />
              <h1 className="text-2xl font-bold text-primary mb-1">Super Admin Login</h1>
              <p className="text-sm text-gray-500">Platform administration</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="superadmin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  autoComplete="username"
                  className="border-slate-300 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <motion.p
                  className="text-sm text-red-600 mt-2"
                  role="alert"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {error}
                </motion.p>
              )}
              <Button type="submit" className="w-full mt-2" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <p className="mt-6 text-center text-xs text-gray-500">
              <a href="/login" className="underline hover:text-primary transition">
                Tenant login
              </a>
            </p>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
