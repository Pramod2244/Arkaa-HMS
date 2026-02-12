import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getAppointments, createAppointment, updateAppointment, cancelAppointment } from "@/lib/services/appointments";
import { createAppointmentWithConflictCheck } from "@/lib/services/appointmentService";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "APPOINTMENT_VIEW");

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const date = searchParams.get("date") || undefined;
    const doctorId = searchParams.get("doctorId") || undefined;
    const status = searchParams.get("status") || undefined;

    const result = await getAppointments(session.tenantId, { page, limit, date, doctorId, status });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("GET /api/appointments error:", error);

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

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "APPOINTMENT_CREATE");

    const body = await request.json();
    
    // Use new service with conflict checking
    const appointment = await createAppointmentWithConflictCheck(body, session.tenantId, session.userId);

    return NextResponse.json({ success: true, data: appointment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/appointments error:", error);

    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(
        { success: false, message: "Permission denied", errorCode: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }

    // Check for double-booking conflict
    if (error instanceof Error && error.message.includes('already booked')) {
      return NextResponse.json(
        { success: false, message: error.message, errorCode: "SLOT_CONFLICT" },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message.includes("required")) {
      return NextResponse.json(
        { success: false, message: error.message, errorCode: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}