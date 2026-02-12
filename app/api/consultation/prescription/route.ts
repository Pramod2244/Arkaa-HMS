/**
 * Phase-3: Consultation Prescription API
 * 
 * POST /api/consultation/prescription
 * 
 * Saves prescription for a visit.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserPermissionCodes } from "@/lib/rbac";
import { saveConsultationPrescription, PrescriptionInput } from "@/lib/services/consultation-writes";

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
    const hasAccess = permissions.includes("OPD_PRESCRIPTION_CREATE") || 
                      permissions.includes("PRESCRIPTION_CREATE") ||
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
    const { visitId, ...prescription } = body as { visitId: string } & PrescriptionInput;

    if (!visitId) {
      return NextResponse.json(
        { success: false, error: "visitId is required" },
        { status: 400 }
      );
    }

    if (!prescription.diagnosis) {
      return NextResponse.json(
        { success: false, error: "Diagnosis is required" },
        { status: 400 }
      );
    }

    if (!prescription.items || prescription.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one medicine is required" },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of prescription.items) {
      if (!item.medicineName || !item.dosage || !item.frequency || !item.duration) {
        return NextResponse.json(
          { success: false, error: "Each medicine must have name, dosage, frequency, and duration" },
          { status: 400 }
        );
      }
    }

    // Save prescription
    const result = await saveConsultationPrescription(visitId, prescription, tenantId, userId);

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
    console.error("[Consultation Prescription API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
