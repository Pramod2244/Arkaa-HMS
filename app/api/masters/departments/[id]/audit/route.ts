/**
 * HMS Medical Masters - Department Audit API
 * 
 * GET /api/masters/departments/[id]/audit - Get audit history for department
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { departmentService } from "@/lib/services/masters";
import { AuditQuerySchema } from "@/lib/schemas/department-schema";
import { MASTER_PERMISSIONS, MASTER_ERROR_CODES } from "@/lib/services/masters/types";
import { ZodError } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============== GET - Get Audit History ==============

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    // Check permission - must have DEPARTMENT_VIEW to see audit
    requirePermission(session, MASTER_PERMISSIONS.DEPARTMENT_VIEW);

    const { id } = await params;
    
    // Verify department exists
    const department = await departmentService.getById(session.tenantId, id);
    if (!department) {
      return NextResponse.json(
        { success: false, message: "Department not found", errorCode: MASTER_ERROR_CODES.NOT_FOUND },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryInput = AuditQuerySchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      action: searchParams.get("action"),
      performedBy: searchParams.get("performedBy"),
    });

    // Get audit history
    const result = await departmentService.getAuditHistory(
      session.tenantId,
      id,
      queryInput
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("GET /api/masters/departments/[id]/audit error:", error);

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
