/**
 * Doctor Master API Routes
 * 
 * POST /api/masters/doctors - Create new doctor
 * GET /api/masters/doctors - List doctors with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { doctorService } from "@/lib/services/masters/doctorService";
import { 
  CreateDoctorSchema, 
  DoctorQuerySchema 
} from "@/lib/schemas/doctor-schema";
import { ZodError } from "zod";

// ============== POST: Create Doctor ==============

export async function POST(request: NextRequest) {
  try {
    // 1. Verify auth
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Check permission
    requirePermission(session, "DOCTOR_CREATE");

    // 3. Parse and validate body
    const body = await request.json();
    const parseResult = CreateDoctorSchema.safeParse(body);

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

    // 4. Create doctor
    const result = await doctorService.create(
      session.tenantId,
      parseResult.data,
      session.userId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, errorCode: result.errorCode },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data, message: "Doctor created successfully" },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.message, errorCode: error.errorCode },
        { status: error.statusCode }
      );
    }
    console.error("POST /api/masters/doctors error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============== GET: List Doctors ==============

export async function GET(request: NextRequest) {
  try {
    // 1. Verify auth
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Check permission
    requirePermission(session, "DOCTOR_VIEW");

    // 3. Parse query params
    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      departmentId: searchParams.get("departmentId") || undefined,
      primaryDepartmentId: searchParams.get("primaryDepartmentId") || undefined,
      isSchedulable: searchParams.get("isSchedulable") 
        ? searchParams.get("isSchedulable") === "true" 
        : undefined,
      includeDeleted: searchParams.get("includeDeleted") === "true",
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") as "asc" | "desc" || undefined,
    };

    const parseResult = DoctorQuerySchema.safeParse(queryParams);

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

    // 4. List doctors
    const result = await doctorService.list(session.tenantId, parseResult.data);

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
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid parameters", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("GET /api/masters/doctors error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
