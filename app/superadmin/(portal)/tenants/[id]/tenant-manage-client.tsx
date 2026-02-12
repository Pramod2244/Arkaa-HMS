"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type License = {
  id: string;
  plan: string;
  maxUsers: number;
  endDate: string | Date;
  isActive: boolean;
} | null;

export function TenantManageClient({
  tenantId,
  initialActive,
  initialLicense,
}: {
  tenantId: string;
  initialActive: boolean;
  initialLicense: License;
}) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(initialActive);
  const [plan, setPlan] = useState(initialLicense?.plan ?? "BASIC");
  const [maxUsers, setMaxUsers] = useState(initialLicense?.maxUsers ?? 10);
  const [endDate, setEndDate] = useState(
    initialLicense?.endDate ? new Date(initialLicense.endDate).toISOString().slice(0, 10) : ""
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleToggleActive() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed");
        setLoading(false);
        return;
      }
      setIsActive(!isActive);
      router.refresh();
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  async function handleUpdateLicense(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, maxUsers, endDate: endDate || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  return (
    <Card className="mt-6 border-slate-200">
      <CardHeader>
        <CardTitle>Manage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">Tenant status:</span>
          <Button variant={isActive ? "destructive" : "default"} size="sm" onClick={handleToggleActive} disabled={loading}>
            {isActive ? "Disable tenant" : "Enable tenant"}
          </Button>
        </div>
        <form onSubmit={handleUpdateLicense} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Input value={plan} onChange={(e) => setPlan(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label>Max users</Label>
              <Input type="number" min={1} value={maxUsers} onChange={(e) => setMaxUsers(Number(e.target.value) || 10)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label>License end date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={loading} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Update license"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
