import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { UsersTable } from "./users-table";
import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session?.tenantId) redirect("/login");
  try {
    requirePermission(session, "USER_MANAGE");
  } catch {
    redirect("/dashboard");
  }

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        mobile: true,
        isActive: true,
        createdAt: true,
        userRoles: { include: { role: { select: { id: true, code: true, name: true } } } },
      },
    }),
    prisma.role.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return <UsersTable initialUsers={users} roles={roles} />;
}
