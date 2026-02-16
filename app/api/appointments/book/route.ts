/**
 * Appointment Booking API
 * 
 * POST /api/appointments/book - Book a new appointment
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { appointmentBookingService } from "@/lib/services/appointmentBookingService";
import { CreateAppointmentSchema } from "@/lib/schemas/appointment-schema";

// POST - Book appointment
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!session.tenantId) {
      return NextResponse.json({ success: false, error: "Tenant context required" }, { status: 400 });
    }

    // Check permission
    const hasPermission = session.permissions?.includes("APPOINTMENT_CREATE") || 
                          session.permissions?.includes("ADMIN");
    if (!hasPermission) {
      return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();
    console.log("Book appointment request body:", JSON.stringify(body, null, 2));

    const parseResult = CreateAppointmentSchema.safeParse(body);
    if (!parseResult.success) {
      console.log("Validation errors:", JSON.stringify(parseResult.error.issues, null, 2));
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const result = await appointmentBookingService.book(
      session.tenantId,
      parseResult.data,
      session.userId
    );

    if (!result.success) {
      const status = result.errorCode === "SLOT_UNAVAILABLE" ? 409 : 400;
      return NextResponse.json(
        { success: false, error: result.error, errorCode: result.errorCode },
        { status }
      );
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    console.error("Book appointment error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
