/**
 * Phase-3: Consultation Notes API
 * 
 * POST /api/consultation/notes
 * 
 * Saves clinical notes for a visit.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserPermissionCodes } from "@/lib/rbac";
import { saveConsultationNotes, ClinicalNotesInput } from "@/lib/services/consultation-writes";

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
    const hasAccess = permissions.includes("OPD_CONSULTATION_CREATE") || 
                      permissions.includes("OPD_CONSULTATION_UPDATE") ||
                      permissions.includes("CONSULTATION_CREATE") ||
                      permissions.includes("CONSULTATION_VIEW") ||
                      permissions.includes("ADMIN");

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Permission denied" },
        { status: 403 }
      );
    }

    // Parse body
    const body = await request.json();
    const { visitId, ...notes } = body as { visitId: string } & ClinicalNotesInput;

    if (!visitId) {
      return NextResponse.json(
        { success: false, error: "visitId is required" },
        { status: 400 }
      );
    }

    if (!notes.chiefComplaint) {
      return NextResponse.json(
        { success: false, error: "Chief complaint is required" },
        { status: 400 }
      );
    }

    // Save notes
    const result = await saveConsultationNotes(visitId, notes, tenantId, userId);

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
    console.error("[Consultation Notes API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
