import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminReportsPage() {
  const session = await getSession();
  if (!session?.tenantId) redirect("/login");
  try {
    requirePermission(session, "REPORTS_VIEW");
  } catch {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
      <p className="mt-1 text-slate-600">Analytics and reports (placeholder)</p>
      <Card className="mt-6 max-w-xl border-slate-200">
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>Build reports using audit logs and business data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Reports module can be extended with filters and exports.</p>
        </CardContent>
      </Card>
    </div>
  );
}
