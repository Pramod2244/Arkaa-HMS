import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

type Params = Promise<{ id: string }>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const session = await getSession();
  if (!session?.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  requirePermission(session, "ROLE_MANAGE");
  const { id } = await params;
  const role = await prisma.role.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { rolePermissions: { include: { permission: true } } },
  });
  if (!role) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(role.rolePermissions.map((rp) => rp.permission));
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const session = await getSession();
  if (!session?.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  requirePermission(session, "ROLE_MANAGE");
  const { id } = await params;
  const role = await prisma.role.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!role) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const permissionIds = Array.isArray(body.permissionIds)
      ? body.permissionIds.filter((p: unknown) => typeof p === "string")
      : [];

    await prisma.rolePermission.deleteMany({ where: { roleId: id } });
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId: string) => ({ roleId: id, permissionId })),
        skipDuplicates: true,
      });
    }

    await createAuditLog({
      tenantId: session.tenantId,
      performedBy: session.userId,
      entityType: "RolePermission",
      entityId: id,
      action: "UPDATE",
      newValue: { permissionIds },
    });

    const updated = await prisma.role.findFirst({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
    return Response.json(updated?.rolePermissions.map((rp) => rp.permission) ?? []);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to update permissions" }, { status: 500 });
  }
}
