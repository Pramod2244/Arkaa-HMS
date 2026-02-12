import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRoles, createRole } from "@/lib/services/roles";
import { requirePermission } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    requirePermission(session, "ROLES_VIEW");

    const roles = await getRoles(session.tenantId);
    return NextResponse.json(roles);
  } catch (error) {
    console.error("GET /api/admin/roles error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    requirePermission(session, "ROLE_MANAGE");

    const body = await request.json();
    const role = await createRole(body, session.tenantId, session.userId);
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/roles error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
