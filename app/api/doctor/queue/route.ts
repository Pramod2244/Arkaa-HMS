/**
 * Doctor Queue API
 * GET /api/doctor/queue
 * 
 * Returns today's OPD queue for the logged-in doctor.
 * Uses OPDQueueSnapshot (READ model) for efficient queries.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getDoctorQueue } from "@/lib/services/doctor-dashboard";

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
    const statusParam = searchParams.get("status");
    
    // Parse status (can be comma-separated for multiple)
    const status = statusParam 
      ? statusParam.includes(",") 
        ? statusParam.split(",").map(s => s.trim())
        : statusParam
      : undefined;

    const queue = await getDoctorQueue(
      session.userId,
      session.tenantId,
      { departmentId, status }
    );

    return NextResponse.json({
      success: true,
      data: queue,
    });
  } catch (error) {
    console.error("[Doctor Queue API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch queue" },
      { status: 500 }
    );
  }
}
