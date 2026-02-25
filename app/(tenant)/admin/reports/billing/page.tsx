import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getRevenueByDepartment } from "@/lib/reporting/billingReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BillingTable } from "./billing-table";
import { serializeData } from "@/lib/utils";

export default async function BillingReportPage() {
  const session = await getSession();
  if (!session?.tenantId) redirect("/login");
  
  try {
    requirePermission(session, "REPORTS_VIEW");
  } catch {
    redirect("/dashboard");
  }

  // Fetch departmental revenue for the last 30 days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date();

  const revenueDataRaw: any = await getRevenueByDepartment({
    tenantId: session.tenantId,
    startDate,
    endDate,
  });

  // Ensure data is serializable
  const revenueData = serializeData(revenueDataRaw) as any[];

  const totalRevenue = revenueData.reduce((acc: number, curr: any) => acc + Number(curr.revenue), 0);

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
            <TrendingUp className="h-6 w-6 text-green-600" />
            Billing Analysis
          </h1>
          <p className="text-sm text-slate-500">Departmental revenue distribution (Last 30 Days)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-green-50 border-green-200 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 uppercase tracking-wider">Total Period Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">
              ₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-green-700 mt-1 font-medium italic">Across {revenueData.length} active departments</p>
          </CardContent>
        </Card>
      </div>

      <BillingTable data={revenueData} />
    </div>
  );
}
