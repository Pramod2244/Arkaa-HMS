/**
 * HMS Medical Masters - Department Export API
 * 
 * GET /api/masters/departments/export - Export departments to file
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { departmentService } from "@/lib/services/masters";
import { ExportDepartmentSchema } from "@/lib/schemas/department-schema";
import { MASTER_PERMISSIONS, MASTER_ERROR_CODES, ExportFormat } from "@/lib/services/masters/types";
import { toCSV, toJSON } from "@/lib/services/masters/importExportUtils";
import { ZodError } from "zod";

// ============== GET - Export Departments ==============

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    // Check permission - must have DEPARTMENT_EXPORT
    requirePermission(session, MASTER_PERMISSIONS.DEPARTMENT_EXPORT);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") ?? "csv") as ExportFormat;
    const selectedIdsParam = searchParams.get("selectedIds");
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    // Validate format
    const input = ExportDepartmentSchema.parse({
      format,
      selectedIds: selectedIdsParam ? selectedIdsParam.split(",") : undefined,
      includeDeleted,
    });

    // JSON export is restricted to Super Admin
    if (input.format === "json" && !session.permissions?.includes(MASTER_PERMISSIONS.MASTER_ADMIN)) {
      // Check if user is Super Admin (has all permissions)
      const isAdmin = session.permissions?.includes("MASTER_ADMIN");
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, message: "JSON export is only available for Super Admin", errorCode: MASTER_ERROR_CODES.ACCESS_DENIED },
          { status: 403 }
        );
      }
    }

    // Get export data
    const data = await departmentService.getExportData(session.tenantId, {
      selectedIds: input.selectedIds,
      includeDeleted: input.includeDeleted,
    });

    // Format data for export
    const formattedData = departmentService.formatForExport(data);

    // Generate file content
    let content: string;
    let contentType: string;
    let filename: string;
    const timestamp = new Date().toISOString().split("T")[0];

    switch (input.format) {
      case "csv":
      case "excel":
        content = "\ufeff" + toCSV(formattedData); // BOM for Excel
        contentType = "text/csv; charset=utf-8";
        filename = `departments_${timestamp}.csv`;
        break;
      case "json":
        content = toJSON(formattedData);
        contentType = "application/json";
        filename = `departments_${timestamp}.json`;
        break;
      default:
        return NextResponse.json(
          { success: false, message: "Invalid export format", errorCode: MASTER_ERROR_CODES.INVALID_INPUT },
          { status: 400 }
        );
    }

    // Return file response
    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("GET /api/masters/departments/export error:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid export parameters",
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
