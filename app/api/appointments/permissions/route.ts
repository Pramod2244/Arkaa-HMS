import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const permission = searchParams.get("permission");

    if (!permission) {
      return NextResponse.json(
        { success: false, message: "Missing permission parameter" },
        { status: 400 }
      );
    }

    const allowed = session.permissions?.includes(permission) || false;

    return NextResponse.json({
      success: true,
      data: {
        permission,
        allowed,
      },
    });
  } catch (error) {
    console.error("GET /api/appointments/permissions error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
