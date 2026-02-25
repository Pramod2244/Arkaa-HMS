import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import type { Prisma } from "@/app/generated/prisma/client";
import { 
  decodeCursor, 
  encodeCursor, 
  sanitizeLimit, 
  DEFAULT_LIMIT 
} from "@/lib/utils/pagination";

export interface InventoryLedgerCreateInput {
  storeId: string;
  productId: string;
  batchNumber: string;
  expiryDate?: string;
  transactionType: "OPENING" | "ADJUSTMENT";
  quantityChange: number;
  referenceNumber?: string;
  notes?: string;
}

export interface InventoryLedgerQueryOptions {
  storeId?: string;
  productId?: string;
  batchNumber?: string;
  transactionType?: string;
  cursor?: string;
  limit?: number;
}

// ============== CREATE INVENTORY LEDGER ENTRY ==============

export async function createInventoryLedgerEntry(
  tenantId: string,
  userId: string,
  input: InventoryLedgerCreateInput
): Promise<any> {
  // Verify store exists
  const store = await prisma.store.findFirst({
    where: { id: input.storeId, tenantId, isDeleted: false },
  });

  if (!store) {
    throw new AppError("Store not found", 404, "STORE_NOT_FOUND");
  }

  // Verify product exists
  const product = await prisma.product.findFirst({
    where: { id: input.productId, tenantId, isDeleted: false },
  });

  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  // Prevent negative stock during transaction
  if (input.quantityChange < 0) {
    // Check current balance before allowing negative
    const currentStock = await getStockByStoreProductBatch(
      tenantId,
      input.storeId,
      input.productId,
      input.batchNumber
    );

    if (currentStock.quantity + input.quantityChange < 0) {
      throw new AppError(
        "Insufficient stock for this transaction",
        400,
        "NEGATIVE_STOCK"
      );
    }
  }

  const ledgerEntry = await prisma.inventoryLedger.create({
    data: {
      tenantId,
      storeId: input.storeId,
      productId: input.productId,
      batchNumber: input.batchNumber,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      transactionType: input.transactionType,
      quantityChange: input.quantityChange,
      referenceNumber: input.referenceNumber || null,
      notes: input.notes || null,
      createdBy: userId,
    },
  });

  // Audit log
  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "INVENTORY_LEDGER",
    entityId: ledgerEntry.id,
    action: "CREATE",
    newValue: {
      storeId: input.storeId,
      productId: input.productId,
      batchNumber: input.batchNumber,
      quantityChange: input.quantityChange,
      transactionType: input.transactionType,
    },
  });

  return ledgerEntry;
}

// ============== GET INVENTORY LEDGER (CURSOR PAGINATION) ==============

export async function getInventoryLedger(
  tenantId: string,
  options: InventoryLedgerQueryOptions = {}
): Promise<{ data: any[]; pagination: { cursor: string | null; hasMore: boolean } }> {
  const { storeId, productId, batchNumber, transactionType, cursor, limit: rawLimit = DEFAULT_LIMIT } = options;
  const limit = sanitizeLimit(rawLimit);

  const where: Prisma.InventoryLedgerWhereInput = {
    tenantId,
  };

  if (storeId) where.storeId = storeId;
  if (productId) where.productId = productId;
  if (batchNumber) where.batchNumber = batchNumber;
  if (transactionType) where.transactionType = transactionType as any;

  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor?.id && decodedCursor?.createdAt) {
    const cursorCondition = {
      OR: [
        { createdAt: { lt: decodedCursor.createdAt } },
        {
          AND: [
            { createdAt: decodedCursor.createdAt },
            { id: { lt: decodedCursor.id } },
          ],
        },
      ],
    };
    where.AND = [cursorCondition];
  }

  const ledgers = await prisma.inventoryLedger.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      storeId: true,
      productId: true,
      batchNumber: true,
      expiryDate: true,
      transactionType: true,
      quantityChange: true,
      referenceNumber: true,
      createdAt: true,
      createdBy: true,
      store: { select: { name: true } },
      product: { select: { code: true, name: true } },
    },
  });

  const hasMore = ledgers.length > limit;
  const data = hasMore ? ledgers.slice(0, limit) : ledgers;
  const nextCursor =
    hasMore && data.length > 0
      ? encodeCursor({ 
          id: data[data.length - 1].id, 
          createdAt: data[data.length - 1].createdAt 
        })
      : null;

  return {
    data,
    pagination: { cursor: nextCursor, hasMore },
  };
}

// ============== STOCK READ MODEL - GET STOCK BY STORE ==============

export interface StockRecord {
  storeId: string;
  storeName: string;
  productId: string;
  productCode: string;
  productName: string;
  genericName: string;
  batchNumber: string;
  expiryDate: Date | undefined;
  availableQty: number;
  mrp: Prisma.Decimal | undefined;
  purchasePrice: Prisma.Decimal | undefined;
}

export async function getStockByStore(
  tenantId: string,
  storeId: string
): Promise<StockRecord[]> {
  const result = await prisma.inventoryLedger.groupBy({
    by: ["storeId", "productId", "batchNumber", "expiryDate"],
    where: {
      tenantId,
      storeId,
    },
    _sum: {
      quantityChange: true,
    },
  });

  if (result.length === 0) {
    return [];
  }

  // Get store and product details
  const productIds = [...new Set(result.map((r) => r.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      code: true,
      name: true,
      genericName: true,
      mrp: true,
      purchasePrice: true,
    },
  });

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true },
  });

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  return result
    .map((row) => {
      const product = productMap[row.productId];
      if (!product) return null;

      return {
        storeId: row.storeId,
        storeName: store?.name || "Unknown",
        productId: row.productId,
        productCode: product.code,
        productName: product.name,
        genericName: product.genericName,
        batchNumber: row.batchNumber,
        expiryDate: row.expiryDate || undefined,
        availableQty: row._sum.quantityChange || 0,
        mrp: product.mrp || undefined,
        purchasePrice: product.purchasePrice || undefined,
      };
    })
    .filter((stock): stock is StockRecord => stock !== null);
}

// ============== STOCK BY STORE & PRODUCT ==============

export async function getStockByStoreProduct(
  tenantId: string,
  storeId: string,
  productId: string
): Promise<any> {
  const ledgers = await prisma.inventoryLedger.findMany({
    where: {
      tenantId,
      storeId,
      productId,
    },
    select: {
      batchNumber: true,
      expiryDate: true,
      quantityChange: true,
    },
  });

  // Group by batch and expiry
  const stockByBatch: Record<
    string,
    { batchNumber: string; expiryDate?: Date; quantity: number }
  > = {};

  for (const ledger of ledgers) {
    const key = `${ledger.batchNumber}|${ledger.expiryDate?.toISOString() || ""}`;
    if (!stockByBatch[key]) {
      stockByBatch[key] = {
        batchNumber: ledger.batchNumber,
        expiryDate: ledger.expiryDate || undefined,
        quantity: 0,
      };
    }
    stockByBatch[key].quantity += ledger.quantityChange;
  }

  return Object.values(stockByBatch);
}

// ============== STOCK BY STORE, PRODUCT & BATCH ==============

export interface StockBalance {
  productId: string;
  storeId: string;
  batchNumber: string;
  quantity: number;
}

export async function getStockByStoreProductBatch(
  tenantId: string,
  storeId: string,
  productId: string,
  batchNumber: string
): Promise<StockBalance> {
  const result = await prisma.inventoryLedger.aggregate({
    where: {
      tenantId,
      storeId,
      productId,
      batchNumber,
    },
    _sum: {
      quantityChange: true,
    },
  });

  return {
    productId,
    storeId,
    batchNumber,
    quantity: result._sum.quantityChange || 0,
  };
}

// ============== GET ALL STOCK SNAPSHOT ==============

export async function getAllStockSnapshot(tenantId: string): Promise<StockRecord[]> {
  const ledgers = await prisma.inventoryLedger.groupBy({
    by: ["storeId", "productId", "batchNumber", "expiryDate"],
    where: { tenantId },
    _sum: {
      quantityChange: true,
    },
  });

  if (ledgers.length === 0) {
    return [];
  }

  const productIds = [...new Set(ledgers.map((l) => l.productId))];
  const storeIds = [...new Set(ledgers.map((l) => l.storeId))];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      code: true,
      name: true,
      genericName: true,
      mrp: true,
      purchasePrice: true,
    },
  });

  const stores = await prisma.store.findMany({
    where: { id: { in: storeIds } },
    select: { id: true, name: true },
  });

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
  const storeMap = Object.fromEntries(stores.map((s) => [s.id, s]));

  return ledgers
    .map((row) => {
      const product = productMap[row.productId];
      const store = storeMap[row.storeId];
      if (!product || !store) return null;

      return {
        storeId: row.storeId,
        storeName: store.name,
        productId: row.productId,
        productCode: product.code,
        productName: product.name,
        genericName: product.genericName,
        batchNumber: row.batchNumber,
        expiryDate: row.expiryDate || undefined,
        availableQty: row._sum.quantityChange || 0,
        mrp: product.mrp || undefined,
        purchasePrice: product.purchasePrice || undefined,
      };
    })
    .filter((stock): stock is StockRecord => stock !== null);
}
