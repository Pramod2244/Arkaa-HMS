/**
 * Phase-3: Draft Save API
 * 
 * POST /api/consultation/draft
 * 
 * Auto-saves consultation draft.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { saveConsultationDraft, DraftData } from "@/lib/services/consultation-writes";

export async function POST(request: NextRequest) {
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

    // Parse body
    const body = await request.json();
    const { visitId, ...draft } = body as { visitId: string } & DraftData;

    if (!visitId) {
      return NextResponse.json(
        { success: false, error: "visitId is required" },
        { status: 400 }
      );
    }

    // Save draft (no permission check - if you can see the page, you can save draft)
    const result = await saveConsultationDraft(visitId, draft, tenantId, userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Draft saved",
    });
  } catch (error) {
    console.error("[Consultation Draft API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
