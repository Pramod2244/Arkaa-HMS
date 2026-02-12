/**
 * Phase-3: Consultation Vitals API
 * 
 * POST /api/consultation/vitals
 * 
 * Records vitals for a visit.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserPermissionCodes } from "@/lib/rbac";
import { saveConsultationVitals, VitalsInput } from "@/lib/services/consultation-writes";

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
    const hasAccess = permissions.includes("OPD_VITALS_RECORD") || 
                      permissions.includes("VITALS_CREATE") ||
                      permissions.includes("VITALS_RECORD") ||
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
    const { visitId, ...vitals } = body as { visitId: string } & VitalsInput;

    if (!visitId) {
      return NextResponse.json(
        { success: false, error: "visitId is required" },
        { status: 400 }
      );
    }

    // Save vitals
    const result = await saveConsultationVitals(visitId, vitals, tenantId, userId);

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
    console.error("[Consultation Vitals API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
