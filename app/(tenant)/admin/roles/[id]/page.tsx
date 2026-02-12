import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RolePermissionsClient } from "./role-permissions-client";

export default async function AdminRoleDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.tenantId) redirect("/login");
  try {
    requirePermission(session, "ROLE_MANAGE");
  } catch {
    redirect("/dashboard");
  }
  const { id } = await params;

  const [role, allPermissions] = await Promise.all([
    prisma.role.findFirst({
      where: { id, tenantId: session.tenantId },
      include: { rolePermissions: { include: { permission: true } } },
    }),
    prisma.permission.findMany({ orderBy: [{ module: "asc" }, { code: "asc" }] }),
  ]);

  if (!role) notFound();

  const assignedIds = role.rolePermissions.map((rp) => rp.permissionId);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{role.name}</h1>
      <p className="mt-1 text-slate-600">Code: {role.code} · Assign permissions</p>
      <RolePermissionsClient
        roleId={role.id}
        roleName={role.name}
        allPermissions={allPermissions}
        initialAssignedIds={assignedIds}
      />
    </div>
  );
}
