/**
 * Appointment Slots API
 * 
 * GET /api/appointments/slots - Get available slots for booking
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { availabilityService } from "@/lib/services/availabilityService";
import { SlotQuerySchema } from "@/lib/schemas/availability-schema";

// GET - Get available slots for a doctor on a date
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const queryResult = SlotQuerySchema.safeParse({
      doctorId: searchParams.get("doctorId"),
      date: searchParams.get("date"),
      departmentId: searchParams.get("departmentId") || undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid query parameters", details: queryResult.error.errors },
        { status: 400 }
      );
    }

    const result = await availabilityService.getDoctorDaySlots(
      session.tenantId,
      queryResult.data
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, errorCode: result.errorCode },
        { status: result.errorCode === "DOCTOR_NOT_AVAILABLE" ? 404 : 400 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("GET slots error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
