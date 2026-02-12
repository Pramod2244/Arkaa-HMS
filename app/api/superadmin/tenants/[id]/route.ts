import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

type Params = Promise<{ id: string }>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      licenses: { orderBy: { endDate: "desc" } },
      _count: { select: { users: true } },
    },
  });
  if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(tenant);
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const body = await request.json();
    const tenant = await prisma.tenant.findUnique({ where: { id }, include: { licenses: { where: { isActive: true }, take: 1 } } });
    if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });

    if (body.isActive !== undefined) {
      await prisma.tenant.update({
        where: { id },
        data: { isActive: Boolean(body.isActive) },
      });
      await createAuditLog({
        tenantId: null,
        performedBy: session.userId,
        entityType: "Tenant",
        entityId: id,
        action: "UPDATE",
        oldValue: { isActive: tenant.isActive },
        newValue: { isActive: body.isActive },
      });
    }

    const license = tenant.licenses[0];
    if (license && (body.plan != null || body.maxUsers != null || body.endDate != null)) {
      await prisma.tenantLicense.update({
        where: { id: license.id },
        data: {
          ...(body.plan != null && { plan: String(body.plan) }),
          ...(body.maxUsers != null && { maxUsers: Math.max(1, Number(body.maxUsers) || 10) }),
          ...(body.endDate != null && { endDate: new Date(body.endDate) }),
        },
      });
    }

    const updated = await prisma.tenant.findUnique({
      where: { id },
      include: { licenses: { orderBy: { endDate: "desc" } }, _count: { select: { users: true } } },
    });
    return Response.json(updated);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}
