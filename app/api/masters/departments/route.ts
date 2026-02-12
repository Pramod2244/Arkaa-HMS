/**
 * HMS Medical Masters - Department API Routes
 * 
 * GET  /api/masters/departments - List departments
 * POST /api/masters/departments - DISABLED (departments are system-seeded)
 * 
 * IMPORTANT: Departments are predefined system masters.
 * - They are seeded automatically for each tenant
 * - Admin can only ACTIVATE/DEACTIVATE and edit description
 * - Cannot create or delete departments
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { departmentService } from "@/lib/services/masters";
import { DepartmentQuerySchema } from "@/lib/schemas/department-schema";
import { MASTER_PERMISSIONS, MASTER_ERROR_CODES } from "@/lib/services/masters/types";
import { ZodError } from "zod";

// ============== GET - List Departments ==============

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    // Check permission - anyone with DEPARTMENT_VIEW can list
    requirePermission(session, MASTER_PERMISSIONS.DEPARTMENT_VIEW);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryInput = DepartmentQuerySchema.parse({
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      includeDeleted: searchParams.get("includeDeleted") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") || undefined,
    });

    const result = await departmentService.list(session.tenantId, queryInput);

    return NextResponse.json({ 
      success: true, 
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("GET /api/masters/departments error:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid query parameters",
          errorCode: MASTER_ERROR_CODES.INVALID_INPUT,
          errors: error.errors,
        },
        { status: 400 }
      );
    }

    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, message: error.message, errorCode: error.errorCode },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

// ============== POST - Create Department (DISABLED) ==============
// Departments are system-seeded and cannot be created manually

export async function POST() {
  // Department creation is not allowed - they are system-seeded
  return NextResponse.json(
    {
      success: false,
      message: "Department creation is not allowed. Departments are predefined system masters that are automatically seeded for each tenant.",
      errorCode: "OPERATION_NOT_ALLOWED",
    },
    { status: 403 }
  );
}
