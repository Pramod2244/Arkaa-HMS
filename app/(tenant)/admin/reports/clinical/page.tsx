import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getDoctorPerformance } from "@/lib/reporting/clinicalReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { serializeData } from "@/lib/utils";

export default async function ClinicalReportPage() {
  const session = await getSession();
  if (!session?.tenantId) redirect("/login");
  
  try {
    requirePermission(session, "REPORTS_VIEW");
  } catch {
    redirect("/dashboard");
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date();

  const doctorPerformanceRaw = await getDoctorPerformance(session.tenantId, startDate, endDate);
  const doctorPerformance = serializeData(doctorPerformanceRaw) as any[];

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
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Clinical Insights
          </h1>
          <p className="text-sm text-slate-500">Doctor performance & patient volume</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 uppercase tracking-wider">Top Performing Doctors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {doctorPerformance.length > 0 ? doctorPerformance.slice(0,5).map((doc: any) => (
                <div key={doc.doctorId} className="flex justify-between items-center text-sm border-b border-blue-100 pb-2">
                  <span className="font-medium text-slate-700">{doc.doctorName}</span>
                  <span className="text-slate-500">{Number(doc.consultationsCount)} consultations</span>
                </div>
              )) : <span className="text-slate-500 text-sm">No data available</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}