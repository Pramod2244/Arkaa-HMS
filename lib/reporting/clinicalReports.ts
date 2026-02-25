import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { encodeCursor, decodeCursor } from "@/lib/utils/pagination";

/**
 * Non-Invasive Clinical Reporting Service
 */

/**
 * Doctor Productivity Metrics
 * Aggregates consultation volume and average duration (if available).
 */
export async function getDoctorPerformance(
  tenantId: string,
  startDate: Date,
  endDate: Date
) {
  return prisma.$queryRaw`
    SELECT 
      dm."id" as "doctorId",
      dm."fullName" as "doctorName",
      COUNT(c.id) as "consultationsCount",
      COUNT(DISTINCT c."visitId") as "uniquePatients"
    FROM "Doctor" dm
    LEFT JOIN "Consultation" c ON c."doctorMasterId" = dm.id
    WHERE dm."tenantId" = ${tenantId}
      AND c."createdAt" >= ${startDate}
      AND c."createdAt" <= ${endDate}
      AND c.status = 'COMPLETED'
    GROUP BY dm.id, dm."fullName"
    ORDER BY "consultationsCount" DESC
  `;
}

/**
 * Disease Prevalence Report
 * Extracts diagnosis frequencies from Clinical Notes.
 * Note: This relies on the 'diagnosis' field in the Consultation model.
 */
export async function getDiagnosisStats(
  tenantId: string,
  limit: number = 10
) {
  return prisma.$queryRaw`
    SELECT 
      diagnosis,
      COUNT(*) as "count"
    FROM "Consultation"
    WHERE "tenantId" = ${tenantId}
      AND diagnosis IS NOT NULL
      AND diagnosis != ''
    GROUP BY diagnosis
    ORDER BY count DESC
    LIMIT ${limit}
  `;
}

/**
 * Longitudinal Patient Visit Volume
 * Daily visit counts across the hospital.
 */
export async function getDailyVisitVolume(
  tenantId: string,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return prisma.$queryRaw`
    SELECT 
      DATE("checkInTime") as "date",
      COUNT(*) as "visitCount"
    FROM "Visit"
    WHERE "tenantId" = ${tenantId}
      AND "checkInTime" >= ${startDate}
    GROUP BY "date"
    ORDER BY "date" ASC
  `;
}

/**
 * Patient Vitals History (Clinical Dashboard)
 */
export async function getPatientVitalsHistory(
  tenantId: string,
  patientId: string,
  options: { limit?: number; cursor?: string } = {}
) {
  const limit = options.limit || 10;
  const decodedCursor = decodeCursor(options.cursor);

  const where: Prisma.VitalWhereInput = {
    tenantId,
    visit: { patientId },
  };

  if (decodedCursor?.id && decodedCursor?.createdAt) {
    where.OR = [
      { recordedAt: { lt: new Date(decodedCursor.createdAt) } },
      {
        AND: [
          { recordedAt: new Date(decodedCursor.createdAt) },
          { id: { lt: decodedCursor.id } },
        ],
      },
    ];
  }

  const vitals = await prisma.vital.findMany({
    where,
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasMore = vitals.length > limit;
  const data = hasMore ? vitals.slice(0, limit) : vitals;
  const nextCursor =
    hasMore && data.length > 0
      ? encodeCursor({ id: data[data.length - 1].id, createdAt: data[data.length - 1].recordedAt })
      : null;

  return { data, nextCursor, hasMore };
}
