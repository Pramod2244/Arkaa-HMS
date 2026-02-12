import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { searchPatients } from "@/lib/services/patients";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "PATIENT_VIEW");

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const searchBy = searchParams.get("searchBy") as 'mobile' | 'uhid' | 'name';
    const includeSummary = searchParams.get("includeSummary") === 'true';

    if (!query || !searchBy) {
      return NextResponse.json(
        { success: false, message: "Query and searchBy parameters are required" },
        { status: 400 }
      );
    }

    const results = await searchPatients(session.tenantId, query, searchBy, includeSummary);

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("GET /api/patients/search error:", error);

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