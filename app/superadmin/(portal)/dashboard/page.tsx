import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, FileCheck, CreditCard } from "lucide-react";

export default async function SuperAdminDashboardPage() {
  const session = await getSession();
  if (!session?.isSuperAdmin) return null;

  const [tenantCount, activeTenants, totalUsers] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.user.count({ where: { tenantId: { not: null } } }),
  ]);

  const cards = [
    { title: "Total Tenants", value: tenantCount, icon: Building2 },
    { title: "Active Tenants", value: activeTenants, icon: Building2 },
    { title: "Total Staff Users", value: totalUsers, icon: Users },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-slate-600">Platform overview</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ title, value, icon: Icon }) => (
          <Card key={title} className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {title}
              </CardTitle>
              <Icon className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
