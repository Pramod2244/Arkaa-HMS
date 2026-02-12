/**
 * Doctor Status Update API
 * 
 * PATCH /api/masters/doctors/[id]/status - Update doctor status (ACTIVE, INACTIVE, ON_LEAVE)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { doctorService } from "@/lib/services/masters/doctorService";
import { DoctorStatusUpdateSchema } from "@/lib/schemas/doctor-schema";
import { DoctorStatus } from "@/app/generated/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============== PATCH: Update Doctor Status ==============

export async function PATCH(
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
    requirePermission(session, "DOCTOR_EDIT");

    // 3. Parse and validate body
    const body = await request.json();
    const parseResult = DoctorStatusUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Validation failed", 
          details: parseResult.error.flatten() 
        },
        { status: 400 }
      );
    }

    // 4. Update status
    const result = await doctorService.updateStatus(
      session.tenantId,
      id,
      parseResult.data.status as DoctorStatus,
      parseResult.data.version,
      session.userId
    );

    if (!result.success) {
      const statusCode = result.errorCode === "DOCTOR_NOT_FOUND" ? 404 
        : result.errorCode === "VERSION_CONFLICT" ? 409 
        : 400;
      
      return NextResponse.json(
        { success: false, error: result.error, errorCode: result.errorCode },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: `Doctor status updated to ${parseResult.data.status}`,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.message, errorCode: error.errorCode },
        { status: error.statusCode }
      );
    }
    console.error("PATCH /api/masters/doctors/[id]/status error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
