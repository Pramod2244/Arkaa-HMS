import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { updateRole, deleteRole } from "@/lib/services/roles";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "ROLES_EDIT");

    const { id } = await params;
    const data = await request.json();
    const role = await updateRole(id, data, session.tenantId, session.userId);
    return NextResponse.json({ success: true, data: role });
  } catch (error) {
    console.error("PUT /api/admin/roles/[id] error:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          errorCode: error.errorCode
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "ROLES_DELETE");

    const { id } = await params;
    await deleteRole(id, session.tenantId, session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/roles/[id] error:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          errorCode: error.errorCode
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}