import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createPermission, getPermissions, updatePermission, deletePermission } from "@/lib/services/permissions";
import { requirePermission } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    requirePermission(session, "ROLE_MANAGE");

    const permissions = await getPermissions();
    return NextResponse.json(permissions);
  } catch (error) {
    console.error("GET /api/admin/permissions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    requirePermission(session, "ROLE_MANAGE");

    const body = await request.json();
    const permission = await createPermission(body, session.userId);
    return NextResponse.json(permission, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/permissions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    requirePermission(session, "ROLE_MANAGE");

    const body = await request.json();
    const { id, ...data } = body;
    const permission = await updatePermission(id, data, session.userId);
    return NextResponse.json(permission);
  } catch (error) {
    console.error("PUT /api/admin/permissions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    requirePermission(session, "ROLE_MANAGE");

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await deletePermission(id, session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/permissions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
