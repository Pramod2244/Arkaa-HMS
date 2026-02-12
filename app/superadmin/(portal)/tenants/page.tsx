import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export default async function SuperAdminTenantsPage() {
  const session = await getSession();
  if (!session?.isSuperAdmin) return null;

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      licenses: { where: { isActive: true }, orderBy: { endDate: "desc" }, take: 1 },
      _count: { select: { users: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Tenants</h1>
        <Link href="/superadmin/tenants/create">
          <Button>
            <Plus className="h-4 w-4" />
            Create Tenant
          </Button>
        </Link>
      </div>
      <p className="mt-1 text-slate-600">Hospitals and clinics on the platform</p>
      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Users</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">License</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tenants.map((t) => {
              const license = t.licenses[0];
              const expired = license ? new Date(license.endDate) < new Date() : true;
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">{t.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{t.code}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{t.type}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{t._count.users}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                    {license ? `${license.plan} · until ${new Date(license.endDate).toLocaleDateString()}` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {!t.isActive ? (
                      <Badge variant="destructive">Disabled</Badge>
                    ) : expired ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link href={`/superadmin/tenants/${t.id}`}>
                      <Button variant="ghost" size="sm" type="button">Manage</Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
