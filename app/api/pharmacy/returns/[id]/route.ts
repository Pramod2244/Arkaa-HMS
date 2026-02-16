import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { AppError } from "@/lib/rbac";
import {
  getReturnById,
  approveReturn,
  cancelReturn,
} from "@/lib/services/pharmacy/return.service";
import {
  ReturnApproveSchema,
  ReturnCancelSchema,
} from "@/lib/schemas/pharmacy-return-schema";

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
    if (!session.permissions.includes("PHARMACY_RETURN_VIEW")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const returnDetail = await getReturnById(session.tenantId, id);

    return NextResponse.json({ success: true, data: returnDetail });
  } catch (error) {
    console.error("GET /api/pharmacy/returns/[id] error:", error);
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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "approve") {
      if (!session.permissions.includes("PHARMACY_RETURN_APPROVE")) {
        return NextResponse.json(
          { success: false, errorCode: "FORBIDDEN", message: "Return approval permission required" },
          { status: 403 }
        );
      }
      const body = await request.json();
      const { version } = ReturnApproveSchema.parse(body);
      const result = await approveReturn(session.tenantId, session.userId, id, version);
      return NextResponse.json({ success: true, data: result, message: "Return approved and stock restored" });
    }

    if (action === "cancel") {
      if (!session.permissions.includes("PHARMACY_RETURN_CANCEL")) {
        return NextResponse.json(
          { success: false, errorCode: "FORBIDDEN", message: "Return cancel permission required" },
          { status: 403 }
        );
      }
      const body = await request.json();
      const { version } = ReturnCancelSchema.parse(body);
      const result = await cancelReturn(session.tenantId, session.userId, id, version);
      return NextResponse.json({ success: true, data: result, message: "Return cancelled" });
    }

    return NextResponse.json(
      { success: false, errorCode: "BAD_REQUEST", message: "Invalid action. Use ?action=approve or ?action=cancel" },
      { status: 400 }
    );
  } catch (error) {
    console.error("PATCH /api/pharmacy/returns/[id] error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errorCode: "VALIDATION_ERROR", message: error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }
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
