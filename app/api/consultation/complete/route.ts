/**
 * Phase-3: Complete Consultation API
 * 
 * POST /api/consultation/complete
 * 
 * Completes a visit - locks all data.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserPermissionCodes } from "@/lib/rbac";
import { completeConsultation } from "@/lib/services/consultation-writes";

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
    const hasAccess = permissions.includes("OPD_CONSULTATION_FINALIZE") || 
                      permissions.includes("CONSULTATION_CREATE") ||
                      permissions.includes("CONSULTATION_COMPLETE") ||
                      permissions.includes("ADMIN");

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Permission denied" },
        { status: 403 }
      );
    }

    // Parse body
    const body = await request.json();
    const { visitId } = body as { visitId: string };

    if (!visitId) {
      return NextResponse.json(
        { success: false, error: "visitId is required" },
        { status: 400 }
      );
    }

    // Complete consultation
    const result = await completeConsultation(visitId, tenantId, userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Consultation completed successfully",
    });
  } catch (error) {
    console.error("[Consultation Complete API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
