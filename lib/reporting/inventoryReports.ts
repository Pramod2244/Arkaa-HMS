import { prisma } from "@/lib/prisma";
import { encodeCursor, decodeCursor } from "@/lib/utils/pagination";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * Non-Invasive Inventory Reporting Service
 */

/**
 * Global Stock Status Dashboard (Safe Aggregate)
 * Counts total stock and identifies reorder items.
 */
export async function getInventorySummary(tenantId: string) {
  // Use materialized view to eliminate grouping crores of ledger entries
  return prisma.$queryRaw`
    SELECT 
      COUNT(*) as "totalProducts",
      SUM(CASE WHEN st."availableQty" <= p."reorderLevel" THEN 1 ELSE 0 END) as "reorderCount",
      SUM(CASE WHEN st."availableQty" <= p."minimumStock" THEN 1 ELSE 0 END) as "outOfStockCount"
    FROM "Product" p
    LEFT JOIN "mv_current_stock" st ON st."productId" = p.id
    WHERE p."tenantId" = ${tenantId}
      AND p."isDeleted" = false
  `;
}

/**
 * Reorder Level Alerts with cursor-based pagination.
 */
export async function getReorderAlerts(
  tenantId: string,
  options: { limit?: number; cursor?: string } = {}
) {
  const limit = options.limit || 20;
  
  // Use materialized view for performance
  return prisma.$queryRaw`
    SELECT 
      p.id,
      p.name,
      p.code,
      p."reorderLevel",
      st."availableQty" as "currentStock"
    FROM "Product" p
    JOIN "mv_current_stock" st ON st."productId" = p.id
    WHERE p."tenantId" = ${tenantId}
      AND st."availableQty" <= p."reorderLevel"
    ORDER BY st."availableQty" ASC
    LIMIT ${limit}
  `;
}

/**
 * Near Expiry Batches (within 90 days)
 * Optimized via mv_current_stock read model.
 */
export async function getNearExpiryItems(
  tenantId: string,
  days: number = 90
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + days);

  return prisma.$queryRaw`
    SELECT 
      p.name as "productName",
      cs."batchNumber",
      cs."expiryDate",
      cs."availableQty" as "currentQuantity",
      s.name as "storeName"
    FROM "mv_current_stock" cs
    JOIN "Product" p ON cs."productId" = p.id
    JOIN "Store" s ON cs."storeId" = s.id
    WHERE cs."tenantId" = ${tenantId}
      AND cs."expiryDate" <= ${cutoffDate}
      AND cs."expiryDate" > CURRENT_DATE
    ORDER BY cs."expiryDate" ASC
  `;
}
