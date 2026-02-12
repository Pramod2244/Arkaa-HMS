/**
 * Start Consultation API
 * POST /api/doctor/start-consultation
 * 
 * Starts a consultation for a visit.
 * Validates doctor ownership and visit status.
 * Updates visit to IN_PROGRESS and syncs queue.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { startConsultation, getDoctorInProgressVisit } from "@/lib/services/doctor-dashboard";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    
    if (!session || !session.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check permission
    if (!session.permissions.includes("CONSULTATION_CREATE") && 
        !session.permissions.includes("CONSULTATION_START")) {
      return NextResponse.json(
        { success: false, error: "Access denied - cannot start consultations" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { visitId, force } = body;

    if (!visitId) {
      return NextResponse.json(
        { success: false, error: "Visit ID is required" },
        { status: 400 }
      );
    }

    // Check if doctor already has an in-progress visit (safeguard)
    if (!force) {
      const inProgressVisit = await getDoctorInProgressVisit(
        session.userId,
        session.tenantId
      );
      
      if (inProgressVisit && inProgressVisit.visitId !== visitId) {
        return NextResponse.json({
          success: false,
          error: `You have an in-progress consultation with ${inProgressVisit.patientName}. Complete or abandon it first.`,
          errorCode: 'HAS_IN_PROGRESS',
          data: {
            inProgressVisitId: inProgressVisit.visitId,
            inProgressPatientName: inProgressVisit.patientName,
          },
        }, { status: 409 });
      }
    }

    const result = await startConsultation(
      visitId,
      session.userId,
      session.tenantId
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        errorCode: result.errorCode,
      }, { status: result.errorCode === 'UNAUTHORIZED' ? 403 : 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        visitId: result.visitId,
        redirectTo: `/consultation/${result.visitId}`,
      },
    });
  } catch (error) {
    console.error("[Start Consultation API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start consultation" },
      { status: 500 }
    );
  }
}
