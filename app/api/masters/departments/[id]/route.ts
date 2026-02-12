/**
 * HMS Medical Masters - Department [id] API Routes
 * 
 * GET    /api/masters/departments/[id] - Get department by ID
 * PUT    /api/masters/departments/[id] - Update department (description & status ONLY)
 * DELETE /api/masters/departments/[id] - DISABLED (departments cannot be deleted)
 * 
 * IMPORTANT: Departments are predefined system masters.
 * - Code and Name are READ-ONLY
 * - Only description and status can be modified
 * - Cannot delete departments
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { departmentService } from "@/lib/services/masters";
import { UpdateDepartmentRestrictedSchema } from "@/lib/schemas/department-schema";
import { MASTER_PERMISSIONS, MASTER_ERROR_CODES } from "@/lib/services/masters/types";
import { createAuditLog } from "@/lib/audit";
import { ZodError } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============== GET - Get Department by ID ==============

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, MASTER_PERMISSIONS.DEPARTMENT_VIEW);

    const { id } = await params;
    const department = await departmentService.getById(session.tenantId, id);

    if (!department) {
      return NextResponse.json(
        { success: false, message: "Department not found", errorCode: MASTER_ERROR_CODES.NOT_FOUND },
        { status: 404 }
      );
    }

    // Get usage stats for the department
    const { stats } = await departmentService.getDepartmentWithStats(session.tenantId, id);

    return NextResponse.json({
      success: true,
      data: {
        ...department,
        usage: stats,
      },
    });
  } catch (error) {
    console.error("GET /api/masters/departments/[id] error:", error);

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

// ============== PUT - Update Department (RESTRICTED) ==============
// Only description and status can be updated. Code and Name are READ-ONLY.

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.userId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    // Check permission - must have DEPARTMENT_EDIT (not UPDATE for clarity)
    requirePermission(session, MASTER_PERMISSIONS.DEPARTMENT_UPDATE);

    const { id } = await params;
    
    // Get existing department first for audit
    const existing = await departmentService.getById(session.tenantId, id);
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Department not found", errorCode: MASTER_ERROR_CODES.NOT_FOUND },
        { status: 404 }
      );
    }

    // Parse with RESTRICTED schema - only allows description and status
    const body = await request.json();
    const input = UpdateDepartmentRestrictedSchema.parse(body);

    // Block any attempt to change code or name (extra safety)
    if (body.code && body.code !== existing.code) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Department code cannot be changed. It is a system-defined value.",
          errorCode: "FIELD_READONLY" 
        },
        { status: 400 }
      );
    }
    if (body.name && body.name !== existing.name) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Department name cannot be changed. It is a system-defined value.",
          errorCode: "FIELD_READONLY" 
        },
        { status: 400 }
      );
    }

    // Update only allowed fields using service
    const result = await departmentService.updateRestricted(
      session.tenantId,
      id,
      {
        description: input.description,
        status: input.status,
        version: input.version,
      },
      session.userId
    );

    if (!result.success) {
      const statusCode = result.errorCode === MASTER_ERROR_CODES.NOT_FOUND ? 404 :
                         result.errorCode === MASTER_ERROR_CODES.VERSION_CONFLICT ? 409 : 400;
      return NextResponse.json(
        { success: false, message: result.error, errorCode: result.errorCode },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: "Department updated successfully",
    });
  } catch (error) {
    console.error("PUT /api/masters/departments/[id] error:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed. Only description and status can be modified.",
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

// ============== DELETE - DISABLED ==============
// Departments are system masters and cannot be deleted.
// Use status = INACTIVE to disable a department instead.

export async function DELETE() {
  // Department deletion is not allowed - they are system masters
  return NextResponse.json(
    {
      success: false,
      message: "Department deletion is not allowed. Departments are predefined system masters. Use the status field to deactivate a department instead.",
      errorCode: "OPERATION_NOT_ALLOWED",
    },
    { status: 403 }
  );
}