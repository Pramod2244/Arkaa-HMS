import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session?.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  requirePermission(session, "USER_MANAGE");

  const users = await prisma.user.findMany({
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
  });
  return Response.json(users);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  requirePermission(session, "USER_MANAGE");

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId, isActive: true },
  });
  if (!tenant) {
    return Response.json({ error: "Invalid tenant" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const fullName = (body.fullName ?? "").toString().trim();
    const email = (body.email ?? "").toString().trim().toLowerCase();
    const username = (body.username ?? email).toString().trim().toLowerCase();
    const mobile = body.mobile?.toString().trim() ?? null;
    const password = body.password ?? "";
    const roleIds = Array.isArray(body.roleIds) ? body.roleIds.filter((r: unknown) => typeof r === "string") : [];
    const isActive = body.isActive !== false;

    if (!fullName || !email || !username) {
      return Response.json({ error: "Full name, email and username are required" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        tenantId: session.tenantId,
        fullName,
        email,
        username,
        mobile,
        passwordHash,
        isActive,
      },
    });

    if (roleIds.length > 0) {
      await prisma.userRole.createMany({
        data: roleIds.map((roleId: string) => ({ userId: user.id, roleId })),
        skipDuplicates: true,
      });
    }

    await createAuditLog({
      tenantId: session.tenantId,
      performedBy: session.userId,
      entityType: "User",
      entityId: user.id,
      action: "CREATE",
      newValue: { email: user.email, fullName: user.fullName },
    });

    const withRoles = await prisma.user.findUnique({
      where: { id: user.id },
      include: { userRoles: { include: { role: true } } },
    });
    return Response.json(withRoles, { status: 201 });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return Response.json({ error: "Email or username already exists" }, { status: 409 });
    }
    console.error(e);
    return Response.json({ error: "Failed to create user" }, { status: 500 });
  }
}
