/**
 * HMS Phase-1 Hardening: OPD Queue Read Model
 * 
 * Denormalized read model for OPD Queue to eliminate expensive JOINs.
 * 
 * Architecture:
 * - OPDQueueSnapshot is the READ model (optimized for queries)
 * - Visit table remains the WRITE model (source of truth)
 * - Snapshot is updated via events (visit create/update)
 * 
 * Benefits:
 * - O(1) queue lookup (no JOINs)
 * - Indexed for all common query patterns
 * - Decouples read and write performance
 */

import { prisma } from "@/lib/prisma";
import {
  decodeCursor,
  encodeCursor,
  sanitizeLimit,
  type HybridPaginationParams,
} from "@/lib/utils/pagination";

// ============== TYPES ==============

export interface OPDQueueItem {
  id: string;
  visitId: string;
  tenantId: string;
  
  // Patient
  patientId: string;
  patientUhid: string;
  patientName: string;
  patientPhone: string | null;
  patientGender: string | null;
  patientDob: Date | null;
  
  // Doctor
  doctorId: string | null;
  doctorName: string | null;
  
  // Department
  departmentId: string;
  departmentName: string;
  
  // Visit
  tokenNumber: number | null;
  visitNumber: number;
  priority: string;
  status: string;
  visitType: string;
  
  // Timestamps
  checkInTime: Date;
  startTime: Date | null;
  endTime: Date | null;
}

export interface OPDQueueFilters {
  departmentId?: string;
  departmentIds?: string[];
  doctorId?: string;
  status?: string | string[];
  priority?: string;
}

// ============== SNAPSHOT SYNC ==============

/**
 * Create or update OPD queue snapshot when visit is created/updated
 * 
 * Call this after Visit create/update operations.
 * This is the EVENT HANDLER for maintaining the read model.
 */
export async function syncOPDQueueSnapshot(visitId: string): Promise<void> {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: {
          select: {
            id: true,
            uhid: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        doctor: {
          select: {
            id: true,
            fullName: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        appointment: {
          select: {
            tokenNumber: true,
          },
        },
      },
    });

    if (!visit) {
      console.warn(`[OPDQueue] Visit not found: ${visitId}`);
      return;
    }

    // Only track OPD visits
    if (visit.visitType !== 'OPD') {
      // Remove from snapshot if exists
      await prisma.oPDQueueSnapshot.deleteMany({
        where: { visitId },
      });
      return;
    }

    // Build patient name
    const patientName = [visit.patient.firstName, visit.patient.lastName]
      .filter(Boolean)
      .join(' ');

    // Upsert snapshot
    await prisma.oPDQueueSnapshot.upsert({
      where: { visitId },
      create: {
        tenantId: visit.tenantId,
        visitId: visit.id,
        patientId: visit.patient.id,
        patientUhid: visit.patient.uhid,
        patientName,
        patientPhone: visit.patient.phoneNumber,
        patientGender: visit.patient.gender,
        patientDob: visit.patient.dateOfBirth,
        doctorId: visit.doctor?.id || null,
        doctorName: visit.doctor?.fullName || null,
        departmentId: visit.department?.id || '',
        departmentName: visit.department?.name || '',
        tokenNumber: visit.appointment?.tokenNumber || null,
        visitNumber: visit.visitNumber,
        priority: visit.priority,
        status: visit.status,
        visitType: visit.visitType,
        checkInTime: visit.checkInTime || visit.createdAt,
        startTime: visit.startTime,
        endTime: visit.endTime,
      },
      update: {
        patientName,
        patientPhone: visit.patient.phoneNumber,
        doctorId: visit.doctor?.id || null,
        doctorName: visit.doctor?.fullName || null,
        departmentId: visit.department?.id || '',
        departmentName: visit.department?.name || '',
        tokenNumber: visit.appointment?.tokenNumber || null,
        priority: visit.priority,
        status: visit.status,
        startTime: visit.startTime,
        endTime: visit.endTime,
        updatedAt: new Date(),
      },
    });

    console.log(`[OPDQueue] Snapshot synced for visit: ${visitId}`);
  } catch (error) {
    console.error(`[OPDQueue] Failed to sync snapshot for visit ${visitId}:`, error);
    // Don't throw - snapshot sync failures should not block operations
  }
}

/**
 * Remove visit from OPD queue snapshot
 * Call when visit is cancelled or deleted
 */
export async function removeFromOPDQueue(visitId: string): Promise<void> {
  try {
    await prisma.oPDQueueSnapshot.deleteMany({
      where: { visitId },
    });
    console.log(`[OPDQueue] Removed snapshot for visit: ${visitId}`);
  } catch (error) {
    console.error(`[OPDQueue] Failed to remove snapshot for visit ${visitId}:`, error);
  }
}

// ============== QUERY FUNCTIONS ==============

/**
 * Get OPD queue from READ MODEL (no JOINs!)
 * 
 * This is the optimized query path for OPD queue display.
 * Uses cursor-based pagination for scalability.
 */
export async function getOPDQueueFromSnapshot(
  tenantId: string,
  filters: OPDQueueFilters & HybridPaginationParams = {}
): Promise<{
  items: OPDQueueItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}> {
  const { cursor, page, limit: rawLimit = 20 } = filters;
  const limit = sanitizeLimit(rawLimit);

  // Build where clause
  const where: any = {
    tenantId,
  };

  // Department filter
  if (filters.departmentId) {
    where.departmentId = filters.departmentId;
  } else if (filters.departmentIds && filters.departmentIds.length > 0) {
    where.departmentId = { in: filters.departmentIds };
  }

  // Doctor filter
  if (filters.doctorId) {
    where.doctorId = filters.doctorId;
  }

  // Status filter (default: WAITING, IN_PROGRESS)
  if (filters.status) {
    where.status = Array.isArray(filters.status) 
      ? { in: filters.status }
      : filters.status;
  } else {
    where.status = { in: ['WAITING', 'IN_PROGRESS'] };
  }

  // Priority filter
  if (filters.priority) {
    where.priority = filters.priority;
  }

  // CURSOR-BASED PAGINATION
  if (cursor || !page) {
    const decodedCursor = decodeCursor(cursor);
    
    if (decodedCursor?.id && decodedCursor?.createdAt) {
      where.OR = [
        { checkInTime: { gt: decodedCursor.createdAt } },
        {
          AND: [
            { checkInTime: decodedCursor.createdAt },
            { id: { gt: decodedCursor.id } },
          ],
        },
      ];
    } else if (decodedCursor?.id) {
      where.id = { gt: decodedCursor.id };
    }

    const items = await prisma.oPDQueueSnapshot.findMany({
      where,
      orderBy: [
        { priority: 'desc' },    // EMERGENCY first
        { checkInTime: 'asc' },  // Older check-ins first
        { id: 'asc' },
      ],
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    
    const nextCursor = hasMore && data.length > 0
      ? encodeCursor({ id: data[data.length - 1].id, createdAt: data[data.length - 1].checkInTime })
      : null;

    return {
      items: data,
      pagination: {
        page: 1,
        limit,
        total: hasMore ? limit + 1 : data.length,
        pages: hasMore ? 2 : 1,
        nextCursor,
        hasMore,
      },
    };
  }

  // LEGACY OFFSET PAGINATION (deprecated)
  console.warn('[OPDQueue] Using offset pagination. Migrate to cursor-based.');
  const [items, total] = await Promise.all([
    prisma.oPDQueueSnapshot.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { checkInTime: 'asc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.oPDQueueSnapshot.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      nextCursor: null,
      hasMore: page * limit < total,
    },
  };
}

/**
 * Get queue count by status (for dashboard stats)
 */
export async function getOPDQueueCounts(
  tenantId: string,
  filters: { departmentId?: string; doctorId?: string } = {}
): Promise<{ waiting: number; inProgress: number; completed: number }> {
  const where: any = { tenantId };
  
  if (filters.departmentId) {
    where.departmentId = filters.departmentId;
  }
  if (filters.doctorId) {
    where.doctorId = filters.doctorId;
  }

  const [waiting, inProgress, completed] = await Promise.all([
    prisma.oPDQueueSnapshot.count({ where: { ...where, status: 'WAITING' } }),
    prisma.oPDQueueSnapshot.count({ where: { ...where, status: 'IN_PROGRESS' } }),
    prisma.oPDQueueSnapshot.count({ where: { ...where, status: 'COMPLETED' } }),
  ]);

  return { waiting, inProgress, completed };
}

// ============== BULK SYNC ==============

/**
 * Rebuild OPD queue snapshot for a tenant
 * Use for initial setup or data recovery
 */
export async function rebuildOPDQueueSnapshot(tenantId: string): Promise<number> {
  console.log(`[OPDQueue] Rebuilding snapshot for tenant: ${tenantId}`);
  
  // Get all active OPD visits
  const visits = await prisma.visit.findMany({
    where: {
      tenantId,
      visitType: 'OPD',
      status: { in: ['WAITING', 'IN_PROGRESS'] },
    },
    select: { id: true },
  });

  // Sync each visit
  let count = 0;
  for (const visit of visits) {
    await syncOPDQueueSnapshot(visit.id);
    count++;
  }

  console.log(`[OPDQueue] Rebuilt ${count} snapshots for tenant: ${tenantId}`);
  return count;
}

/**
 * Clean up completed/cancelled visits older than threshold
 */
export async function cleanupOldSnapshots(
  tenantId: string,
  hoursOld: number = 24
): Promise<number> {
  const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
  
  const result = await prisma.oPDQueueSnapshot.deleteMany({
    where: {
      tenantId,
      status: { in: ['COMPLETED', 'CANCELLED'] },
      updatedAt: { lt: cutoff },
    },
  });

  console.log(`[OPDQueue] Cleaned up ${result.count} old snapshots`);
  return result.count;
}
