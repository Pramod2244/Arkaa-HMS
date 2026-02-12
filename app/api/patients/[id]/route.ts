import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission, AppError } from "@/lib/rbac";
import { getPatientById, updatePatient, deletePatient } from "@/lib/services/patients";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "PATIENT_VIEW");

    const patient = await getPatientById(id, session.tenantId);

    return NextResponse.json({ success: true, data: patient });
  } catch (error) {
    console.error(`GET /api/patients/${id} error:`, error);

    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          errorCode: error.errorCode
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

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "PATIENT_EDIT");

    const body = await request.json();
    const patient = await updatePatient(id, body, session.tenantId, session.userId);

    return NextResponse.json({ success: true, data: patient });
  } catch (error) {
    console.error(`PUT /api/patients/${id} error:`, error);

    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          errorCode: error.errorCode
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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "PATIENT_DELETE");

    await deletePatient(id, session.tenantId, session.userId);

    return NextResponse.json({ success: true, message: "Patient deleted successfully" });
  } catch (error) {
    console.error(`DELETE /api/patients/${id} error:`, error);

    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          errorCode: error.errorCode
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