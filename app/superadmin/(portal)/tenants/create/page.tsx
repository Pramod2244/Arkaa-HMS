"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function CreateTenantPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"HOSPITAL" | "CLINIC">("HOSPITAL");
  const [contact, setContact] = useState("");
  const [plan, setPlan] = useState("BASIC");
  const [maxUsers, setMaxUsers] = useState(10);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const n = name.trim();
    const c = code.trim().toUpperCase();
    if (!n || !c) {
      setError("Name and tenant code are required.");
      return;
    }
    setLoading(true);
    try {
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      const res = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          code: c,
          type,
          contact: contact.trim() || undefined,
          plan,
          maxUsers,
          startDate: new Date().toISOString(),
          endDate: endDate.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create tenant");
        setLoading(false);
        return;
      }
      router.push("/superadmin/tenants");
      router.refresh();
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Create Tenant</h1>
      <p className="mt-1 text-slate-600">Add a new hospital or clinic</p>
      <Card className="mt-6 max-w-lg border-slate-200">
        <CardHeader>
          <CardTitle>Tenant details</CardTitle>
          <CardDescription>Name, code, type and license</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Hospital" disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Tenant Code (unique)</Label>
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ACME" disabled={loading} className="uppercase" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as "HOSPITAL" | "CLINIC")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={loading}
                >
                  <option value="HOSPITAL">Hospital</option>
                  <option value="CLINIC">Clinic</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Contact</Label>
                <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="email or phone" disabled={loading} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan">Plan</Label>
                <Input id="plan" value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="BASIC" disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUsers">Max Users</Label>
                <Input id="maxUsers" type="number" min={1} value={maxUsers} onChange={(e) => setMaxUsers(Number(e.target.value) || 10)} disabled={loading} />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Tenant"}</Button>
              <Link href="/superadmin/tenants">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
