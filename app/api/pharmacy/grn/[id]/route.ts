import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AppError } from "@/lib/rbac";
import { getGRNById } from "@/lib/services/pharmacy/grn.service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, errorCode: "UNAUTHORIZED", message: "Not authenticated" },
        { status: 401 }
      );
    }
    if (!session.tenantId) {
      return NextResponse.json(
        { success: false, errorCode: "BAD_REQUEST", message: "Tenant context required" },
        { status: 400 }
      );
    }
    if (!session.permissions.includes("GRN_VIEW")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const grn = await getGRNById(session.tenantId, id);
    if (!grn) {
      return NextResponse.json(
        { success: false, errorCode: "NOT_FOUND", message: "Goods receipt not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: grn });
  } catch (error) {
    console.error("GET /api/pharmacy/grn/[id] error:", error);
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, errorCode: error.errorCode, message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, errorCode: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "An error occurred" },
      { status: 500 }
    );
  }
}
