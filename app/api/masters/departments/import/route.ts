/**
 * HMS Medical Masters - Department Import API
 * 
 * POST /api/masters/departments/import - Import departments from file
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { departmentService } from "@/lib/services/masters";
import { ImportDepartmentSchema } from "@/lib/schemas/department-schema";
import { MASTER_PERMISSIONS, MASTER_ERROR_CODES } from "@/lib/services/masters/types";
import { ZodError } from "zod";

// ============== POST - Import Departments ==============

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.userId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    // Check permission - must have DEPARTMENT_IMPORT
    requirePermission(session, MASTER_PERMISSIONS.DEPARTMENT_IMPORT);

    // Parse and validate request body
    const body = await request.json();
    const { rows, dryRun } = ImportDepartmentSchema.parse(body);

    // Import departments
    const result = await departmentService.import(
      session.tenantId,
      rows,
      session.userId,
      { dryRun }
    );

    // Determine response status based on results
    const hasErrors = result.errorCount > 0;
    const allFailed = result.successCount === 0 && hasErrors;
    
    if (allFailed) {
      return NextResponse.json(
        {
          success: false,
          message: "Import failed - all rows have errors",
          errorCode: MASTER_ERROR_CODES.IMPORT_VALIDATION_FAILED,
          data: result,
        },
        { status: 400 }
      );
    }

    const message = dryRun
      ? `Validation complete: ${result.successCount} valid, ${result.errorCount} errors`
      : hasErrors
        ? `Import completed with errors: ${result.successCount} imported, ${result.errorCount} failed`
        : `Successfully imported ${result.successCount} departments`;

    return NextResponse.json({
      success: true,
      message,
      data: result,
      ...(hasErrors && !dryRun && { errorCode: MASTER_ERROR_CODES.IMPORT_PARTIAL_SUCCESS }),
    });
  } catch (error) {
    console.error("POST /api/masters/departments/import error:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid import data",
          errorCode: MASTER_ERROR_CODES.INVALID_INPUT,
          errors: error.issues,
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
