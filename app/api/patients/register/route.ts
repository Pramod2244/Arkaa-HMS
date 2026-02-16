import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import {
  registerPatient,
  checkDuplicatePatient,
  getTenantRegistrationFee,
} from "@/lib/services/patient-registration";
import { PatientRegistrationSchema } from "@/lib/schemas/patient-registration-schema";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/patients/register
 * 
 * Complete patient registration:
 * - Create patient master
 * - Create registration record
 * - Handle billing
 * - Optionally create visit
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

    // Require both patient create and register permissions
    requirePermission(session, "PATIENT_CREATE");

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { id: true, code: true, name: true },
    });
    
    if (!tenant) {
      console.error(`Tenant not found: ${session.tenantId}`);
      return NextResponse.json(
        { success: false, message: "Your organization (tenant) was not found. Please re-login.", errorCode: "TENANT_NOT_FOUND" },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate input
    const validatedData = PatientRegistrationSchema.parse(body);

    // Check for duplicate patient
    const duplicateCheck = await checkDuplicatePatient(
      session.tenantId,
      validatedData.primaryMobile,
      validatedData.aadhaarNumber || undefined
    );

    if (duplicateCheck.exists && !body.skipDuplicateCheck) {
      return NextResponse.json(
        {
          success: false,
          message: "Potential duplicate patient found",
          errorCode: "DUPLICATE_PATIENT",
          data: {
            duplicates: duplicateCheck.patients,
          },
        },
        { status: 409 }
      );
    }

    // Register patient
    const result = await registerPatient(
      session.tenantId,
      session.userId,
      validatedData
    );

    return NextResponse.json(
      {
        success: true,
        message: "Patient registered successfully",
        data: {
          patient: {
            id: result.patient.id,
            uhid: result.patient.uhid,
            firstName: result.patient.firstName,
            lastName: result.patient.lastName,
            primaryMobile: result.patient.primaryMobile,
          },
          registration: {
            id: result.registration.id,
            registrationNumber: result.registration.registrationNumber,
            netAmount: result.registration.netAmount,
          },
          visit: result.visit ? {
            id: result.visit.id,
            tokenNumber: result.visit.tokenNumber,
            visitNumber: result.visit.visitNumber,
            department: result.visit.department,
            doctor: result.visit.doctorMaster,
          } : null,
          receipt: result.receipt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/patients/register error:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errorCode: "VALIDATION_ERROR",
          errors: error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

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

/**
 * GET /api/patients/register
 * 
 * Get registration configuration (fee, counters, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "PATIENT_VIEW");

    const registrationFee = await getTenantRegistrationFee(session.tenantId);

    // Get current user info for approved by field
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, fullName: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        registrationFee,
        currentUser: currentUser || { id: session.userId, fullName: "Unknown User" },
        // Additional config can be added here
      },
    });
  } catch (error) {
    console.error("GET /api/patients/register error:", error);

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
