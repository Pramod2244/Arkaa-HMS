import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TenantManageClient } from "./tenant-manage-client";

export default async function SuperAdminTenantDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.isSuperAdmin) return null;
  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      licenses: { orderBy: { endDate: "desc" } },
      _count: { select: { users: true } },
    },
  });
  if (!tenant) notFound();

  const activeLicense = tenant.licenses.find((l) => l.isActive) ?? tenant.licenses[0];

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Link href="/superadmin/tenants" className="hover:underline">Tenants</Link>
        <span>/</span>
        <span className="text-slate-900">{tenant.name}</span>
      </div>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{tenant.name}</h1>
      <p className="mt-1 text-slate-600">Code: {tenant.code} · Type: {tenant.type} · Users: {tenant._count.users}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Tenant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><span className="text-slate-500">Contact:</span> {tenant.contact ?? "—"}</p>
            <p><span className="text-slate-500">Status:</span> {tenant.isActive ? "Active" : "Disabled"}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>License</CardTitle>
          </CardHeader>
          <CardContent>
            {activeLicense ? (
              <div className="space-y-2">
                <p><span className="text-slate-500">Plan:</span> {activeLicense.plan}</p>
                <p><span className="text-slate-500">Max users:</span> {activeLicense.maxUsers}</p>
                <p><span className="text-slate-500">End date:</span> {new Date(activeLicense.endDate).toLocaleDateString()}</p>
              </div>
            ) : (
              <p className="text-slate-500">No active license</p>
            )}
          </CardContent>
        </Card>
      </div>

      <TenantManageClient tenantId={tenant.id} initialActive={tenant.isActive} initialLicense={activeLicense ?? null} />
    </div>
  );
}
