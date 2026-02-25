"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getPharmacyDashboardData() {
  try {
    const session = await getSession();
    if (!session?.tenantId) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [salesToday, pendingPOs, lowStockItems, nearExpiryBatches] = await Promise.all([
      // Sales today
      prisma.pharmacySale.aggregate({
        _sum: { netAmount: true },
        where: {
          tenantId: session.tenantId,
          createdAt: { gte: today },
          status: 'COMPLETED',
          isDeleted: false,
        },
      }),

      // Pending Purchase Orders
      prisma.purchaseOrder.count({
        where: {
          tenantId: session.tenantId,
          status: { in: ['DRAFT', 'APPROVED', 'SENT'] },
          isDeleted: false,
        },
      }),

      // Low Stock Items (using mv_current_stock and Product)
      prisma.$queryRaw`
        SELECT COUNT(*)::int as "count"
        FROM "Product" p
        JOIN "mv_current_stock" st ON st."productId" = p.id
        WHERE p."tenantId" = ${session.tenantId}
          AND st."availableQty" <= p."reorderLevel"
          AND p."isDeleted" = false
      `.then((res: any) => res[0]?.count || 0),

      // Near Expiry Batches (next 30 days)
      prisma.$queryRaw`
        SELECT COUNT(*)::int as "count"
        FROM "mv_current_stock" cs
        WHERE cs."tenantId" = ${session.tenantId}
          AND cs."expiryDate" <= ${thirtyDaysFromNow}
          AND cs."expiryDate" > CURRENT_DATE
      `.then((res: any) => res[0]?.count || 0),
    ]);

    return {
      revenueToday: salesToday._sum.netAmount?.toNumber() || 0,
      pendingPOs,
      lowStockItems,
      nearExpiryBatches,
    };
  } catch (error) {
    console.error('Pharmacy Dashboard data error:', error);
    return {
      revenueToday: 0,
      pendingPOs: 0,
      lowStockItems: 0,
      nearExpiryBatches: 0,
    };
  }
}