import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { createConsultation, getConsultationsByVisitId } from "@/lib/services/consultations";
import { ConsultationSchema } from "@/lib/schemas/clinical-schema";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "CONSULTATION_CREATE");

    const body = await request.json();
    const validatedData = ConsultationSchema.parse(body);

    const consultation = await createConsultation(validatedData, session.tenantId, session.userId);

    return NextResponse.json({ success: true, data: consultation });
  } catch (error) {
    console.error("POST /api/consultations error:", error);

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

    requirePermission(session, "CONSULTATION_READ");

    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get("visitId");

    if (!visitId) {
      return NextResponse.json(
        { success: false, message: "visitId parameter is required", errorCode: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const consultations = await getConsultationsByVisitId(visitId, session.tenantId);

    return NextResponse.json({ success: true, data: consultations });
  } catch (error) {
    console.error("GET /api/consultations error:", error);

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