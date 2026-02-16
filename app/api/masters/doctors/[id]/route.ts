/**
 * Doctor Master API Routes by ID
 * 
 * GET /api/masters/doctors/[id] - Get doctor by ID
 * PUT /api/masters/doctors/[id] - Update doctor
 * DELETE /api/masters/doctors/[id] - Soft delete / disable doctor
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { doctorService } from "@/lib/services/masters/doctorService";
import { UpdateDoctorSchema } from "@/lib/schemas/doctor-schema";
import { ZodError } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============== GET: Get Doctor by ID ==============

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

    // 2. Check permission
    requirePermission(session, "DOCTOR_VIEW");

    // 3. Get doctor
    const doctor = await doctorService.getById(session.tenantId, id);

    if (!doctor) {
      return NextResponse.json(
        { success: false, error: "Doctor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: doctor });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.message, errorCode: error.errorCode },
        { status: error.statusCode }
      );
    }
    console.error("GET /api/masters/doctors/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============== PUT: Update Doctor ==============

export async function PUT(
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

    // 2. Check permission
    requirePermission(session, "DOCTOR_EDIT");

    // 3. Parse and validate body
    const body = await request.json();
    const parseResult = UpdateDoctorSchema.safeParse(body);

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

    // 4. Update doctor
    const result = await doctorService.update(
      session.tenantId,
      id,
      parseResult.data,
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
      message: "Doctor updated successfully",
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.message, errorCode: error.errorCode },
        { status: error.statusCode }
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("PUT /api/masters/doctors/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============== DELETE: Disable Doctor ==============

export async function DELETE(
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

    // 2. Check permission
    requirePermission(session, "DOCTOR_DISABLE");

    // 3. Disable doctor
    const result = await doctorService.disable(
      session.tenantId,
      id,
      session.userId
    );

    if (!result.success) {
      const statusCode = result.errorCode === "DOCTOR_NOT_FOUND" ? 404 : 400;
      
      return NextResponse.json(
        { success: false, error: result.error, errorCode: result.errorCode },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Doctor disabled successfully",
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.message, errorCode: error.errorCode },
        { status: error.statusCode }
      );
    }
    console.error("DELETE /api/masters/doctors/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
