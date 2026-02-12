"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Role = { id: string; code: string; name: string };

export function UserCreateModal({
  open,
  onClose,
  onSuccess,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roles: Role[];
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const fn = fullName.trim();
    const em = email.trim().toLowerCase();
    const un = username.trim().toLowerCase() || em;
    if (!fn || !em) {
      setError("Full name and email are required.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fn,
          email: em,
          username: un,
          mobile: mobile.trim() || undefined,
          password,
          roleIds,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create user");
        setLoading(false);
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Create User</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={email || "optional"} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label>Mobile</Label>
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={roleIds.includes(r.id)}
                      onChange={(e) =>
                        setRoleIds((prev) =>
                          e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                        )
                      }
                      disabled={loading}
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create"}</Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
