import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getStockByStore,
  getAllStockSnapshot,
} from "@/lib/services/pharmacy/inventory-service";
import { StockQuerySchema } from "@/lib/schemas/pharmacy-schema";
import { AppError } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, errorCode: "UNAUTHORIZED", message: "Not authenticated" },
        { status: 401 }
      );
    }

    if (!session.tenantId) {
      return NextResponse.json(
        { success: false, errorCode: "BAD_REQUEST", message: "Tenant context required" },
        { status: 400 }
      );
    }

    if (!session.permissions.includes("PHARMACY_INVENTORY_VIEW")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId");

    const validatedQuery = StockQuerySchema.parse({
      storeId: storeId || undefined,
    });

    let data;

    if (validatedQuery.storeId) {
      data = await getStockByStore(session.tenantId, validatedQuery.storeId);
    } else {
      data = await getAllStockSnapshot(session.tenantId);
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          errorCode: error.errorCode,
          message: error.message,
        },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, errorCode: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}
