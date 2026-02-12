import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    requirePermission(session, "AUDIT_VIEW");

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const tenantId = session.tenantId || session.isSuperAdmin ? undefined : null;

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId: tenantId,
        entityType,
        entityId,
      },
      orderBy: { performedAt: "desc" },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("GET /api/audit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}