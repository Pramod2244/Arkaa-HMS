/**
 * Phase-3: Consultation Context API
 * 
 * GET /api/consultation/context?visitId=xxx
 * 
 * Returns ALL data needed for the consultation screen in ONE call.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserPermissionCodes } from "@/lib/rbac";
import { getConsultationContext } from "@/lib/services/consultation-context";

export async function GET(request: NextRequest) {
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

    // Permission check - accept both OPD_CONSULTATION_* and CONSULTATION_* variants
    const permissions = await getUserPermissionCodes(userId, tenantId);
    const hasAccess = permissions.includes("OPD_CONSULTATION_VIEW") || 
                      permissions.includes("OPD_CONSULTATION_CREATE") ||
                      permissions.includes("CONSULTATION_VIEW") ||
                      permissions.includes("CONSULTATION_CREATE") ||
                      permissions.includes("ADMIN");

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Permission denied" },
        { status: 403 }
      );
    }

    // Get visitId from query
    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get("visitId");

    if (!visitId) {
      return NextResponse.json(
        { success: false, error: "visitId is required" },
        { status: 400 }
      );
    }

    // Get consultation context
    const context = await getConsultationContext(visitId, tenantId, userId);

    if (!context) {
      return NextResponse.json(
        { success: false, error: "Visit not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: context,
    });
  } catch (error) {
    console.error("[Consultation Context API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
