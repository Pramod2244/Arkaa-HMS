/**
 * Doctor by Department API
 * 
 * GET /api/masters/doctors/by-department?departmentId=xxx - Get doctors by department
 * Used for OPD workflow, appointments, consultations
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { doctorService } from "@/lib/services/masters/doctorService";
import { DoctorsByDepartmentSchema } from "@/lib/schemas/doctor-schema";
import { DoctorStatus } from "@/app/generated/prisma/client";

// ============== GET: Get Doctors by Department ==============

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
    if (!session.tenantId) {
      return NextResponse.json(
        { success: false, error: "Tenant context required" },
        { status: 400 }
      );
    }

    // 2. Check permission (basic view permission)
    requirePermission(session, "DOCTOR_VIEW");

    // 3. Parse query params
    const { searchParams } = new URL(request.url);
    const queryParams = {
      departmentId: searchParams.get("departmentId") || "",
      status: searchParams.get("status") || undefined,
      isSchedulable: searchParams.get("isSchedulable") 
        ? searchParams.get("isSchedulable") === "true" 
        : undefined,
      allowWalkIn: searchParams.get("allowWalkIn") 
        ? searchParams.get("allowWalkIn") === "true" 
        : undefined,
    };

    const parseResult = DoctorsByDepartmentSchema.safeParse(queryParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid query parameters. departmentId is required.", 
          details: parseResult.error.flatten() 
        },
        { status: 400 }
      );
    }

    // 4. Get doctors
    const doctors = await doctorService.getByDepartment(
      session.tenantId,
      parseResult.data.departmentId,
      {
        status: parseResult.data.status as DoctorStatus,
        isSchedulable: parseResult.data.isSchedulable,
        allowWalkIn: parseResult.data.allowWalkIn,
      }
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
    console.error("GET /api/masters/doctors/by-department error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
