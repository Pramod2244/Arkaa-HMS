import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

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
    if (!session.permissions.includes("PHARMACY_EXPIRY_VIEW")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const days = searchParams.get("days") || "90";
    const search = searchParams.get("search") || "";
    const limitParam = parseInt(searchParams.get("limit") || "200", 10);

    const now = new Date();
    let dateFilter: Prisma.DateTimeFilter;

    if (days === "expired") {
      // Items already expired
      dateFilter = { lt: now };
    } else {
      // Items expiring within N days (including already expired)
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + parseInt(days, 10));
      dateFilter = { lte: futureDate };
    }

    const where: Prisma.GoodsReceiptItemWhereInput = {
      expiryDate: dateFilter,
      goodsReceipt: {
        tenantId: session.tenantId,
        isDeleted: false,
      },
    };

    if (search) {
      where.OR = [
        { batchNumber: { contains: search, mode: "insensitive" } },
        { product: { name: { contains: search, mode: "insensitive" } } },
        { product: { code: { contains: search, mode: "insensitive" } } },
      ];
    }

    const items = await prisma.goodsReceiptItem.findMany({
      where,
      take: limitParam,
      orderBy: { expiryDate: "asc" }, // Most urgent first
      select: {
        id: true,
        productId: true,
        batchNumber: true,
        expiryDate: true,
        quantityReceived: true,
        quantityRejected: true,
        product: { select: { code: true, name: true } },
        goodsReceipt: {
          select: {
            grnNumber: true,
            store: { select: { name: true } },
          },
        },
      },
    });

    const data = items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productCode: item.product.code,
      productName: item.product.name,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate.toISOString(),
      quantityReceived: item.quantityReceived,
      quantityRejected: item.quantityRejected,
      grnNumber: item.goodsReceipt.grnNumber,
      storeName: item.goodsReceipt.store.name,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/pharmacy/expiry error:", error);
    return NextResponse.json(
      { success: false, errorCode: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "An error occurred" },
      { status: 500 }
    );
  }
}
