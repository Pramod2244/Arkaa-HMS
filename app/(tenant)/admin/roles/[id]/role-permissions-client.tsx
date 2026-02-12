"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Permission = { id: string; code: string; name: string; module: string | null };

export function RolePermissionsClient({
  roleId,
  roleName,
  allPermissions,
  initialAssignedIds,
}: {
  roleId: string;
  roleName: string;
  allPermissions: Permission[];
  initialAssignedIds: string[];
}) {
  const router = useRouter();
  const [assignedIds, setAssignedIds] = useState(new Set(initialAssignedIds));
  useEffect(() => {
    setAssignedIds(new Set(initialAssignedIds));
  }, [initialAssignedIds.join(",")]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggle = useCallback((id: string) => {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function handleSave() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/roles/${roleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionIds: Array.from(assignedIds) }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to update");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  const byModule = allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
    const m = p.module ?? "Other";
    if (!acc[m]) acc[m] = [];
    acc[m].push(p);
    return acc;
  }, {});

  return (
    <Card className="mt-6 max-w-2xl border-slate-200">
      <CardHeader>
        <CardTitle>Permissions for {roleName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(byModule).map(([module, perms]) => (
          <div key={module}>
            <Label className="text-slate-600">{module}</Label>
            <div className="mt-2 flex flex-wrap gap-4">
              {perms.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={assignedIds.has(p.id)}
                    onChange={() => toggle(p.id)}
                    disabled={loading}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving…" : "Save permissions"}
        </Button>
      </CardContent>
    </Card>
  );
}
