import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getConsultationById, updateConsultation, completeConsultation, cancelConsultation } from "@/lib/services/consultations";
import { ConsultationSchema } from "@/lib/schemas/clinical-schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "CONSULTATION_READ");

    const { id } = await params;

    const consultation = await getConsultationById(id, session.tenantId);

    if (!consultation) {
      return NextResponse.json(
        { success: false, message: "Consultation not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: consultation });
  } catch (error) {
    console.error("GET /api/consultations/[id] error:", error);

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "CONSULTATION_EDIT");

    const { id } = await params;
    const body = await request.json();
    const validatedData = ConsultationSchema.partial().parse(body);

    const consultation = await updateConsultation(id, validatedData, session.tenantId, session.userId);

    return NextResponse.json({ success: true, data: consultation });
  } catch (error) {
    console.error("PUT /api/consultations/[id] error:", error);

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

    if (error instanceof Error && error.message === "Consultation not found") {
      return NextResponse.json(
        { success: false, message: "Consultation not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === "complete") {
      requirePermission(session, "CONSULTATION_EDIT");
      const consultation = await completeConsultation(id, session.tenantId, session.userId);
      return NextResponse.json({ success: true, data: consultation });
    } else if (action === "cancel") {
      requirePermission(session, "CONSULTATION_EDIT");
      const consultation = await cancelConsultation(id, session.tenantId, session.userId);
      return NextResponse.json({ success: true, data: consultation });
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid action", errorCode: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("PATCH /api/consultations/[id] error:", error);

    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, message: "Permission denied", errorCode: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === "Consultation not found") {
      return NextResponse.json(
        { success: false, message: "Consultation not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}