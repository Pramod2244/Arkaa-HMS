import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/rbac";
import type { Prisma } from "@/app/generated/prisma/client";

// =====================================================
// TYPES
// =====================================================

export interface FIFOAllocationRequest {
  tenantId: string;
  storeId: string;
  productId: string;
  requiredQty: number;
  referenceNumber: string;
  userId: string;
}

export interface BatchAllocation {
  batchNumber: string;
  expiryDate: Date | null;
  allocatedQty: number;
  ledgerEntryId: string;
}

export interface FIFOAllocationResult {
  productId: string;
  storeId: string;
  totalAllocated: number;
  allocations: BatchAllocation[];
}

// =====================================================
// FIFO STOCK ALLOCATION
// Must be called INSIDE an existing prisma.$transaction
// =====================================================

/**
 * Allocate stock using FIFO (First Expiry First Out) within a transaction.
 * - Groups InventoryLedger by batchNumber
 * - Orders by expiryDate ASC (nearest expiry first)
 * - Inserts SALE_OUT ledger entries for each deducted batch
 * - Throws if insufficient stock
 */
export async function allocateStockFIFO(
  tx: Prisma.TransactionClient,
  request: FIFOAllocationRequest
): Promise<FIFOAllocationResult> {
  const { tenantId, storeId, productId, requiredQty, referenceNumber, userId } = request;

  if (requiredQty <= 0) {
    throw new AppError("Quantity must be positive", 400, "INVALID_QUANTITY");
  }

  // Row-level lock: Prevent concurrent transactions from allocating the same product simultaneously
  await tx.$executeRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;

  // Aggregate current stock grouped by batch, ordered by nearest expiry first
  const batchStock = await tx.inventoryLedger.groupBy({
    by: ["batchNumber", "expiryDate"],
    where: {
      tenantId,
      storeId,
      productId,
    },
    _sum: {
      quantityChange: true,
    },
  });

  // Filter batches with positive stock and sort by expiryDate ASC (FEFO/FIFO)
  const availableBatches = batchStock
    .filter((b) => (b._sum.quantityChange ?? 0) > 0)
    .sort((a, b) => {
      // Null expiry dates go to the end
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate.getTime() - b.expiryDate.getTime();
    });

  // Calculate total available
  const totalAvailable = availableBatches.reduce(
    (sum, b) => sum + (b._sum.quantityChange ?? 0),
    0
  );

  if (totalAvailable < requiredQty) {
    throw new AppError(
      `Insufficient stock for product. Required: ${requiredQty}, Available: ${totalAvailable}`,
      400,
      "INSUFFICIENT_STOCK"
    );
  }

  // Allocate FIFO
  let remaining = requiredQty;
  const allocations: BatchAllocation[] = [];

  for (const batch of availableBatches) {
    if (remaining <= 0) break;

    const batchAvailable = batch._sum.quantityChange ?? 0;
    const allocateFromBatch = Math.min(batchAvailable, remaining);

    // Create SALE_OUT ledger entry (negative quantityChange)
    const ledgerEntry = await tx.inventoryLedger.create({
      data: {
        tenantId,
        storeId,
        productId,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        transactionType: "SALE_OUT",
        quantityChange: -allocateFromBatch,
        referenceNumber,
        notes: `FIFO allocation for sale ${referenceNumber}`,
        createdBy: userId,
      },
    });

    allocations.push({
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      allocatedQty: allocateFromBatch,
      ledgerEntryId: ledgerEntry.id,
    });

    remaining -= allocateFromBatch;
  }

  return {
    productId,
    storeId,
    totalAllocated: requiredQty,
    allocations,
  };
}

// =====================================================
// CHECK STOCK AVAILABILITY (read-only, no transaction required)
// =====================================================

export interface StockAvailability {
  productId: string;
  storeId: string;
  totalAvailable: number;
  batches: {
    batchNumber: string;
    expiryDate: Date | null;
    available: number;
  }[];
}

export async function checkStockAvailability(
  tenantId: string,
  storeId: string,
  productId: string
): Promise<StockAvailability> {
  const batchStock = await prisma.inventoryLedger.groupBy({
    by: ["batchNumber", "expiryDate"],
    where: {
      tenantId,
      storeId,
      productId,
    },
    _sum: {
      quantityChange: true,
    },
  });

  const batches = batchStock
    .filter((b) => (b._sum.quantityChange ?? 0) > 0)
    .sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate.getTime() - b.expiryDate.getTime();
    })
    .map((b) => ({
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      available: b._sum.quantityChange ?? 0,
    }));

  return {
    productId,
    storeId,
    totalAvailable: batches.reduce((sum, b) => sum + b.available, 0),
    batches,
  };
}
