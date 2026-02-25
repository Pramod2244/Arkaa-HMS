import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  ShieldCheck, 
  FileText,
  ArrowRight
} from "lucide-react";

export default async function AdminReportsPage() {
  const session = await getSession();
  if (!session?.tenantId) redirect("/login");
  
  try {
    requirePermission(session, "REPORTS_VIEW");
  } catch {
    redirect("/dashboard");
  }

  const reportCategories = [
    {
      title: "Billing Analysis",
      description: "Revenue trends, collections, and outstanding dues.",
      href: "/admin/reports/billing",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Clinical Insights",
      description: "Doctor performance, patient volume, and diagnosis stats.",
      href: "/admin/reports/clinical",
      icon: BarChart3,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Inventory & Pharmacy",
      description: "Stock levels, expiry alerts, and reorder status.",
      href: "/admin/reports/inventory",
      icon: PieChart,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Audit & Compliance",
      description: "Security logs, user activity, and system changes.",
      href: "/admin/reports/audit",
      icon: ShieldCheck,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-slate-500" />
          Reporting Dashboard
        </h1>
        <p className="mt-1 text-slate-600">
          Enterprise-grade analytics for your hospital operations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportCategories.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer group h-full">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <div className={`p-3 rounded-lg ${report.bgColor}`}>
                  <report.icon className={`h-6 w-6 ${report.color}`} />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
                    {report.title}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {report.description}
                  </CardDescription>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors self-center" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-dashed border-slate-300 bg-slate-50">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500">
            Reporting Performance Note
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            Reports are generated using optimized read-only queries and materialized views. 
            Heavy aggregations are refreshed periodically in the background to ensure no impact 
            on transactional hospital services.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
