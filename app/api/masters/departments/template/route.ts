/**
 * HMS Medical Masters - Department Template API
 * 
 * GET /api/masters/departments/template - Download import template
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { departmentService } from "@/lib/services/masters";
import { MASTER_PERMISSIONS } from "@/lib/services/masters/types";
import { generateImportTemplate } from "@/lib/services/masters/importExportUtils";

// ============== GET - Download Import Template ==============

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    // Check permission - must have DEPARTMENT_IMPORT to download template
    requirePermission(session, MASTER_PERMISSIONS.DEPARTMENT_IMPORT);

    // Get template from service
    const { columns, sampleRow } = departmentService.getImportTemplate();

    // Generate CSV template
    const content = generateImportTemplate(columns, sampleRow);

    // Return file response
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="department_import_template.csv"',
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("GET /api/masters/departments/template error:", error);

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
