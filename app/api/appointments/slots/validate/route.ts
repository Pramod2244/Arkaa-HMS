/**
 * Validate Booking API
 * 
 * POST /api/appointments/slots/validate - Validate if a slot can be booked
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { availabilityService } from "@/lib/services/availabilityService";
import { z } from "zod";

const ValidateBookingSchema = z.object({
  doctorId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  isWalkIn: z.boolean().optional().default(false),
});

// POST - Validate a slot booking
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const parseResult = ValidateBookingSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { doctorId, date, time, isWalkIn } = parseResult.data;

    const result = await availabilityService.validateSlotBooking(
      session.tenantId,
      doctorId,
      new Date(date),
      time,
      isWalkIn
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("Validate booking error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
