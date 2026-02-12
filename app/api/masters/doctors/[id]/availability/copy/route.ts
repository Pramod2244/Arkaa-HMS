/**
 * Copy Availability API Route
 * 
 * POST /api/masters/doctors/[id]/availability/copy - Copy availability to other days
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { availabilityService } from "@/lib/services/availabilityService";
import { CopyAvailabilitySchema } from "@/lib/schemas/availability-schema";

// POST - Copy availability to other days
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    const hasPermission = session.permissions?.includes("AVAILABILITY_CREATE") || 
                          session.permissions?.includes("ADMIN");
    if (!hasPermission) {
      return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();

    const parseResult = CopyAvailabilitySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const result = await availabilityService.copyToOtherDays(
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

    return NextResponse.json({ 
      success: true, 
      data: result.data, 
      message: result.error || "Availability copied successfully" 
    }, { status: 201 });
  } catch (error) {
    console.error("Copy availability error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
