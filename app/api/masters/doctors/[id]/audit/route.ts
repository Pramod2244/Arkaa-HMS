/**
 * Doctor Audit History API
 * 
 * GET /api/masters/doctors/[id]/audit - Get audit history for a doctor
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { doctorService } from "@/lib/services/masters/doctorService";
import { DoctorAuditQuerySchema } from "@/lib/schemas/doctor-schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============== GET: Get Doctor Audit History ==============

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
    if (!session.tenantId) {
      return NextResponse.json(
        { success: false, error: "Tenant context required" },
        { status: 400 }
      );
    }

    // 2. Check permission (VIEW is enough to see audit)
    requirePermission(session, "DOCTOR_VIEW");

    // 3. Verify doctor exists
    const doctor = await doctorService.getById(session.tenantId, id);
    if (!doctor) {
      return NextResponse.json(
        { success: false, error: "Doctor not found" },
        { status: 404 }
      );
    }

    // 4. Parse query params
    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
      action: searchParams.get("action") || undefined,
    };

    const parseResult = DoctorAuditQuerySchema.safeParse(queryParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid query parameters", 
          details: parseResult.error.flatten() 
        },
        { status: 400 }
      );
    }

    // 5. Get audit history
    const result = await doctorService.getAuditHistory(
      session.tenantId,
      id,
      parseResult.data
    );

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.message, errorCode: error.errorCode },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/masters/doctors/[id]/audit error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
