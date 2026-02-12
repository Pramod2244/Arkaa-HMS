import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getPrescriptionById, updatePrescription, deletePrescription } from "@/lib/services/prescriptions";
import { PrescriptionSchema } from "@/lib/schemas/clinical-schema";

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

    requirePermission(session, "PRESCRIPTION_READ");

    const { id } = await params;

    const prescription = await getPrescriptionById(id, session.tenantId);

    if (!prescription) {
      return NextResponse.json(
        { success: false, message: "Prescription not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: prescription });
  } catch (error) {
    console.error("GET /api/prescriptions/[id] error:", error);

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

    requirePermission(session, "PRESCRIPTION_EDIT");

    const { id } = await params;
    const body = await request.json();
    const validatedData = PrescriptionSchema.partial().parse(body);

    const prescription = await updatePrescription(id, validatedData, session.tenantId, session.userId);

    return NextResponse.json({ success: true, data: prescription });
  } catch (error) {
    console.error("PUT /api/prescriptions/[id] error:", error);

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

    if (error instanceof Error && error.message === "Prescription not found") {
      return NextResponse.json(
        { success: false, message: "Prescription not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    requirePermission(session, "PRESCRIPTION_DELETE");

    const { id } = await params;

    await deletePrescription(id, session.tenantId, session.userId);

    return NextResponse.json({ success: true, message: "Prescription deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/prescriptions/[id] error:", error);

    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, message: "Permission denied", errorCode: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === "Prescription not found") {
      return NextResponse.json(
        { success: false, message: "Prescription not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}