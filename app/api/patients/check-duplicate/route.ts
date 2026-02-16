import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { checkDuplicatePatient } from "@/lib/services/patient-registration";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/patients/check-duplicate
 * 
 * Check if a patient with given mobile/aadhaar already exists
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "PATIENT_VIEW");

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { id: true },
    });
    
    if (!tenant) {
      console.error(`Tenant not found: ${session.tenantId}`);
      return NextResponse.json(
        { success: false, message: "Your organization (tenant) was not found. Please re-login.", errorCode: "TENANT_NOT_FOUND" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { mobile, aadhaar } = body;

    if (!mobile) {
      return NextResponse.json(
        { success: false, message: "Mobile number is required", errorCode: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const result = await checkDuplicatePatient(
      session.tenantId,
      mobile,
      aadhaar || undefined
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("POST /api/patients/check-duplicate error:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          errorCode: error.errorCode,
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
