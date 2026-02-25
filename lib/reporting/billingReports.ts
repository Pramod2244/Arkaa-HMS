import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { encodeCursor, decodeCursor } from "@/lib/utils/pagination";

/**
 * Non-Invasive Billing Reporting Service
 * Scalable to 500+ Hospitals
 */

interface RevenueByDeptOptions {
  tenantId: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Aggregates revenue by department for a specific period.
 * Uses optimized raw SQL to handle deep joins across Visit -> Department.
 */
export async function getRevenueByDepartment({
  tenantId,
  startDate,
  endDate,
}: RevenueByDeptOptions) {
  // Use materialized view to avoid heavy JOINs on transactional tables
  return prisma.$queryRaw`
    SELECT 
      "departmentId",
      "departmentName",
      SUM("revenue") as "revenue",
      SUM("invoiceCount") as "invoiceCount"
    FROM mv_dept_revenue_daily
    WHERE "tenantId" = ${tenantId}
      AND "reportDate" >= ${startDate}
      AND "reportDate" <= ${endDate}
    GROUP BY "departmentId", "departmentName"
    ORDER BY revenue DESC
  `;
}

/**
 * Lists outstanding invoices with cursor-based pagination.
 * Zero-impact on transactional performance via indexed status lookup.
 */
export async function getOutstandingInvoices(
  tenantId: string,
  options: { cursor?: string; limit?: number } = {}
) {
  const limit = options.limit || 20;
  const decodedCursor = decodeCursor(options.cursor);

  const where: Prisma.InvoiceWhereInput = {
    tenantId,
    status: { in: ['FINAL', 'PARTIAL', 'OVERDUE'] },
    outstanding: { gt: 0 },
  };

  if (decodedCursor?.id && decodedCursor?.createdAt) {
    where.OR = [
      { createdAt: { lt: new Date(decodedCursor.createdAt) } },
      {
        AND: [
          { createdAt: new Date(decodedCursor.createdAt) },
          { id: { lt: decodedCursor.id } },
        ],
      },
    ];
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: {
      patient: { select: { firstName: true, lastName: true, uhid: true } },
    },
  });

  const hasMore = invoices.length > limit;
  const data = hasMore ? invoices.slice(0, limit) : invoices;
  const nextCursor =
    hasMore && data.length > 0
      ? encodeCursor({ id: data[data.length - 1].id, createdAt: data[data.length - 1].createdAt })
      : null;

  return { data, nextCursor, hasMore };
}

/**
 * Monthly Collection Snapshot (Non-Invasive)
 */
export async function getMonthlyCollection(tenantId: string, year: number) {
  return prisma.$queryRaw`
    SELECT 
      EXTRACT(MONTH FROM "paymentDate") as "month",
      SUM(amount) as "totalCollected"
    FROM "Payment"
    WHERE "tenantId" = ${tenantId}
      AND EXTRACT(YEAR FROM "paymentDate") = ${year}
    GROUP BY "month"
    ORDER BY "month" ASC
  `;
}
