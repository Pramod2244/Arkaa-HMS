import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getInventorySummary } from "@/lib/reporting/inventoryReports";
import { getTopSellingMedicines } from "@/lib/reporting/pharmacyReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { serializeData } from "@/lib/utils";

export default async function InventoryReportPage() {
  const session = await getSession();
  if (!session?.tenantId) redirect("/login");
  
  try {
    requirePermission(session, "REPORTS_VIEW");
  } catch {
    redirect("/dashboard");
  }

  const inventorySummaryRaw = await getInventorySummary(session.tenantId);
  const inventorySummary = serializeData(inventorySummaryRaw) as any[];
  const summary = inventorySummary[0] || { totalProducts: 0, reorderCount: 0, outOfStockCount: 0 };

  const topSellingRaw = await getTopSellingMedicines(session.tenantId, 5);
  const topSelling = serializeData(topSellingRaw) as any[];

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
            <PieChart className="h-6 w-6 text-purple-600" />
            Inventory & Pharmacy Alerts
          </h1>
          <p className="text-sm text-slate-500">Stock levels, reorder warnings, and top selling medicines</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-purple-50 border-purple-200 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-600 uppercase tracking-wider">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">
              {Number(summary.totalProducts)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-amber-50 border-amber-200 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600 uppercase tracking-wider">Reorder Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-900">
              {Number(summary.reorderCount)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 uppercase tracking-wider">Out of Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900">
              {Number(summary.outOfStockCount)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-wider">Top Selling Medicines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topSelling.length > 0 ? topSelling.map((med: any) => (
              <div key={med.productId} className="flex justify-between items-center text-sm border-b pb-2">
                <span className="font-semibold">{med.productName} ({med.genericName})</span>
                <span className="text-slate-500">Vol: {Number(med.totalQuantity)}</span>
                <span className="text-slate-500 font-mono">Rev: ₹{Number(med.totalRevenue).toLocaleString()}</span>
              </div>
            )) : <p className="text-sm text-slate-500">No top selling medicines data available.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}