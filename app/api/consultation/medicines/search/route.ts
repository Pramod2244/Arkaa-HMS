/**
 * Phase-3: Medicine Search API
 * 
 * GET /api/consultation/medicines/search?q=xxx
 * 
 * Smart medicine auto-suggest with prioritized results.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { searchMedicines, getDoctorTopMedicines } from "@/lib/services/medicine-suggest";

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await getSessionFromRequest(request);
    if (!session || !session.userId || !session.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { userId, tenantId } = session;

    // Get query params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limitStr = searchParams.get("limit");
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    const topOnly = searchParams.get("top") === "true";

    // If topOnly, return doctor's top medicines
    if (topOnly) {
      const topMedicines = await getDoctorTopMedicines(tenantId, userId, limit);
      return NextResponse.json({
        success: true,
        data: topMedicines,
      });
    }

    // Otherwise, search medicines
    const suggestions = await searchMedicines(query, tenantId, userId, limit);

    return NextResponse.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error("[Medicine Search API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
