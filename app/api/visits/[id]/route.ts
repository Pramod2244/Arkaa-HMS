import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { updateVisitStatus } from "@/lib/services/visits";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "VISIT_EDIT");

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, message: "Status is required", errorCode: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const visit = await updateVisitStatus(id, status, session.tenantId, session.userId);

    return NextResponse.json({ success: true, data: visit });
  } catch (error) {
    console.error("PATCH /api/visits/[id] error:", error);

    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, message: "Permission denied", errorCode: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === "Visit not found") {
      return NextResponse.json(
        { success: false, message: "Visit not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}