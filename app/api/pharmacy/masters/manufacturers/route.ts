import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  createManufacturer,
  getManufacturers,
  getManufacturerById,
  updateManufacturer,
  deleteManufacturer,
} from "@/lib/services/pharmacy/manufacturer-service";
import {
  ManufacturerCreateSchema,
  ManufacturerUpdateSchema,
  ManufacturerQuerySchema,
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

    if (!session.permissions.includes("PHARMACY_MANUFACTURER_VIEW")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const manufacturer = await getManufacturerById(session.tenantId, id);
      return NextResponse.json({
        success: true,
        data: manufacturer,
      });
    }

    const queryData = {
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || "ALL",
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
      cursor: searchParams.get("cursor") || undefined,
    };

    const validatedQuery = ManufacturerQuerySchema.parse(queryData);

    const result = await getManufacturers(session.tenantId, {
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

    if (!session.permissions.includes("PHARMACY_MANUFACTURER_CREATE")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = ManufacturerCreateSchema.parse(body);

    const manufacturer = await createManufacturer(
      session.tenantId,
      session.userId,
      validatedData
    );

    return NextResponse.json(
      {
        success: true,
        data: manufacturer,
        message: "Manufacturer created successfully",
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

    if (!session.permissions.includes("PHARMACY_MANUFACTURER_EDIT")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, errorCode: "BAD_REQUEST", message: "Manufacturer ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = ManufacturerUpdateSchema.parse(body);

    const manufacturer = await updateManufacturer(
      session.tenantId,
      session.userId,
      id,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: manufacturer,
      message: "Manufacturer updated successfully",
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

    if (!session.permissions.includes("PHARMACY_MANUFACTURER_DELETE")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, errorCode: "BAD_REQUEST", message: "Manufacturer ID required" },
        { status: 400 }
      );
    }

    await deleteManufacturer(session.tenantId, session.userId, id);

    return NextResponse.json({
      success: true,
      message: "Manufacturer deleted successfully",
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
