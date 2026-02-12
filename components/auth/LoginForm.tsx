"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Loader2 } from "lucide-react";

interface LoginFormProps {
  primaryColor?: string;
}

export function LoginForm({ primaryColor = "#3b82f6" }: LoginFormProps) {
  const router = useRouter();
  const [tenantCode, setTenantCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Sign In</h2>
          <p className="text-gray-600">Access your hospital management system</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenantCode" className="text-gray-700 font-medium">
              Tenant Code
            </Label>
            <Input
              id="tenantCode"
              type="text"
              placeholder="e.g. DEMO"
              value={tenantCode}
              onChange={(e) => setTenantCode(e.target.value.toUpperCase())}
              disabled={loading}
              autoComplete="organization"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700 font-medium">
              Email / Username
            </Label>
            <Input
              id="email"
              type="text"
              placeholder="you@hospital.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-700 font-medium">
              Password
            </Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
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
          <Button
            type="submit"
            className="w-full mt-6"
            disabled={loading || !tenantCode.trim() || !email.trim() || !password.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
        <div className="mt-6 text-center">
          <a
            href="/superadmin/login"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
          >
            Super Admin Login
          </a>
        </div>
      </div>
    </motion.div>
  );
}