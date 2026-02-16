/**
 * Appointment Actions API
 * 
 * POST /api/appointments/[id]/[action] - Perform action on appointment
 * Actions: reschedule, cancel, checkin, start, complete
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { appointmentBookingService } from "@/lib/services/appointmentBookingService";
import {
  RescheduleAppointmentSchema,
  CancelAppointmentSchema,
} from "@/lib/schemas/appointment-schema";

interface RouteParams {
  params: Promise<{ id: string; action: string }>;
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!session.tenantId) {
      return NextResponse.json({ success: false, message: "Tenant context required" }, { status: 400 });
    }

    const { id: appointmentId, action } = await context.params;

    switch (action) {
      case "reschedule": {
        const hasPermission = session.permissions?.includes("APPOINTMENT_RESCHEDULE") || 
                              session.permissions?.includes("ADMIN");
        if (!hasPermission) {
          return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
        }

        const body = await request.json();
        const parseResult = RescheduleAppointmentSchema.safeParse({ ...body, appointmentId });
        if (!parseResult.success) {
          return NextResponse.json(
            { success: false, error: "Validation failed", details: parseResult.error.issues },
            { status: 400 }
          );
        }

        const result = await appointmentBookingService.reschedule(
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

        return NextResponse.json({ success: true, data: result.data });
      }

      case "cancel": {
        const hasPermission = session.permissions?.includes("APPOINTMENT_CANCEL") || 
                              session.permissions?.includes("ADMIN");
        if (!hasPermission) {
          return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
        }

        const body = await request.json();
        const parseResult = CancelAppointmentSchema.safeParse({ ...body, appointmentId });
        if (!parseResult.success) {
          return NextResponse.json(
            { success: false, error: "Validation failed", details: parseResult.error.issues },
            { status: 400 }
          );
        }

        const result = await appointmentBookingService.cancel(
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

        return NextResponse.json({ success: true, message: "Appointment cancelled" });
      }

      case "checkin": {
        const hasPermission = session.permissions?.includes("APPOINTMENT_CHECKIN") || 
                              session.permissions?.includes("ADMIN");
        if (!hasPermission) {
          return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
        }

        const result = await appointmentBookingService.checkIn(
          session.tenantId,
          appointmentId,
          session.userId
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error, errorCode: result.errorCode },
            { status: 400 }
          );
        }

        return NextResponse.json({ success: true, data: result.data });
      }

      case "start": {
        const hasPermission = session.permissions?.includes("APPOINTMENT_UPDATE") || 
                              session.permissions?.includes("ADMIN");
        if (!hasPermission) {
          return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
        }

        const result = await appointmentBookingService.startConsultation(
          session.tenantId,
          appointmentId,
          session.userId
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error, errorCode: result.errorCode },
            { status: 400 }
          );
        }

        return NextResponse.json({ success: true, data: result.data });
      }

      case "complete": {
        const hasPermission = session.permissions?.includes("APPOINTMENT_UPDATE") || 
                              session.permissions?.includes("ADMIN");
        if (!hasPermission) {
          return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
        }

        const result = await appointmentBookingService.complete(
          session.tenantId,
          appointmentId,
          session.userId
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error, errorCode: result.errorCode },
            { status: 400 }
          );
        }

        return NextResponse.json({ success: true, message: "Appointment completed" });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Appointment action error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
