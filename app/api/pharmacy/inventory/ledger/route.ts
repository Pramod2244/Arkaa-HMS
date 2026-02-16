import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  createInventoryLedgerEntry,
  getInventoryLedger,
} from "@/lib/services/pharmacy/inventory-service";
import {
  InventoryLedgerCreateSchema,
  InventoryLedgerQuerySchema,
} from "@/lib/schemas/pharmacy-schema";
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

    const queryData = {
      storeId: searchParams.get("storeId") || undefined,
      productId: searchParams.get("productId") || undefined,
      batchNumber: searchParams.get("batchNumber") || undefined,
      transactionType: searchParams.get("transactionType") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
      cursor: searchParams.get("cursor") || undefined,
    };

    const validatedQuery = InventoryLedgerQuerySchema.parse(queryData);

    const result = await getInventoryLedger(session.tenantId, {
      storeId: validatedQuery.storeId,
      productId: validatedQuery.productId,
      batchNumber: validatedQuery.batchNumber,
      transactionType: validatedQuery.transactionType,
      limit: validatedQuery.limit,
      cursor: validatedQuery.cursor,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
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

export async function POST(request: NextRequest) {
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

    if (!session.permissions.includes("PHARMACY_INVENTORY_EDIT")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = InventoryLedgerCreateSchema.parse(body);

    const entry = await createInventoryLedgerEntry(
      session.tenantId,
      session.userId,
      validatedData
    );

    return NextResponse.json(
      {
        success: true,
        data: entry,
        message: "Inventory entry created successfully",
      },
      { status: 201 }
    );
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          errorCode: "VALIDATION_ERROR",
          message: "Invalid request data",
          errors: error.issues,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, errorCode: "INTERNAL_ERROR", message: "An error occurred" },
      { status: 500 }
    );
  }
}
