/**
 * Phase-3: Lab Test Search API
 * 
 * GET /api/consultation/labs/search?q=xxx
 * 
 * Lab test auto-suggest.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { searchLabTests, getLabTestCategories } from "@/lib/services/medicine-suggest";

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

    const { tenantId } = session;

    // Get query params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limitStr = searchParams.get("limit");
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    const categoriesOnly = searchParams.get("categories") === "true";

    // If categoriesOnly, return lab test categories
    if (categoriesOnly) {
      const categories = await getLabTestCategories(tenantId);
      return NextResponse.json({
        success: true,
        data: categories,
      });
    }

    // Otherwise, search lab tests
    const suggestions = await searchLabTests(query, tenantId, limit);

    return NextResponse.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error("[Lab Test Search API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
