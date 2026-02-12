import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { updateAppointment, cancelAppointment } from "@/lib/services/appointments";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "APPOINTMENT_EDIT");

    const body = await request.json();
    const appointment = await updateAppointment(id, body, session.tenantId, session.userId);

    return NextResponse.json({ success: true, data: appointment });
  } catch (error) {
    console.error("PUT /api/appointments/[id] error:", error);

    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, message: "Permission denied", errorCode: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === "Appointment not found") {
      return NextResponse.json(
        { success: false, message: "Appointment not found", errorCode: "NOT_FOUND" },
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
    const { id } = await params;
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "APPOINTMENT_EDIT");

    await cancelAppointment(id, session.tenantId, session.userId);

    return NextResponse.json({ success: true, message: "Appointment cancelled successfully" });
  } catch (error) {
    console.error("DELETE /api/appointments/[id] error:", error);

    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, message: "Permission denied", errorCode: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === "Appointment not found") {
      return NextResponse.json(
        { success: false, message: "Appointment not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}