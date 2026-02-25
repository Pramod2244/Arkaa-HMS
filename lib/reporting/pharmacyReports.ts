import { prisma } from "@/lib/prisma";

/**
 * Non-Invasive Pharmacy Reporting Service
 */

/**
 * Top Selling Products
 */
export async function getTopSellingMedicines(
  tenantId: string,
  limit: number = 20
) {
  return prisma.$queryRaw`
    SELECT 
      p.id as "productId",
      p.name as "productName",
      p."genericName",
      SUM(psi.quantity) as "totalQuantity",
      SUM(psi.total) as "totalRevenue"
    FROM "PharmacySaleItem" psi
    JOIN "Product" p ON psi."productId" = p.id
    WHERE psi."tenantId" = ${tenantId}
      AND psi."isDeleted" = false
    GROUP BY p.id, p.name, p."genericName"
    ORDER BY "totalQuantity" DESC
    LIMIT ${limit}
  `;
}

/**
 * Pharmacy Sales Trend (Daily)
 */
export async function getPharmacySalesTrend(
  tenantId: string,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return prisma.$queryRaw`
    SELECT 
      DATE("createdAt") as "date",
      SUM("netAmount") as "revenue",
      COUNT(id) as "saleCount"
    FROM "PharmacySale"
    WHERE "tenantId" = ${tenantId}
      AND "isDeleted" = false
      AND "createdAt" >= ${startDate}
    GROUP BY "date"
    ORDER BY "date" ASC
  `;
}

/**
 * Pharmacist Performance
 */
export async function getPharmacistProductivity(
  tenantId: string,
  startDate: Date,
  endDate: Date
) {
  return prisma.$queryRaw`
    SELECT 
      "createdBy" as "userId",
      COUNT(id) as "salesCount",
      SUM("netAmount") as "totalValue"
    FROM "PharmacySale"
    WHERE "tenantId" = ${tenantId}
      AND "createdAt" >= ${startDate}
      AND "createdAt" <= ${endDate}
      AND "status" = 'COMPLETED'
    GROUP BY "createdBy"
    ORDER BY "salesCount" DESC
  `;
}
