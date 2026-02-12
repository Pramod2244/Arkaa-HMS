/**
 * Phase-3: Consultation Lab Orders API
 * 
 * POST /api/consultation/labs
 * 
 * Creates lab orders for a visit.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserPermissionCodes } from "@/lib/rbac";
import { saveConsultationLabOrders, LabOrderInput } from "@/lib/services/consultation-writes";

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getSessionFromRequest(request);
    if (!session || !session.userId || !session.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { userId, tenantId } = session;

    // Permission check - accept both OPD_* and standard permission variants
    const permissions = await getUserPermissionCodes(userId, tenantId);
    const hasAccess = permissions.includes("OPD_LAB_ORDER_CREATE") || 
                      permissions.includes("LAB_ORDER_CREATE") ||
                      permissions.includes("CONSULTATION_CREATE") ||
                      permissions.includes("ADMIN");

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Permission denied" },
        { status: 403 }
      );
    }

    // Parse body
    const body = await request.json();
    const { visitId, ...labOrder } = body as { visitId: string } & LabOrderInput;

    if (!visitId) {
      return NextResponse.json(
        { success: false, error: "visitId is required" },
        { status: 400 }
      );
    }

    if (!labOrder.items || labOrder.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one lab test is required" },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of labOrder.items) {
      if (!item.testName) {
        return NextResponse.json(
          { success: false, error: "Each lab test must have a name" },
          { status: 400 }
        );
      }
    }

    // Save lab orders
    const result = await saveConsultationLabOrders(visitId, labOrder, tenantId, userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Consultation Labs API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
