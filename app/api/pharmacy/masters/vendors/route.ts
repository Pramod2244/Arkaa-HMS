import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
} from "@/lib/services/pharmacy/vendor-service";
import { VendorCreateSchema, VendorUpdateSchema, VendorQuerySchema } from "@/lib/schemas/pharmacy-schema";
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

    if (!session.permissions.includes("PHARMACY_VENDOR_VIEW")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const vendor = await getVendorById(session.tenantId, id);
      return NextResponse.json({
        success: true,
        data: vendor,
      });
    }

    const queryData = {
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || "ALL",
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
      cursor: searchParams.get("cursor") || undefined,
    };

    const validatedQuery = VendorQuerySchema.parse(queryData);

    const result = await getVendors(session.tenantId, {
      search: validatedQuery.search,
      status: validatedQuery.status === "ALL" ? undefined : validatedQuery.status,
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

    if (!session.permissions.includes("PHARMACY_VENDOR_CREATE")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = VendorCreateSchema.parse(body);

    const vendor = await createVendor(session.tenantId, session.userId, validatedData);

    return NextResponse.json(
      {
        success: true,
        data: vendor,
        message: "Vendor created successfully",
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

export async function PUT(request: NextRequest) {
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

    if (!session.permissions.includes("PHARMACY_VENDOR_EDIT")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, errorCode: "BAD_REQUEST", message: "Vendor ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = VendorUpdateSchema.parse(body);

    const vendor = await updateVendor(session.tenantId, session.userId, id, validatedData);

    return NextResponse.json({
      success: true,
      data: vendor,
      message: "Vendor updated successfully",
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

export async function DELETE(request: NextRequest) {
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

    if (!session.permissions.includes("PHARMACY_VENDOR_DELETE")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, errorCode: "BAD_REQUEST", message: "Vendor ID required" },
        { status: 400 }
      );
    }

    await deleteVendor(session.tenantId, session.userId, id);

    return NextResponse.json({
      success: true,
      message: "Vendor deleted successfully",
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
