import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { AppError } from "@/lib/rbac";
import {
  createIPSale,
  getIPSalesCursor,
} from "@/lib/services/pharmacy/ip-sale.service";
import {
  CreateIPSaleSchema,
  IPSaleQuerySchema,
} from "@/lib/schemas/pharmacy-dispensing-schema";

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
    if (!session.permissions.includes("PHARMACY_SALE_VIEW")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryData = {
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || "ALL",
      storeId: searchParams.get("storeId") || undefined,
      patientId: searchParams.get("patientId") || undefined,
      admissionId: searchParams.get("admissionId") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
      cursor: searchParams.get("cursor") || undefined,
    };

    const validatedQuery = IPSaleQuerySchema.parse(queryData);

    const result = await getIPSalesCursor(session.tenantId, {
      search: validatedQuery.search,
      status: validatedQuery.status === "ALL" ? undefined : validatedQuery.status,
      storeId: validatedQuery.storeId,
      patientId: validatedQuery.patientId,
      admissionId: validatedQuery.admissionId,
      limit: validatedQuery.limit,
      cursor: validatedQuery.cursor,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("GET /api/pharmacy/ip-sales error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errorCode: "VALIDATION_ERROR", message: error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, errorCode: error.errorCode, message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, errorCode: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "An error occurred" },
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
    if (!session.permissions.includes("PHARMACY_IP_SALE_CREATE")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = CreateIPSaleSchema.parse(body);

    const sale = await createIPSale(session.tenantId, session.userId, {
      patientId: validatedData.patientId,
      storeId: validatedData.storeId,
      admissionId: validatedData.admissionId || undefined,
      visitId: validatedData.visitId || undefined,
      invoiceId: validatedData.invoiceId || undefined,
      prescriptionId: validatedData.prescriptionId || undefined,
      notes: validatedData.notes || undefined,
      items: validatedData.items,
    });

    return NextResponse.json(
      { success: true, data: sale, message: "IP sale created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/pharmacy/ip-sales error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errorCode: "VALIDATION_ERROR", message: error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, errorCode: error.errorCode, message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, errorCode: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "An error occurred" },
      { status: 500 }
    );
  }
}
