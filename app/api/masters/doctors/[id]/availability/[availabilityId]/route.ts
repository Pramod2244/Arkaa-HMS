/**
 * Individual Availability API Routes
 * 
 * GET /api/masters/doctors/[id]/availability/[availabilityId] - Get single availability
 * PUT /api/masters/doctors/[id]/availability/[availabilityId] - Update availability
 * DELETE /api/masters/doctors/[id]/availability/[availabilityId] - Delete availability
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { availabilityService } from "@/lib/services/availabilityService";
import { UpdateAvailabilitySchema } from "@/lib/schemas/availability-schema";

interface RouteParams {
  params: Promise<{ id: string; availabilityId: string }>;
}

// GET - Get single availability
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!session.tenantId) {
      return NextResponse.json({ success: false, message: "Tenant context required" }, { status: 400 });
    }

    const { availabilityId } = await context.params;

    const availability = await availabilityService.getById(session.tenantId, availabilityId);

    if (!availability) {
      return NextResponse.json(
        { success: false, error: "Availability not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: availability });
  } catch (error) {
    console.error("GET single availability error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update availability
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!session.tenantId) {
      return NextResponse.json({ success: false, message: "Tenant context required" }, { status: 400 });
    }

    // Check permission
    const hasPermission = session.permissions?.includes("AVAILABILITY_UPDATE") || 
                          session.permissions?.includes("ADMIN");
    if (!hasPermission) {
      return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
    }

    const { availabilityId } = await context.params;
    const body = await request.json();

    const parseResult = UpdateAvailabilitySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const result = await availabilityService.update(
      session.tenantId,
      availabilityId,
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
  } catch (error) {
    console.error("PUT availability error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete availability
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!session.tenantId) {
      return NextResponse.json({ success: false, message: "Tenant context required" }, { status: 400 });
    }

    // Check permission
    const hasPermission = session.permissions?.includes("AVAILABILITY_DELETE") || 
                          session.permissions?.includes("ADMIN");
    if (!hasPermission) {
      return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
    }

    const { availabilityId } = await context.params;

    const result = await availabilityService.delete(
      session.tenantId,
      availabilityId,
      session.userId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, errorCode: result.errorCode },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Availability deleted" });
  } catch (error) {
    console.error("DELETE availability error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
