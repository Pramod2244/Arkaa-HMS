import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "@/lib/services/pharmacy/product-service";
import { ProductCreateSchema, ProductUpdateSchema, ProductQuerySchema } from "@/lib/schemas/pharmacy-schema";
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

    if (!session.permissions.includes("PHARMACY_PRODUCT_VIEW")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const product = await getProductById(session.tenantId, id);
      return NextResponse.json({
        success: true,
        data: product,
      });
    }

    const queryData = {
      search: searchParams.get("search") || undefined,
      scheduleType: searchParams.get("scheduleType") || undefined,
      manufacturerId: searchParams.get("manufacturerId") || undefined,
      status: searchParams.get("status") || "ALL",
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
      cursor: searchParams.get("cursor") || undefined,
    };

    const validatedQuery = ProductQuerySchema.parse(queryData);

    const result = await getProducts(session.tenantId, {
      search: validatedQuery.search,
      scheduleType: validatedQuery.scheduleType,
      manufacturerId: validatedQuery.manufacturerId,
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

    if (!session.permissions.includes("PHARMACY_PRODUCT_CREATE")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = ProductCreateSchema.parse(body);

    const product = await createProduct(session.tenantId, session.userId, validatedData);

    return NextResponse.json(
      {
        success: true,
        data: product,
        message: "Product created successfully",
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

    if (!session.permissions.includes("PHARMACY_PRODUCT_EDIT")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, errorCode: "BAD_REQUEST", message: "Product ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = ProductUpdateSchema.parse(body);

    const product = await updateProduct(session.tenantId, session.userId, id, validatedData);

    return NextResponse.json({
      success: true,
      data: product,
      message: "Product updated successfully",
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

    if (!session.permissions.includes("PHARMACY_PRODUCT_DELETE")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, errorCode: "BAD_REQUEST", message: "Product ID required" },
        { status: 400 }
      );
    }

    await deleteProduct(session.tenantId, session.userId, id);

    return NextResponse.json({
      success: true,
      message: "Product deleted successfully",
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
