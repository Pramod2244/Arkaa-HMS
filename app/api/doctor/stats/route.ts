/**
 * Doctor Stats API
 * GET /api/doctor/stats
 * 
 * Returns quick stats for doctor's OPD dashboard.
 * Lightweight - just counts from READ MODEL.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getDoctorStats, getDoctorContext } from "@/lib/services/doctor-dashboard";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    
    if (!session || !session.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check permission
    if (!session.permissions.includes("CONSULTATION_VIEW") && 
        !session.permissions.includes("DOCTOR_QUEUE_VIEW")) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const departmentId = searchParams.get("departmentId") || undefined;

    // Get stats and doctor context in parallel
    const [stats, doctorContext] = await Promise.all([
      getDoctorStats(session.userId, session.tenantId, departmentId),
      getDoctorContext(session.userId, session.tenantId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stats,
        doctor: doctorContext,
      },
    });
  } catch (error) {
    console.error("[Doctor Stats API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
