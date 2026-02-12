/**
 * Doctor Usage Statistics API
 * 
 * GET /api/masters/doctors/[id]/usage - Get usage stats before deletion
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { doctorService } from "@/lib/services/masters/doctorService";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============== GET: Get Doctor Usage Stats ==============

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // 1. Verify auth
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Check permission
    requirePermission(session, "DOCTOR_VIEW");

    // 3. Verify doctor exists
    const doctor = await doctorService.getById(session.tenantId, id);
    if (!doctor) {
      return NextResponse.json(
        { success: false, error: "Doctor not found" },
        { status: 404 }
      );
    }

    // 4. Get usage stats
    const usage = await doctorService.checkUsage(session.tenantId, id);

    return NextResponse.json({
      success: true,
      data: {
        doctor: {
          id: doctor.id,
          doctorCode: doctor.doctorCode,
          fullName: doctor.fullName,
        },
        usage,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.message, errorCode: error.errorCode },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/masters/doctors/[id]/usage error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
