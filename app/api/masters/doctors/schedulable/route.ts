/**
 * Schedulable Doctors API
 * 
 * GET /api/masters/doctors/schedulable - Get doctors available for appointments
 * Used for appointment booking system
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AppError } from "@/lib/rbac";
import { doctorService } from "@/lib/services/masters/doctorService";

// ============== GET: Get Schedulable Doctors ==============

export async function GET(request: NextRequest) {
  try {
    // 1. Verify auth
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Check permission (basic view is enough for appointment booking)
    const hasPermission = session.permissions.includes("DOCTOR_VIEW") || 
                          session.permissions.includes("APPOINTMENT_CREATE");
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: "Access denied." },
        { status: 403 }
      );
    }

    // 3. Parse optional department filter
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId") || undefined;

    // 4. Get schedulable doctors
    const doctors = await doctorService.getSchedulableDoctors(
      session.tenantId,
      departmentId
    );

    return NextResponse.json({
      success: true,
      data: doctors,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.message, errorCode: error.errorCode },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/masters/doctors/schedulable error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
