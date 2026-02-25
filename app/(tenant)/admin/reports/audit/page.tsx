import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getSensitiveOperations } from "@/lib/reporting/auditReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { serializeData } from "@/lib/utils";

export default async function AuditReportPage() {
  const session = await getSession();
  if (!session?.tenantId) redirect("/login");
  
  try {
    requirePermission(session, "REPORTS_VIEW");
  } catch {
    redirect("/dashboard");
  }

  const sensitiveOpsRaw = await getSensitiveOperations(session.tenantId);
  const sensitiveOps = serializeData(sensitiveOpsRaw) as any[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/reports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-600" />
            Audit Logs
          </h1>
          <p className="text-sm text-slate-500">Security and critical operations monitoring</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sensitive Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sensitiveOps.length > 0 ? sensitiveOps.slice(0, 10).map((op: any) => (
              <div key={op.id} className="text-sm border-b pb-2">
                <span className="font-semibold">{op.user?.fullName || op.performedBy}</span>
                <span className="mx-2 text-slate-500">{op.action}</span>
                <span className="font-mono">{op.entityType}</span>
                <div className="text-xs text-slate-400 mt-1">{new Date(op.performedAt).toLocaleString()}</div>
              </div>
            )) : <p className="text-sm text-slate-500">No recent sensitive operations found.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}