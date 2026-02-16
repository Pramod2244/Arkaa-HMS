import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import type { Prisma, PurchaseOrderStatus } from "@/app/generated/prisma/client";
import type {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
} from "@/lib/schemas/pharmacy-procurement-schema";

// =====================================================
// TYPES
// =====================================================

interface POItemResponse {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  genericName: string;
  quantityOrdered: number;
  unitCost: string;
  tax: string;
  total: string;
}

interface POListItem {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  orderDate: string;
  expectedDate: string | null;
  status: PurchaseOrderStatus;
  subtotal: string;
  tax: string;
  total: string;
  itemCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface PODetail {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  vendorGst: string | null;
  orderDate: string;
  expectedDate: string | null;
  status: PurchaseOrderStatus;
  subtotal: string;
  tax: string;
  total: string;
  notes: string | null;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  items: POItemResponse[];
}

interface CursorResult<T> {
  data: T[];
  pagination: { cursor: string | null; hasMore: boolean };
}

interface POQueryOptions {
  search?: string;
  status?: string;
  vendorId?: string;
  cursor?: string;
  limit?: number;
}

// =====================================================
// PO NUMBER GENERATOR
// =====================================================

async function generatePONumber(
  tenantId: string,
  tx: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;

  const lastPO = await tx.purchaseOrder.findFirst({
    where: { tenantId, poNumber: { startsWith: prefix } },
    orderBy: { poNumber: "desc" },
    select: { poNumber: true },
  });

  let seq = 1;
  if (lastPO) {
    const num = parseInt(lastPO.poNumber.replace(prefix, ""), 10);
    if (!isNaN(num)) seq = num + 1;
  }

  return `${prefix}${String(seq).padStart(5, "0")}`;
}

// =====================================================
// CREATE PURCHASE ORDER
// =====================================================

export async function createPurchaseOrder(
  tenantId: string,
  userId: string,
  input: CreatePurchaseOrderInput
): Promise<PODetail> {
  return prisma.$transaction(async (tx) => {
    // Validate vendor
    const vendor = await tx.vendor.findFirst({
      where: { id: input.vendorId, tenantId, isDeleted: false, status: "ACTIVE" },
      select: { id: true, name: true },
    });
    if (!vendor) throw new AppError("Vendor not found or inactive", 404, "VENDOR_NOT_FOUND");

    // Validate all products exist
    const productIds = input.items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, tenantId, isDeleted: false },
      select: { id: true },
    });
    const foundIds = new Set(products.map((p) => p.id));
    for (const pid of productIds) {
      if (!foundIds.has(pid)) {
        throw new AppError(`Product ${pid} not found`, 404, "PRODUCT_NOT_FOUND");
      }
    }

    const poNumber = await generatePONumber(tenantId, tx);

    // Calculate totals
    let subtotalAcc = 0;
    let taxAcc = 0;

    const itemsData = input.items.map((item) => {
      const lineSubtotal = item.unitCost * item.quantityOrdered;
      const lineTax = item.tax ?? 0;
      subtotalAcc += lineSubtotal;
      taxAcc += lineTax;

      return {
        productId: item.productId,
        quantityOrdered: item.quantityOrdered,
        unitCost: item.unitCost,
        tax: lineTax,
        total: lineSubtotal + lineTax,
      };
    });

    const grandTotal = subtotalAcc + taxAcc;

    const po = await tx.purchaseOrder.create({
      data: {
        tenantId,
        poNumber,
        vendorId: input.vendorId,
        orderDate: new Date(input.orderDate),
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
        status: "DRAFT",
        subtotal: subtotalAcc,
        tax: taxAcc,
        total: grandTotal,
        notes: input.notes || null,
        createdBy: userId,
        updatedBy: userId,
        items: { create: itemsData },
      },
      include: {
        vendor: { select: { id: true, name: true, code: true, gstNumber: true } },
        items: {
          include: {
            product: { select: { id: true, code: true, name: true, genericName: true } },
          },
        },
      },
    });

    await createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "PURCHASE_ORDER",
      entityId: po.id,
      action: "CREATE",
      newValue: { poNumber, vendorId: input.vendorId, total: grandTotal, itemCount: itemsData.length },
    });

    return mapPODetail(po);
  });
}

// =====================================================
// UPDATE PURCHASE ORDER (DRAFT ONLY)
// =====================================================

export async function updatePurchaseOrder(
  tenantId: string,
  userId: string,
  poId: string,
  input: UpdatePurchaseOrderInput
): Promise<PODetail> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.purchaseOrder.findFirst({
      where: { id: poId, tenantId, isDeleted: false },
      select: { id: true, status: true, version: true },
    });
    if (!existing) throw new AppError("Purchase order not found", 404, "PO_NOT_FOUND");
    if (existing.status !== "DRAFT") throw new AppError("Only DRAFT orders can be edited", 400, "PO_NOT_DRAFT");
    if (existing.version !== input.version) throw new AppError("Record modified by another user. Refresh and try again.", 409, "VERSION_CONFLICT");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, unknown> = {
      updatedBy: userId,
      version: { increment: 1 },
    };

    if (input.vendorId) {
      const vendor = await tx.vendor.findFirst({
        where: { id: input.vendorId, tenantId, isDeleted: false, status: "ACTIVE" },
        select: { id: true },
      });
      if (!vendor) throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
      updateData.vendorId = input.vendorId;
    }

    if (input.orderDate) updateData.orderDate = new Date(input.orderDate);
    if (input.expectedDate !== undefined) {
      updateData.expectedDate = input.expectedDate ? new Date(input.expectedDate) : null;
    }
    if (input.notes !== undefined) updateData.notes = input.notes || null;

    // Replace items if provided
    if (input.items && input.items.length > 0) {
      const productIds = input.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, tenantId, isDeleted: false },
        select: { id: true },
      });
      const foundIds = new Set(products.map((p) => p.id));
      for (const pid of productIds) {
        if (!foundIds.has(pid)) throw new AppError(`Product ${pid} not found`, 404, "PRODUCT_NOT_FOUND");
      }

      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: poId } });

      let subtotalAcc = 0;
      let taxAcc = 0;
      const newItems = input.items.map((item) => {
        const lineSub = item.unitCost * item.quantityOrdered;
        const lineTax = item.tax ?? 0;
        subtotalAcc += lineSub;
        taxAcc += lineTax;
        return {
          purchaseOrderId: poId,
          productId: item.productId,
          quantityOrdered: item.quantityOrdered,
          unitCost: item.unitCost,
          tax: lineTax,
          total: lineSub + lineTax,
        };
      });

      await tx.purchaseOrderItem.createMany({ data: newItems });
      updateData.subtotal = subtotalAcc;
      updateData.tax = taxAcc;
      updateData.total = subtotalAcc + taxAcc;
    }

    const po = await tx.purchaseOrder.update({
      where: { id: poId },
      data: updateData as Prisma.PurchaseOrderUpdateInput,
      include: {
        vendor: { select: { id: true, name: true, code: true, gstNumber: true } },
        items: {
          include: { product: { select: { id: true, code: true, name: true, genericName: true } } },
        },
      },
    });

    await createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "PURCHASE_ORDER",
      entityId: po.id,
      action: "UPDATE",
      newValue: { version: po.version },
    });

    return mapPODetail(po);
  });
}

// =====================================================
// APPROVE PURCHASE ORDER
// =====================================================

export async function approvePurchaseOrder(
  tenantId: string,
  userId: string,
  poId: string,
  version: number
): Promise<{ id: string; status: PurchaseOrderStatus }> {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, tenantId, isDeleted: false },
      select: { id: true, status: true, version: true },
    });
    if (!po) throw new AppError("Purchase order not found", 404, "PO_NOT_FOUND");
    if (po.status !== "DRAFT") throw new AppError("Only DRAFT orders can be approved", 400, "PO_NOT_DRAFT");
    if (po.version !== version) throw new AppError("Record modified by another user", 409, "VERSION_CONFLICT");

    const updated = await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: "APPROVED", updatedBy: userId, version: { increment: 1 } },
      select: { id: true, status: true },
    });

    await createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "PURCHASE_ORDER",
      entityId: poId,
      action: "STATUS_CHANGE",
      oldValue: { status: "DRAFT" },
      newValue: { status: "APPROVED" },
    });

    return updated;
  });
}

// =====================================================
// CANCEL PURCHASE ORDER
// =====================================================

export async function cancelPurchaseOrder(
  tenantId: string,
  userId: string,
  poId: string,
  version: number
): Promise<{ id: string; status: PurchaseOrderStatus }> {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, tenantId, isDeleted: false },
      select: { id: true, status: true, version: true },
    });
    if (!po) throw new AppError("Purchase order not found", 404, "PO_NOT_FOUND");
    if (po.status === "RECEIVED" || po.status === "CANCELLED") {
      throw new AppError(`Cannot cancel a ${po.status} order`, 400, "PO_INVALID_STATUS");
    }
    if (po.version !== version) throw new AppError("Record modified by another user", 409, "VERSION_CONFLICT");

    const grnCount = await tx.goodsReceipt.count({
      where: { purchaseOrderId: poId, isDeleted: false },
    });
    if (grnCount > 0) throw new AppError("Cannot cancel PO with existing goods receipts", 400, "PO_HAS_GRN");

    const updated = await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: "CANCELLED", updatedBy: userId, version: { increment: 1 } },
      select: { id: true, status: true },
    });

    await createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "PURCHASE_ORDER",
      entityId: poId,
      action: "STATUS_CHANGE",
      oldValue: { status: po.status },
      newValue: { status: "CANCELLED" },
    });

    return updated;
  });
}

// =====================================================
// SOFT DELETE
// =====================================================

export async function softDeletePurchaseOrder(
  tenantId: string,
  userId: string,
  poId: string,
  version: number
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, tenantId, isDeleted: false },
      select: { id: true, status: true, version: true },
    });
    if (!po) throw new AppError("Purchase order not found", 404, "PO_NOT_FOUND");
    if (po.status !== "DRAFT" && po.status !== "CANCELLED") {
      throw new AppError("Only DRAFT or CANCELLED orders can be deleted", 400, "PO_INVALID_STATUS");
    }
    if (po.version !== version) throw new AppError("Record modified by another user", 409, "VERSION_CONFLICT");

    await tx.purchaseOrder.update({
      where: { id: poId },
      data: { isDeleted: true, updatedBy: userId, version: { increment: 1 } },
    });

    await createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "PURCHASE_ORDER",
      entityId: poId,
      action: "DELETE",
      oldValue: { status: po.status },
    });

    return { id: poId };
  });
}

// =====================================================
// GET PURCHASE ORDERS (CURSOR PAGINATION)
// =====================================================

export async function getPurchaseOrdersCursor(
  tenantId: string,
  options: POQueryOptions = {}
): Promise<CursorResult<POListItem>> {
  const { search, status, vendorId, cursor, limit = 20 } = options;

  const where: Prisma.PurchaseOrderWhereInput = {
    tenantId,
    isDeleted: false,
  };

  if (status && status !== "ALL") where.status = status as PurchaseOrderStatus;
  if (vendorId) where.vendorId = vendorId;

  if (search) {
    where.OR = [
      { poNumber: { contains: search, mode: "insensitive" } },
      { vendor: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const take = limit + 1;

  const records = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      poNumber: true,
      vendorId: true,
      vendor: { select: { name: true, code: true } },
      orderDate: true,
      expectedDate: true,
      status: true,
      subtotal: true,
      tax: true,
      total: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { items: true } },
    },
  });

  const hasMore = records.length > limit;
  const data = hasMore ? records.slice(0, limit) : records;

  return {
    data: data.map((r) => ({
      id: r.id,
      poNumber: r.poNumber,
      vendorId: r.vendorId,
      vendorName: r.vendor.name,
      vendorCode: r.vendor.code,
      orderDate: r.orderDate.toISOString(),
      expectedDate: r.expectedDate?.toISOString() ?? null,
      status: r.status,
      subtotal: r.subtotal.toString(),
      tax: r.tax.toString(),
      total: r.total.toString(),
      itemCount: r._count.items,
      version: r.version,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    pagination: {
      cursor: data.length > 0 ? data[data.length - 1].id : null,
      hasMore,
    },
  };
}

// =====================================================
// GET PURCHASE ORDER BY ID
// =====================================================

export async function getPurchaseOrderById(
  tenantId: string,
  poId: string
): Promise<PODetail | null> {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, tenantId, isDeleted: false },
    include: {
      vendor: { select: { id: true, name: true, code: true, gstNumber: true } },
      items: {
        include: {
          product: { select: { id: true, code: true, name: true, genericName: true } },
        },
      },
    },
  });

  if (!po) return null;
  return mapPODetail(po);
}

// =====================================================
// MAPPER
// =====================================================

type POWithRelations = Awaited<ReturnType<typeof prisma.purchaseOrder.findFirst<{
  include: {
    vendor: { select: { id: true; name: true; code: true; gstNumber: true } };
    items: { include: { product: { select: { id: true; code: true; name: true; genericName: true } } } };
  };
}>>>;

function mapPODetail(po: NonNullable<POWithRelations>): PODetail {
  return {
    id: po.id,
    poNumber: po.poNumber,
    vendorId: po.vendorId,
    vendorName: po.vendor.name,
    vendorCode: po.vendor.code,
    vendorGst: po.vendor.gstNumber,
    orderDate: po.orderDate.toISOString(),
    expectedDate: po.expectedDate?.toISOString() ?? null,
    status: po.status,
    subtotal: po.subtotal.toString(),
    tax: po.tax.toString(),
    total: po.total.toString(),
    notes: po.notes,
    version: po.version,
    createdBy: po.createdBy,
    updatedBy: po.updatedBy,
    createdAt: po.createdAt.toISOString(),
    updatedAt: po.updatedAt.toISOString(),
    items: po.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productCode: item.product.code,
      productName: item.product.name,
      genericName: item.product.genericName,
      quantityOrdered: item.quantityOrdered,
      unitCost: item.unitCost.toString(),
      tax: item.tax.toString(),
      total: item.total.toString(),
    })),
  };
}
