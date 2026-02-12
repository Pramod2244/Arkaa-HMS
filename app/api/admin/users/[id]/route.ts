import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

type Params = Promise<{ id: string }>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const session = await getSession();
  if (!session?.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  requirePermission(session, "USER_MANAGE");
  const { id } = await params;
  const user = await prisma.user.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { userRoles: { include: { role: true } } },
  });
  if (!user) return Response.json({ error: "Not found" }, { status: 404 });
  const { passwordHash: _, ...safe } = user;
  return Response.json(safe);
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const session = await getSession();
  if (!session?.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  requirePermission(session, "USER_MANAGE");
  const { id } = await params;
  const user = await prisma.user.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { userRoles: true },
  });
  if (!user) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const fullName = body.fullName?.toString().trim();
    const email = body.email?.toString().trim().toLowerCase();
    const username = body.username?.toString().trim().toLowerCase();
    const mobile = body.mobile?.toString().trim() ?? null;
    const isActive = body.isActive;
    const roleIds = Array.isArray(body.roleIds) ? body.roleIds.filter((r: unknown) => typeof r === "string") : null;
    const newPassword = body.password?.toString();

    const update: Record<string, unknown> = {};
    if (fullName !== undefined) update.fullName = fullName;
    if (email !== undefined) update.email = email;
    if (username !== undefined) update.username = username;
    if (mobile !== undefined) update.mobile = mobile;
    if (typeof isActive === "boolean") update.isActive = isActive;
    if (newPassword && newPassword.length >= 6) update.passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id },
      data: update as Parameters<typeof prisma.user.update>[0]["data"],
    });

    if (roleIds !== null) {
      await prisma.userRole.deleteMany({ where: { userId: id } });
      if (roleIds.length > 0) {
        await prisma.userRole.createMany({
          data: roleIds.map((roleId: string) => ({ userId: id, roleId })),
          skipDuplicates: true,
        });
      }
    }

    await createAuditLog({
      tenantId: session.tenantId,
      performedBy: session.userId,
      entityType: "User",
      entityId: id,
      action: "UPDATE",
      newValue: { fullName, email, isActive },
    });

    const updated = await prisma.user.findFirst({
      where: { id, tenantId: session.tenantId },
      include: { userRoles: { include: { role: true } } },
    });
    const { passwordHash: _, ...safe } = updated!;
    return Response.json(safe);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  const session = await getSession();
  if (!session?.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  requirePermission(session, "USER_MANAGE");
  const { id } = await params;
  const user = await prisma.user.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!user) return Response.json({ error: "Not found" }, { status: 404 });
  await prisma.user.delete({ where: { id } });
  await createAuditLog({
    tenantId: session.tenantId,
    performedBy: session.userId,
    entityType: "User",
    entityId: id,
    action: "DELETE",
  });
  return new Response(null, { status: 204 });
}
