import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { RolesTable } from "./roles-table";
import { prisma } from "@/lib/prisma";

export default async function AdminRolesPage() {
  const session = await getSession();
  if (!session?.tenantId) redirect("/login");
  try {
    requirePermission(session, "ROLE_MANAGE");
  } catch {
    redirect("/dashboard");
  }

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { code: "asc" },
      include: {
        rolePermissions: { include: { permission: { select: { id: true, code: true, name: true, module: true } } } },
        _count: { select: { userRoles: true } },
      },
    }),
    prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, module: true },
    }),
  ]);

  return <RolesTable initialRoles={roles} permissions={permissions} />;
}
