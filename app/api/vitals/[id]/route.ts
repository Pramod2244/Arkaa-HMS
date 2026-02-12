import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getVitalsById, updateVitals, deleteVitals } from "@/lib/services/vitals";
import { VitalsSchema } from "@/lib/schemas/clinical-schema";

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

    requirePermission(session, "VITAL_READ");

    const { id } = await params;

    const vitals = await getVitalsById(id, session.tenantId);

    if (!vitals) {
      return NextResponse.json(
        { success: false, message: "Vitals not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: vitals });
  } catch (error) {
    console.error("GET /api/vitals/[id] error:", error);

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

    requirePermission(session, "VITAL_EDIT");

    const { id } = await params;
    const body = await request.json();
    const validatedData = VitalsSchema.partial().parse(body);

    const vitals = await updateVitals(id, validatedData, session.tenantId, session.userId);

    return NextResponse.json({ success: true, data: vitals });
  } catch (error) {
    console.error("PUT /api/vitals/[id] error:", error);

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

    if (error instanceof Error && error.message === "Vitals not found") {
      return NextResponse.json(
        { success: false, message: "Vitals not found", errorCode: "NOT_FOUND" },
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

    requirePermission(session, "VITAL_DELETE");

    const { id } = await params;

    await deleteVitals(id, session.tenantId, session.userId);

    return NextResponse.json({ success: true, message: "Vitals deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/vitals/[id] error:", error);

    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, message: "Permission denied", errorCode: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === "Vitals not found") {
      return NextResponse.json(
        { success: false, message: "Vitals not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}