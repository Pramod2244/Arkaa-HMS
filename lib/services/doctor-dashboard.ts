/**
 * Doctor Dashboard Service
 * 
 * Purpose: Provides all data for doctor's daily OPD operations dashboard.
 * Uses OPDQueueSnapshot (READ model) for efficient queue queries.
 * 
 * Key Functions:
 * - getDoctorQueue() - Get today's OPD queue for a specific doctor
 * - getDoctorStats() - Get quick stats (waiting, in-progress, completed)
 * - startConsultation() - Validate and start a consultation
 * - getDoctorContext() - Get doctor's departments and info
 */

import { prisma } from "@/lib/prisma";
import { syncOPDQueueSnapshot } from "@/lib/services/opd-queue-snapshot";
import { createAuditLog } from "@/lib/audit";

// ============== TYPES ==============

export interface DoctorQueueItem {
  id: string;
  visitId: string;
  tokenNumber: number | null;
  patientName: string;
  patientUhid: string;
  patientPhone: string | null;
  patientGender: string | null;
  patientDob: Date | null;
  visitType: string;
  status: string;
  priority: string;
  departmentName: string;
  checkInTime: Date;
  startTime: Date | null;
  endTime: Date | null;
}

export interface DoctorQueueStats {
  waiting: number;
  inProgress: number;
  completed: number;
  currentToken: number | null;
  nextWaitingToken: number | null;
}

export interface DoctorContext {
  doctorId: string;
  doctorMasterId: string | null;
  fullName: string;
  departments: Array<{
    id: string;
    name: string;
    isPrimary: boolean;
  }>;
  status: string;
}

// ============== DOCTOR CONTEXT ==============

/**
 * Get doctor context - departments, status, etc.
 */
export async function getDoctorContext(
  userId: string,
  tenantId: string
): Promise<DoctorContext | null> {
  // Get user and their Doctor record
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
    },
  });

  if (!user) return null;

  // Get Doctor master record
  const doctorMaster = await prisma.doctor.findFirst({
    where: { userId, tenantId },
    select: {
      id: true,
      status: true,
      departments: {
        where: { isActive: true },
        select: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          isPrimary: true,
        },
      },
    },
  });

  return {
    doctorId: userId,
    doctorMasterId: doctorMaster?.id || null,
    fullName: user.fullName,
    departments: doctorMaster?.departments.map(dd => ({
      id: dd.department.id,
      name: dd.department.name,
      isPrimary: dd.isPrimary,
    })) || [],
    status: doctorMaster?.status || 'UNKNOWN',
  };
}

// ============== DOCTOR QUEUE ==============

/**
 * Get today's OPD queue for a doctor from the READ MODEL.
 * Uses OPDQueueSnapshot for O(1) lookups without JOINs.
 */
export async function getDoctorQueue(
  doctorUserId: string,
  tenantId: string,
  filters: {
    departmentId?: string;
    status?: string | string[];
    date?: Date;
  } = {}
): Promise<DoctorQueueItem[]> {
  const today = filters.date || new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  // Build where clause
  const where: {
    tenantId: string;
    doctorId: string;
    checkInTime: { gte: Date; lte: Date };
    departmentId?: string;
    status?: string | { in: string[] };
  } = {
    tenantId,
    doctorId: doctorUserId,
    checkInTime: {
      gte: startOfDay,
      lte: endOfDay,
    },
  };

  if (filters.departmentId) {
    where.departmentId = filters.departmentId;
  }

  if (filters.status) {
    where.status = Array.isArray(filters.status)
      ? { in: filters.status }
      : filters.status;
  }

  const items = await prisma.oPDQueueSnapshot.findMany({
    where,
    orderBy: [
      { priority: 'desc' },     // EMERGENCY first
      { tokenNumber: 'asc' },   // Then by token number
      { checkInTime: 'asc' },   // Then by check-in time
    ],
  });

  return items.map(item => ({
    id: item.id,
    visitId: item.visitId,
    tokenNumber: item.tokenNumber,
    patientName: item.patientName,
    patientUhid: item.patientUhid,
    patientPhone: item.patientPhone,
    patientGender: item.patientGender,
    patientDob: item.patientDob,
    visitType: item.visitType,
    status: item.status,
    priority: item.priority,
    departmentName: item.departmentName,
    checkInTime: item.checkInTime,
    startTime: item.startTime,
    endTime: item.endTime,
  }));
}

// ============== DOCTOR STATS ==============

/**
 * Get quick stats for doctor's dashboard.
 * Lightweight - just counts from READ MODEL.
 */
export async function getDoctorStats(
  doctorUserId: string,
  tenantId: string,
  departmentId?: string
): Promise<DoctorQueueStats> {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const baseWhere: {
    tenantId: string;
    doctorId: string;
    checkInTime: { gte: Date; lte: Date };
    departmentId?: string;
  } = {
    tenantId,
    doctorId: doctorUserId,
    checkInTime: {
      gte: startOfDay,
      lte: endOfDay,
    },
  };

  if (departmentId) {
    baseWhere.departmentId = departmentId;
  }

  // Run count queries in parallel
  const [waiting, inProgress, completed, currentInProgress, nextWaiting] = await Promise.all([
    prisma.oPDQueueSnapshot.count({
      where: { ...baseWhere, status: 'WAITING' },
    }),
    prisma.oPDQueueSnapshot.count({
      where: { ...baseWhere, status: 'IN_PROGRESS' },
    }),
    prisma.oPDQueueSnapshot.count({
      where: { ...baseWhere, status: 'COMPLETED' },
    }),
    // Get current in-progress token
    prisma.oPDQueueSnapshot.findFirst({
      where: { ...baseWhere, status: 'IN_PROGRESS' },
      orderBy: { startTime: 'desc' },
      select: { tokenNumber: true },
    }),
    // Get next waiting token
    prisma.oPDQueueSnapshot.findFirst({
      where: { ...baseWhere, status: 'WAITING' },
      orderBy: [
        { priority: 'desc' },
        { tokenNumber: 'asc' },
        { checkInTime: 'asc' },
      ],
      select: { tokenNumber: true },
    }),
  ]);

  return {
    waiting,
    inProgress,
    completed,
    currentToken: currentInProgress?.tokenNumber || null,
    nextWaitingToken: nextWaiting?.tokenNumber || null,
  };
}

// ============== START CONSULTATION ==============

export interface StartConsultationResult {
  success: boolean;
  visitId?: string;
  error?: string;
  errorCode?: 'UNAUTHORIZED' | 'ALREADY_IN_PROGRESS' | 'VISIT_NOT_FOUND' | 'VISIT_COMPLETED' | 'VISIT_CANCELLED';
}

/**
 * Start a consultation for a visit.
 * 
 * Validates:
 * - Visit exists and belongs to tenant
 * - Doctor owns this visit
 * - Visit is in WAITING status
 * 
 * Updates:
 * - Visit status to IN_PROGRESS
 * - Visit startTime to now()
 * - Syncs OPDQueueSnapshot
 */
export async function startConsultation(
  visitId: string,
  doctorUserId: string,
  tenantId: string
): Promise<StartConsultationResult> {
  // Fetch the visit
  const visit = await prisma.visit.findFirst({
    where: { id: visitId, tenantId },
    select: {
      id: true,
      doctorId: true,
      status: true,
      startTime: true,
    },
  });

  // Validation checks
  if (!visit) {
    return { success: false, error: 'Visit not found', errorCode: 'VISIT_NOT_FOUND' };
  }

  if (visit.doctorId !== doctorUserId) {
    return { success: false, error: 'You are not authorized to start this consultation', errorCode: 'UNAUTHORIZED' };
  }

  if (visit.status === 'IN_PROGRESS') {
    // Already in progress - just return success (idempotent)
    return { success: true, visitId: visit.id };
  }

  if (visit.status === 'COMPLETED') {
    return { success: false, error: 'Visit is already completed', errorCode: 'VISIT_COMPLETED' };
  }

  if (visit.status === 'CANCELLED') {
    return { success: false, error: 'Visit has been cancelled', errorCode: 'VISIT_CANCELLED' };
  }

  // Update visit status
  const oldValue = { status: visit.status, startTime: visit.startTime };
  
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      status: 'IN_PROGRESS',
      startTime: new Date(),
      updatedBy: doctorUserId,
    },
  });

  // Sync the OPD Queue Snapshot
  await syncOPDQueueSnapshot(visitId);

  // Audit log
  await createAuditLog({
    action: 'UPDATE',
    entityType: 'VISIT',
    entityId: visitId,
    oldValue,
    newValue: { status: 'IN_PROGRESS', startTime: new Date() },
    tenantId,
    performedBy: doctorUserId,
  });

  return { success: true, visitId };
}

// ============== SAFEGUARDS ==============

/**
 * Check if doctor has any visit in progress.
 * Used to warn about abandoning current consultation.
 */
export async function getDoctorInProgressVisit(
  doctorUserId: string,
  tenantId: string
): Promise<{ visitId: string; patientName: string } | null> {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const inProgressVisit = await prisma.oPDQueueSnapshot.findFirst({
    where: {
      tenantId,
      doctorId: doctorUserId,
      status: 'IN_PROGRESS',
      checkInTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    select: {
      visitId: true,
      patientName: true,
    },
  });

  return inProgressVisit;
}

/**
 * Get next waiting patient for the doctor.
 * Used after completing a visit to highlight the next patient.
 */
export async function getNextWaitingPatient(
  doctorUserId: string,
  tenantId: string,
  departmentId?: string
): Promise<DoctorQueueItem | null> {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const where: {
    tenantId: string;
    doctorId: string;
    status: string;
    checkInTime: { gte: Date; lte: Date };
    departmentId?: string;
  } = {
    tenantId,
    doctorId: doctorUserId,
    status: 'WAITING',
    checkInTime: {
      gte: startOfDay,
      lte: endOfDay,
    },
  };

  if (departmentId) {
    where.departmentId = departmentId;
  }

  const nextPatient = await prisma.oPDQueueSnapshot.findFirst({
    where,
    orderBy: [
      { priority: 'desc' },
      { tokenNumber: 'asc' },
      { checkInTime: 'asc' },
    ],
  });

  if (!nextPatient) return null;

  return {
    id: nextPatient.id,
    visitId: nextPatient.visitId,
    tokenNumber: nextPatient.tokenNumber,
    patientName: nextPatient.patientName,
    patientUhid: nextPatient.patientUhid,
    patientPhone: nextPatient.patientPhone,
    patientGender: nextPatient.patientGender,
    patientDob: nextPatient.patientDob,
    visitType: nextPatient.visitType,
    status: nextPatient.status,
    priority: nextPatient.priority,
    departmentName: nextPatient.departmentName,
    checkInTime: nextPatient.checkInTime,
    startTime: nextPatient.startTime,
    endTime: nextPatient.endTime,
  };
}
