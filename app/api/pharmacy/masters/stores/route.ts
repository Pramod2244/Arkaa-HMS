import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createStore, getStores, getStoreById, updateStore, deleteStore, deactivateStore } from "@/lib/services/pharmacy/store-service";
import { StoreCreateSchema, StoreUpdateSchema, StoreQuerySchema } from "@/lib/schemas/pharmacy-schema";
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

    // Check permission
    if (!session.permissions.includes("PHARMACY_STORE_VIEW")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // Get single store
    if (id) {
      const store = await getStoreById(session.tenantId, id);
      return NextResponse.json({
        success: true,
        data: store,
      });
    }

    // Query parameters
    const queryData = {
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || "ALL",
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
      cursor: searchParams.get("cursor") || undefined,
    };

    // Validate query
    const validatedQuery = StoreQuerySchema.parse(queryData);

    const result = await getStores(session.tenantId, {
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
    console.error("GET /api/pharmacy/masters/stores error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errorCode: "VALIDATION_ERROR", message: error.issues.map(i => i.message).join(", ") },
        { status: 400 }
      );
    }
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

    // Check permission
    if (!session.permissions.includes("PHARMACY_STORE_CREATE")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = StoreCreateSchema.parse(body);

    const store = await createStore(session.tenantId, session.userId, validatedData);

    return NextResponse.json(
      {
        success: true,
        data: store,
        message: "Store created successfully",
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

    // Check permission
    if (!session.permissions.includes("PHARMACY_STORE_EDIT")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, errorCode: "BAD_REQUEST", message: "Store ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = StoreUpdateSchema.parse(body);

    const store = await updateStore(session.tenantId, session.userId, id, validatedData);

    return NextResponse.json({
      success: true,
      data: store,
      message: "Store updated successfully",
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

    // Check permission
    if (!session.permissions.includes("PHARMACY_STORE_DELETE")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action");

    if (!id) {
      return NextResponse.json(
        { success: false, errorCode: "BAD_REQUEST", message: "Store ID required" },
        { status: 400 }
      );
    }

    if (action === "deactivate") {
      await deactivateStore(session.tenantId, session.userId, id);
      return NextResponse.json({
        success: true,
        message: "Store deactivated successfully",
      });
    } else {
      await deleteStore(session.tenantId, session.userId, id);
      return NextResponse.json({
        success: true,
        message: "Store deleted successfully",
      });
    }
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
