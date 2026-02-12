import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getMultipleDoctorsCalendar } from "@/lib/services/appointmentService";

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
    const doctorIdsParam = searchParams.get("doctorIds");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    if (!doctorIdsParam || !startDateParam || !endDateParam) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters: doctorIds, startDate, endDate" },
        { status: 400 }
      );
    }

    const doctorIds = doctorIdsParam.split(",");
    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    console.log("[Appointment Calendar] Fetching calendar for doctors:", {
      doctorIds,
      startDate,
      endDate,
    });

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, message: "Invalid date format" },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { success: false, message: "Start date must be before end date" },
        { status: 400 }
      );
    }

    // Fetch calendar data
    const calendarData = await getMultipleDoctorsCalendar(
      doctorIds,
      startDate,
      endDate,
      session.tenantId
    );

    return NextResponse.json({
      success: true,
      data: calendarData,
    });
  } catch (error) {
    console.error("[Appointment Calendar] Error:", error);

    if (error instanceof Error && error.message.includes("Doctor not found")) {
      return NextResponse.json(
        { success: false, message: "One or more doctors not found", errorCode: "DOCTOR_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message.includes("Permission denied")) {
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
