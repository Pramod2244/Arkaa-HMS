/**
 * Doctor Availability API Routes
 * 
 * GET /api/masters/doctors/[id]/availability - List availability for a doctor
 * POST /api/masters/doctors/[id]/availability - Create new availability
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { availabilityService } from "@/lib/services/availabilityService";
import {
  CreateAvailabilitySchema,
  BulkCreateAvailabilitySchema,
  AvailabilityQuerySchema,
} from "@/lib/schemas/availability-schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - List doctor availability
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: doctorId } = await context.params;
    const { searchParams } = new URL(request.url);

    // Parse query params
    const queryResult = AvailabilityQuerySchema.safeParse({
      doctorId,
      departmentId: searchParams.get("departmentId") || undefined,
      dayOfWeek: searchParams.get("dayOfWeek") || undefined,
      status: searchParams.get("status") || undefined,
      includeExpired: searchParams.get("includeExpired") === "true",
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid query parameters", details: queryResult.error.errors },
        { status: 400 }
      );
    }

    const availabilities = await availabilityService.list(session.tenantId, queryResult.data);

    return NextResponse.json({ success: true, data: availabilities });
  } catch (error) {
    console.error("GET availability error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create availability
export async function POST(request: NextRequest, context: RouteParams) {
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

    const { id: doctorId } = await context.params;
    const body = await request.json();

    // Determine if it's a bulk create
    const isBulkCreate = Array.isArray(body.daysOfWeek);

    if (isBulkCreate) {
      const parseResult = BulkCreateAvailabilitySchema.safeParse({ ...body, doctorId });
      if (!parseResult.success) {
        return NextResponse.json(
          { success: false, error: "Validation failed", details: parseResult.error.errors },
          { status: 400 }
        );
      }

      const result = await availabilityService.bulkCreate(
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

      return NextResponse.json({ success: true, data: result.data, message: result.error });
    } else {
      const parseResult = CreateAvailabilitySchema.safeParse({ ...body, doctorId });
      if (!parseResult.success) {
        return NextResponse.json(
          { success: false, error: "Validation failed", details: parseResult.error.errors },
          { status: 400 }
        );
      }

      const result = await availabilityService.create(
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
    }
  } catch (error) {
    console.error("POST availability error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
