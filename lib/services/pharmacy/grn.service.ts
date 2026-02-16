import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import type { Prisma, GoodsReceiptStatus, PurchaseOrderStatus } from "@/app/generated/prisma/client";
import type { CreateGoodsReceiptInput } from "@/lib/schemas/pharmacy-procurement-schema";

// =====================================================
// TYPES
// =====================================================

interface GRNItemResponse {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  batchNumber: string;
  manufacturingDate: string | null;
  expiryDate: string;
  quantityReceived: number;
  quantityRejected: number;
  unitCost: string;
}

interface GRNListItem {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  poNumber: string;
  storeId: string;
  storeName: string;
  vendorInvoiceNumber: string | null;
  receivedDate: string;
  status: GoodsReceiptStatus;
  itemCount: number;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
}

interface GRNDetail {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  poNumber: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  vendorInvoiceNumber: string | null;
  receivedDate: string;
  status: GoodsReceiptStatus;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  items: GRNItemResponse[];
}

interface CursorResult<T> {
  data: T[];
  pagination: { cursor: string | null; hasMore: boolean };
}

interface GRNQueryOptions {
  search?: string;
  status?: string;
  purchaseOrderId?: string;
  storeId?: string;
  cursor?: string;
  limit?: number;
}

// =====================================================
// GRN NUMBER GENERATOR
// =====================================================

async function generateGRNNumber(
  tenantId: string,
  tx: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `GRN-${year}-`;

  const lastGRN = await tx.goodsReceipt.findFirst({
    where: { tenantId, grnNumber: { startsWith: prefix } },
    orderBy: { grnNumber: "desc" },
    select: { grnNumber: true },
  });

  let seq = 1;
  if (lastGRN) {
    const num = parseInt(lastGRN.grnNumber.replace(prefix, ""), 10);
    if (!isNaN(num)) seq = num + 1;
  }

  return `${prefix}${String(seq).padStart(5, "0")}`;
}

// =====================================================
// CREATE GOODS RECEIPT
// CRITICAL: GRN → GRN Items → InventoryLedger (all in transaction)
// =====================================================

export async function createGoodsReceipt(
  tenantId: string,
  userId: string,
  input: CreateGoodsReceiptInput
): Promise<GRNDetail> {
  return prisma.$transaction(async (tx) => {
    // Validate PO exists and is in acceptable status
    const po = await tx.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, tenantId, isDeleted: false },
      select: { id: true, poNumber: true, status: true, vendorId: true },
    });
    if (!po) throw new AppError("Purchase order not found", 404, "PO_NOT_FOUND");

    const validPOStatuses: PurchaseOrderStatus[] = ["APPROVED", "SENT", "PARTIAL"];
    if (!validPOStatuses.includes(po.status)) {
      throw new AppError(
        `Cannot receive goods for PO in ${po.status} status. PO must be APPROVED, SENT, or PARTIAL.`,
        400,
        "PO_INVALID_STATUS"
      );
    }

    // Validate store exists
    const store = await tx.store.findFirst({
      where: { id: input.storeId, tenantId, isDeleted: false, status: "ACTIVE" },
      select: { id: true, name: true, code: true },
    });
    if (!store) throw new AppError("Store not found or inactive", 404, "STORE_NOT_FOUND");

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

    // Generate GRN Number
    const grnNumber = await generateGRNNumber(tenantId, tx);

    // Determine GRN status
    const hasRejected = input.items.some((i) => (i.quantityRejected ?? 0) > 0);
    const allRejected = input.items.every((i) => (i.quantityRejected ?? 0) >= i.quantityReceived);
    let grnStatus: GoodsReceiptStatus = "RECEIVED";
    if (allRejected) grnStatus = "REJECTED";
    else if (hasRejected) grnStatus = "PARTIAL";

    // Create GRN
    const grn = await tx.goodsReceipt.create({
      data: {
        tenantId,
        grnNumber,
        purchaseOrderId: input.purchaseOrderId,
        storeId: input.storeId,
        vendorInvoiceNumber: input.vendorInvoiceNumber || null,
        receivedDate: new Date(input.receivedDate),
        status: grnStatus,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Create GRN Items
    const grnItemsData = input.items.map((item) => ({
      goodsReceiptId: grn.id,
      productId: item.productId,
      batchNumber: item.batchNumber,
      manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : null,
      expiryDate: new Date(item.expiryDate),
      quantityReceived: item.quantityReceived,
      quantityRejected: item.quantityRejected ?? 0,
      unitCost: item.unitCost,
    }));

    await tx.goodsReceiptItem.createMany({ data: grnItemsData });

    // ===========================================================
    // CRITICAL: Create InventoryLedger entries for accepted items
    // Only items where (quantityReceived - quantityRejected) > 0
    // ===========================================================
    const ledgerEntries: Prisma.InventoryLedgerCreateManyInput[] = [];

    for (const item of input.items) {
      const acceptedQty = item.quantityReceived - (item.quantityRejected ?? 0);
      if (acceptedQty > 0) {
        ledgerEntries.push({
          tenantId,
          storeId: input.storeId,
          productId: item.productId,
          batchNumber: item.batchNumber,
          expiryDate: new Date(item.expiryDate),
          transactionType: "GRN_IN",
          quantityChange: acceptedQty,
          referenceNumber: grnNumber,
          notes: `GRN ${grnNumber} from PO ${po.poNumber}`,
          createdBy: userId,
        });
      }
    }

    if (ledgerEntries.length > 0) {
      await tx.inventoryLedger.createMany({ data: ledgerEntries });
    }

    // ===========================================================
    // Update PO status to PARTIAL or RECEIVED based on totals
    // ===========================================================
    await updatePOStatusAfterGRN(tx, tenantId, input.purchaseOrderId, userId);

    // Fetch full GRN with relations for response
    const fullGRN = await tx.goodsReceipt.findUniqueOrThrow({
      where: { id: grn.id },
      include: {
        purchaseOrder: { select: { poNumber: true } },
        store: { select: { name: true, code: true } },
        items: {
          include: { product: { select: { code: true, name: true } } },
        },
      },
    });

    // Audit
    await createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "GOODS_RECEIPT",
      entityId: grn.id,
      action: "CREATE",
      newValue: {
        grnNumber,
        poNumber: po.poNumber,
        storeId: input.storeId,
        itemCount: input.items.length,
        ledgerEntries: ledgerEntries.length,
      },
    });

    return mapGRNDetail(fullGRN);
  });
}

// =====================================================
// UPDATE PO STATUS AFTER GRN
// =====================================================

async function updatePOStatusAfterGRN(
  tx: Prisma.TransactionClient,
  tenantId: string,
  poId: string,
  userId: string
): Promise<void> {
  // Get all PO items with ordered quantities
  const poItems = await tx.purchaseOrderItem.findMany({
    where: { purchaseOrderId: poId },
    select: { productId: true, quantityOrdered: true },
  });

  // Get all GRN items for this PO
  const grns = await tx.goodsReceipt.findMany({
    where: { purchaseOrderId: poId, tenantId, isDeleted: false },
    select: { id: true },
  });
  const grnIds = grns.map((g) => g.id);

  const grnItems = grnIds.length > 0
    ? await tx.goodsReceiptItem.findMany({
        where: { goodsReceiptId: { in: grnIds } },
        select: { productId: true, quantityReceived: true, quantityRejected: true },
      })
    : [];

  // Sum accepted by product
  const receivedByProduct = new Map<string, number>();
  for (const gi of grnItems) {
    const accepted = gi.quantityReceived - gi.quantityRejected;
    receivedByProduct.set(gi.productId, (receivedByProduct.get(gi.productId) ?? 0) + accepted);
  }

  // Compare
  let allFulfilled = true;
  let anyFulfilled = false;

  for (const poItem of poItems) {
    const received = receivedByProduct.get(poItem.productId) ?? 0;
    if (received >= poItem.quantityOrdered) {
      anyFulfilled = true;
    } else {
      allFulfilled = false;
      if (received > 0) anyFulfilled = true;
    }
  }

  let newStatus: PurchaseOrderStatus;
  if (allFulfilled) {
    newStatus = "RECEIVED";
  } else if (anyFulfilled) {
    newStatus = "PARTIAL";
  } else {
    return; // No change needed
  }

  const currentPO = await tx.purchaseOrder.findUniqueOrThrow({
    where: { id: poId },
    select: { status: true },
  });

  if (currentPO.status !== newStatus) {
    await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: newStatus, updatedBy: userId, version: { increment: 1 } },
    });

    await createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "PURCHASE_ORDER",
      entityId: poId,
      action: "STATUS_CHANGE",
      oldValue: { status: currentPO.status },
      newValue: { status: newStatus, reason: "GRN_RECEIVED" },
    });
  }
}

// =====================================================
// GET GRN LIST (CURSOR PAGINATION)
// =====================================================

export async function getGRNCursor(
  tenantId: string,
  options: GRNQueryOptions = {}
): Promise<CursorResult<GRNListItem>> {
  const { search, status, purchaseOrderId, storeId, cursor, limit = 20 } = options;

  const where: Prisma.GoodsReceiptWhereInput = {
    tenantId,
    isDeleted: false,
  };

  if (status && status !== "ALL") where.status = status as GoodsReceiptStatus;
  if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
  if (storeId) where.storeId = storeId;

  if (search) {
    where.OR = [
      { grnNumber: { contains: search, mode: "insensitive" } },
      { purchaseOrder: { poNumber: { contains: search, mode: "insensitive" } } },
      { vendorInvoiceNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const take = limit + 1;

  const records = await prisma.goodsReceipt.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      grnNumber: true,
      purchaseOrderId: true,
      purchaseOrder: { select: { poNumber: true } },
      storeId: true,
      store: { select: { name: true } },
      vendorInvoiceNumber: true,
      receivedDate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          quantityReceived: true,
          quantityRejected: true,
        },
      },
    },
  });

  const hasMore = records.length > limit;
  const data = hasMore ? records.slice(0, limit) : records;

  return {
    data: data.map((r) => ({
      id: r.id,
      grnNumber: r.grnNumber,
      purchaseOrderId: r.purchaseOrderId,
      poNumber: r.purchaseOrder.poNumber,
      storeId: r.storeId,
      storeName: r.store.name,
      vendorInvoiceNumber: r.vendorInvoiceNumber,
      receivedDate: r.receivedDate.toISOString(),
      status: r.status,
      itemCount: r.items.length,
      totalQuantity: r.items.reduce((sum, i) => sum + i.quantityReceived - i.quantityRejected, 0),
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
// GET GRN BY ID
// =====================================================

export async function getGRNById(
  tenantId: string,
  grnId: string
): Promise<GRNDetail | null> {
  const grn = await prisma.goodsReceipt.findFirst({
    where: { id: grnId, tenantId, isDeleted: false },
    include: {
      purchaseOrder: { select: { poNumber: true } },
      store: { select: { name: true, code: true } },
      items: {
        include: { product: { select: { code: true, name: true } } },
      },
    },
  });

  if (!grn) return null;
  return mapGRNDetail(grn);
}

// =====================================================
// MAPPER
// =====================================================

type GRNWithRelations = NonNullable<Awaited<ReturnType<typeof prisma.goodsReceipt.findFirst<{
  include: {
    purchaseOrder: { select: { poNumber: true } };
    store: { select: { name: true; code: true } };
    items: { include: { product: { select: { code: true; name: true } } } };
  };
}>>>>;

function mapGRNDetail(grn: GRNWithRelations): GRNDetail {
  return {
    id: grn.id,
    grnNumber: grn.grnNumber,
    purchaseOrderId: grn.purchaseOrderId,
    poNumber: grn.purchaseOrder.poNumber,
    storeId: grn.storeId,
    storeName: grn.store.name,
    storeCode: grn.store.code,
    vendorInvoiceNumber: grn.vendorInvoiceNumber,
    receivedDate: grn.receivedDate.toISOString(),
    status: grn.status,
    version: grn.version,
    createdBy: grn.createdBy,
    updatedBy: grn.updatedBy,
    createdAt: grn.createdAt.toISOString(),
    updatedAt: grn.updatedAt.toISOString(),
    items: grn.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productCode: item.product.code,
      productName: item.product.name,
      batchNumber: item.batchNumber,
      manufacturingDate: item.manufacturingDate?.toISOString() ?? null,
      expiryDate: item.expiryDate.toISOString(),
      quantityReceived: item.quantityReceived,
      quantityRejected: item.quantityRejected,
      unitCost: item.unitCost.toString(),
    })),
  };
}
