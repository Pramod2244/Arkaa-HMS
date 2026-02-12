import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getVisits, createVisit, updateVisitStatus } from "@/lib/services/visits";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "VISIT_VIEW");

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const patientId = searchParams.get("patientId") || undefined;
    const doctorId = searchParams.get("doctorId") || undefined;
    const status = searchParams.get("status") || undefined;
    const date = searchParams.get("date") || undefined;

    const result = await getVisits(session.tenantId, {
      page,
      limit,
      patientId,
      doctorId,
      status,
      date,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("GET /api/visits error:", error);

    if (error instanceof Error && error.message.includes('Permission denied')) {
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

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "VISIT_CREATE");

    const body = await request.json();
    const visit = await createVisit(body, session.tenantId, session.userId);

    return NextResponse.json({ success: true, data: visit }, { status: 201 });
  } catch (error) {
    console.error("POST /api/visits error:", error);

    if (error instanceof Error && error.message.includes('Permission denied')) {
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