/**
 * Walk-in Appointment API
 * 
 * POST /api/appointments/walkin - Create walk-in appointment
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { appointmentBookingService } from "@/lib/services/appointmentBookingService";
import { WalkInAppointmentSchema } from "@/lib/schemas/appointment-schema";

// POST - Create walk-in appointment
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    const hasPermission = session.permissions?.includes("APPOINTMENT_CREATE") || 
                          session.permissions?.includes("ADMIN");
    if (!hasPermission) {
      return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();

    const parseResult = WalkInAppointmentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const result = await appointmentBookingService.walkIn(
      session.tenantId,
      parseResult.data,
      session.userId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, errorCode: result.errorCode },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    console.error("Walk-in appointment error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
