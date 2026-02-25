import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { encodeCursor, decodeCursor } from "@/lib/utils/pagination";

/**
 * Non-Invasive Audit Reporting Service
 */

/**
 * Filtered Audit Log Stream
 * Optimized via tenantId index and performedAt sorting.
 */
export async function getAuditActivity(
  tenantId: string,
  options: { 
    entityType?: string; 
    action?: string; 
    userId?: string; 
    cursor?: string; 
    limit?: number 
  } = {}
) {
  const limit = options.limit || 50;
  const decodedCursor = decodeCursor(options.cursor);

  const where: Prisma.AuditLogWhereInput = {
    tenantId,
  };

  if (options.entityType) where.entityType = options.entityType;
  if (options.action) where.action = options.action;
  if (options.userId) where.performedBy = options.userId;

  if (decodedCursor?.id && decodedCursor?.createdAt) {
    where.OR = [
      { performedAt: { lt: new Date(decodedCursor.createdAt) } },
      {
        AND: [
          { performedAt: new Date(decodedCursor.createdAt) },
          { id: { lt: decodedCursor.id } },
        ],
      },
    ];
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: [{ performedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: {
      user: { select: { fullName: true, username: true } },
    },
  });

  const hasMore = logs.length > limit;
  const data = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor =
    hasMore && data.length > 0
      ? encodeCursor({ id: data[data.length - 1].id, createdAt: data[data.length - 1].performedAt })
      : null;

  return { data, nextCursor, hasMore };
}

/**
 * User Login Frequency Summary
 * Aggregates login frequency (action = 'LOGIN') for security audits.
 */
export async function getLoginFrequency(
  tenantId: string,
  days: number = 7
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return prisma.$queryRaw`
    SELECT 
      u."fullName",
      COUNT(al.id) as "loginCount"
    FROM "AuditLog" al
    JOIN "User" u ON al."performedBy" = u.id
    WHERE al."tenantId" = ${tenantId}
      AND al.action = 'LOGIN'
      AND al."performedAt" >= ${startDate}
    GROUP BY u."fullName"
    ORDER BY "loginCount" DESC
  `;
}

/**
 * Critical Entity Modification Alert
 * Identifies deletions or sensitive model updates.
 */
export async function getSensitiveOperations(tenantId: string) {
  return prisma.auditLog.findMany({
    where: {
      tenantId,
      action: { in: ['DELETE', 'UPDATE'] },
      entityType: { in: ['Role', 'User', 'TenantLicense'] },
    },
    orderBy: { performedAt: 'desc' },
    take: 50,
    include: {
      user: { select: { fullName: true } },
    },
  });
}
