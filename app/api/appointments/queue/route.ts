/**
 * OPD Queue API
 * 
 * GET /api/appointments/queue - Get OPD queue for department
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { appointmentBookingService } from "@/lib/services/appointmentBookingService";
import { z } from "zod";

const QueueQuerySchema = z.object({
  departmentId: z.string().uuid("Invalid department ID"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  doctorId: z.string().uuid().optional(),
});

// GET - Get OPD queue
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!session.tenantId) {
      return NextResponse.json({ success: false, error: "Tenant context required" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);

    const queryResult = QueueQuerySchema.safeParse({
      departmentId: searchParams.get("departmentId"),
      date: searchParams.get("date") || undefined,
      doctorId: searchParams.get("doctorId") || undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid query parameters", details: queryResult.error.issues },
        { status: 400 }
      );
    }

    const { departmentId, date, doctorId } = queryResult.data;
    const queueDate = date || new Date().toISOString().split("T")[0];

    const queue = await appointmentBookingService.getOPDQueue(
      session.tenantId,
      departmentId,
      queueDate,
      doctorId
    );

    // Calculate queue statistics
    const stats = {
      total: queue.length,
      waiting: queue.filter((a) => a.status === "BOOKED" || a.status === "CONFIRMED" || a.status === "RESCHEDULED").length,
      checkedIn: queue.filter((a) => a.status === "CHECKED_IN").length,
      inProgress: queue.filter((a) => a.status === "IN_PROGRESS").length,
      walkIns: queue.filter((a) => a.isWalkIn).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        date: queueDate,
        queue,
        stats,
      },
    });
  } catch (error) {
    console.error("Get OPD queue error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
