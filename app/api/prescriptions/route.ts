import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createPrescription, getPrescriptionsByPatientId, getPrescriptionsByConsultationId } from "@/lib/services/prescriptions";
import { PrescriptionSchema } from "@/lib/schemas/clinical-schema";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "PRESCRIPTION_CREATE");

    const body = await request.json();
    const validatedData = PrescriptionSchema.parse(body);

    const prescription = await createPrescription(validatedData, session.tenantId, session.userId);

    return NextResponse.json({ success: true, data: prescription });
  } catch (error) {
    console.error("POST /api/prescriptions error:", error);

    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, message: "Permission denied", errorCode: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, message: "Validation error", errorCode: "VALIDATION_ERROR", errors: (error as any).errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "PRESCRIPTION_READ");

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const consultationId = searchParams.get("consultationId");

    if (!patientId && !consultationId) {
      return NextResponse.json(
        { success: false, message: "patientId or consultationId parameter is required", errorCode: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    let prescriptions;
    if (patientId) {
      prescriptions = await getPrescriptionsByPatientId(patientId, session.tenantId);
    } else {
      prescriptions = await getPrescriptionsByConsultationId(consultationId!, session.tenantId);
    }

    return NextResponse.json({ success: true, data: prescriptions });
  } catch (error) {
    console.error("GET /api/prescriptions error:", error);

    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, message: "Permission denied", errorCode: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}