import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session?.tenantId) redirect("/login");
  try {
    requirePermission(session, "SETTINGS_MANAGE");
  } catch {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      <p className="mt-1 text-slate-600">Tenant and application settings</p>
      <Card className="mt-6 max-w-xl border-slate-200">
        <CardHeader>
          <CardTitle>Tenant settings</CardTitle>
          <CardDescription>Configure organization preferences (placeholder)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Settings UI can be extended with TenantSetting key-value store.</p>
        </CardContent>
      </Card>
    </div>
  );
}
