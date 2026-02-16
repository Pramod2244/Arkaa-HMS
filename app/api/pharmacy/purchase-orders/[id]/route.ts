import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { AppError } from "@/lib/rbac";
import {
  getPurchaseOrderById,
  updatePurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  softDeletePurchaseOrder,
} from "@/lib/services/pharmacy/purchase-order.service";
import {
  UpdatePurchaseOrderSchema,
  PurchaseOrderStatusChangeSchema,
} from "@/lib/schemas/pharmacy-procurement-schema";

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
    if (!session.permissions.includes("PO_VIEW")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const po = await getPurchaseOrderById(session.tenantId, id);
    if (!po) {
      return NextResponse.json(
        { success: false, errorCode: "NOT_FOUND", message: "Purchase order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: po });
  } catch (error) {
    console.error("GET /api/pharmacy/purchase-orders/[id] error:", error);
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

export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    if (!session.permissions.includes("PO_EDIT")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = UpdatePurchaseOrderSchema.parse(body);

    const po = await updatePurchaseOrder(session.tenantId, session.userId, id, validatedData);

    return NextResponse.json({ success: true, data: po, message: "Purchase order updated" });
  } catch (error) {
    console.error("PUT /api/pharmacy/purchase-orders/[id] error:", error);
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

// PATCH: Approve or Cancel
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
    const body = await request.json();
    const action = body.action as string;
    const { version } = PurchaseOrderStatusChangeSchema.parse(body);

    if (action === "approve") {
      if (!session.permissions.includes("PO_APPROVE")) {
        return NextResponse.json(
          { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
          { status: 403 }
        );
      }
      const po = await approvePurchaseOrder(session.tenantId, session.userId, id, version);
      return NextResponse.json({ success: true, data: po, message: "Purchase order approved" });
    }

    if (action === "cancel") {
      if (!session.permissions.includes("PO_EDIT")) {
        return NextResponse.json(
          { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
          { status: 403 }
        );
      }
      const po = await cancelPurchaseOrder(session.tenantId, session.userId, id, version);
      return NextResponse.json({ success: true, data: po, message: "Purchase order cancelled" });
    }

    return NextResponse.json(
      { success: false, errorCode: "BAD_REQUEST", message: "Invalid action. Use 'approve' or 'cancel'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("PATCH /api/pharmacy/purchase-orders/[id] error:", error);
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

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
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
    if (!session.permissions.includes("PO_DELETE")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { id } = await params;
    // version from query string for DELETE
    const url = new URL(_request.url);
    const versionStr = url.searchParams.get("version");
    if (!versionStr) {
      return NextResponse.json(
        { success: false, errorCode: "BAD_REQUEST", message: "version query parameter required" },
        { status: 400 }
      );
    }

    await softDeletePurchaseOrder(session.tenantId, session.userId, id, parseInt(versionStr, 10));

    return NextResponse.json({ success: true, message: "Purchase order deleted" });
  } catch (error) {
    console.error("DELETE /api/pharmacy/purchase-orders/[id] error:", error);
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
