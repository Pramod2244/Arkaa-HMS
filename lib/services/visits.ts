import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";
import {
  decodeCursor,
  encodeCursor,
  sanitizeLimit,
  DEFAULT_LIMIT,
  type HybridPaginationParams,
} from "@/lib/utils/pagination";
import { syncOPDQueueSnapshot, removeFromOPDQueue } from "@/lib/services/opd-queue-snapshot";

export const VisitSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  appointmentId: z.string().optional(),
  doctorId: z.string().optional(),
  departmentId: z.string().optional(),
  visitType: z.enum(["OPD", "IPD", "EMERGENCY"]).default("OPD"),
  priority: z.enum(["EMERGENCY", "URGENT", "NORMAL", "LOW"]).default("NORMAL"),
  notes: z.string().optional(),
});

export type VisitInput = z.infer<typeof VisitSchema>;

/**
 * Get visits with CURSOR-BASED pagination (Phase-1 Hardening)
 * 
 * Supports hybrid pagination for backward compatibility:
 * - If cursor is provided: uses cursor-based pagination
 * - If page is provided (legacy): uses offset pagination (deprecated)
 */
export async function getVisits(
  tenantId: string,
  options: HybridPaginationParams & {
    patientId?: string;
    doctorId?: string;
    status?: string;
    date?: string;
  } = {}
) {
  const { cursor, page, limit: rawLimit = DEFAULT_LIMIT, patientId, doctorId, status, date } = options;
  const limit = sanitizeLimit(rawLimit);

  const where: any = { tenantId };

  if (patientId) {
    where.patientId = patientId;
  }

  if (doctorId) {
    where.doctorId = doctorId;
  }

  if (status) {
    where.status = status;
  }

  if (date) {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    where.createdAt = {
      gte: startDate,
      lt: endDate,
    };
  }

  const includeRelations = {
    patient: {
      select: {
        id: true,
        uhid: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
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
        id: true,
        appointmentDate: true,
        appointmentTime: true,
        tokenNumber: true,
      },
    },
  };

  // CURSOR-BASED PAGINATION (preferred)
  if (cursor || !page) {
    const decodedCursor = decodeCursor(cursor);
    
    // Build cursor condition for compound sort
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
      where.AND = where.AND ? [...where.AND, cursorCondition] : [cursorCondition];
    } else if (decodedCursor?.id) {
      where.id = { lt: decodedCursor.id };
    }

    const visits = await prisma.visit.findMany({
      where,
      include: includeRelations,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
    });

    const hasMore = visits.length > limit;
    const data = hasMore ? visits.slice(0, limit) : visits;
    
    const nextCursor = hasMore && data.length > 0
      ? encodeCursor({ id: data[data.length - 1].id, createdAt: data[data.length - 1].createdAt })
      : null;

    return {
      visits: data,
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
  console.warn('[DEPRECATION] Using offset pagination. Migrate to cursor-based pagination.');
  const [visits, total] = await Promise.all([
    prisma.visit.findMany({
      where,
      include: includeRelations,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.visit.count({ where }),
  ]);

  return {
    visits,
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

export async function createVisit(
  data: VisitInput,
  tenantId: string,
  userId: string
) {
  // Get the next visit number for this patient
  const lastVisit = await prisma.visit.findFirst({
    where: { patientId: data.patientId },
    orderBy: { visitNumber: 'desc' },
  });

  const visitNumber = (lastVisit?.visitNumber || 0) + 1;

  const visit = await prisma.visit.create({
    data: {
      patientId: data.patientId,
      appointmentId: data.appointmentId || null,
      doctorId: data.doctorId || null,
      departmentId: data.departmentId || null,
      visitType: data.visitType,
      visitNumber,
      status: 'WAITING',
      priority: data.priority,
      checkInTime: new Date(),
      notes: data.notes || null,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    },
    include: {
      patient: {
        select: {
          id: true,
          uhid: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
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
    },
  });

  // If this visit is linked to an appointment, update the appointment status
  if (data.appointmentId) {
    await prisma.appointment.update({
      where: { id: data.appointmentId },
      data: { status: 'COMPLETED' },
    });
  }

  // Sync OPD Queue snapshot (Phase-1 Read Model)
  if (data.visitType === 'OPD') {
    syncOPDQueueSnapshot(visit.id).catch(err => {
      console.error('[Visit] Failed to sync OPD queue snapshot:', err);
    });
  }

  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "Visit",
    entityId: visit.id,
    action: "CREATE",
    newValue: visit,
  });

  return visit;
}

export async function updateVisitStatus(
  id: string,
  status: string,
  tenantId: string,
  userId: string
) {
  const existingVisit = await prisma.visit.findFirst({
    where: { id, tenantId },
  });

  if (!existingVisit) {
    throw new Error("Visit not found");
  }

  const updateData: any = {
    status,
    updatedBy: userId,
  };

  // Set timestamps based on status
  if (status === 'IN_PROGRESS' && !existingVisit.startTime) {
    updateData.startTime = new Date();
  } else if (status === 'COMPLETED' && !existingVisit.endTime) {
    updateData.endTime = new Date();
  }

  const visit = await prisma.visit.update({
    where: { id },
    data: updateData,
    include: {
      patient: {
        select: {
          id: true,
          uhid: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
        },
      },
      doctor: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  // Sync OPD Queue snapshot (Phase-1 Read Model)
  if (existingVisit.visitType === 'OPD') {
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      removeFromOPDQueue(id).catch(err => {
        console.error('[Visit] Failed to remove from OPD queue:', err);
      });
    } else {
      syncOPDQueueSnapshot(id).catch(err => {
        console.error('[Visit] Failed to sync OPD queue snapshot:', err);
      });
    }
  }

  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "Visit",
    entityId: visit.id,
    action: "UPDATE",
    oldValue: existingVisit,
    newValue: visit,
  });

  return visit;
}

export async function getPatientVisits(
  patientId: string,
  tenantId: string,
  limit: number = 10
) {
  return prisma.visit.findMany({
    where: { patientId, tenantId },
    include: {
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
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ============== OPD-SPECIFIC FUNCTIONS ==============

/**
 * Create OPD visit with department auto-selection
 * Only receptionist assigned to a department can create OPD visits
 * Doctor selection must be from the same department
 */
export async function createOPDVisit(
  data: {
    patientId: string;
    departmentId: string; // Auto-selected based on logged-in user
    doctorId?: string;
    appointmentId?: string;
    priority?: "EMERGENCY" | "URGENT" | "NORMAL" | "LOW";
    notes?: string;
  },
  tenantId: string,
  userId: string
) {
  // Verify the doctor belongs to the selected department if assigned
  if (data.doctorId) {
    const doctorDept = await prisma.userDepartment.findFirst({
      where: {
        userId: data.doctorId,
        departmentId: data.departmentId,
        tenantId,
        isActive: true,
      },
    });

    if (!doctorDept) {
      throw new Error("Doctor not assigned to this department");
    }
  }

  // Get next visit number for patient
  const lastVisit = await prisma.visit.findFirst({
    where: { tenantId, patientId: data.patientId },
    orderBy: { visitNumber: "desc" },
  });

  const visitNumber = (lastVisit?.visitNumber || 0) + 1;

  const visit = await prisma.visit.create({
    data: {
      tenantId,
      patientId: data.patientId,
      departmentId: data.departmentId,
      doctorId: data.doctorId || null,
      appointmentId: data.appointmentId || null,
      visitType: "OPD",
      visitNumber,
      status: "WAITING",
      priority: data.priority || "NORMAL",
      checkInTime: new Date(),
      notes: data.notes || null,
      createdBy: userId,
      updatedBy: userId,
    },
    include: {
      patient: {
        select: {
          id: true,
          uhid: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          phoneNumber: true,
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
          id: true,
          appointmentDate: true,
          appointmentTime: true,
          tokenNumber: true,
        },
      },
    },
  });

  // Mark appointment as completed if linked
  if (data.appointmentId) {
    await prisma.appointment.update({
      where: { id: data.appointmentId },
      data: { status: "COMPLETED" },
    });
  }

  // Sync OPD Queue snapshot (Phase-1 Read Model)
  syncOPDQueueSnapshot(visit.id).catch(err => {
    console.error('[Visit] Failed to sync OPD queue snapshot:', err);
  });

  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "Visit",
    entityId: visit.id,
    action: "CREATE",
    newValue: visit,
  });

  return visit;
}

/**
 * Get OPD visits for a user's assigned departments (Phase-1 Hardening)
 * Filters by: tenantId, visitType=OPD, departmentId IN userDepartments
 * Status filter for WAITING and IN_PROGRESS
 * 
 * Uses CURSOR-BASED pagination for scalability
 */
export async function getOPDVisits(
  tenantId: string,
  userDepartmentIds: string[],
  options: HybridPaginationParams & {
    departmentId?: string;
    status?: "WAITING" | "IN_PROGRESS" | "COMPLETED";
    doctorId?: string;
  } = {}
) {
  const { cursor, page, limit: rawLimit = 20, departmentId, status, doctorId } = options;
  const limit = sanitizeLimit(rawLimit);

  // Build where clause
  const departmentFilter = departmentId
    ? [departmentId] // Single department filter if specified
    : userDepartmentIds; // Multiple departments for user

  if (departmentFilter.length === 0) {
    return {
      visits: [],
      pagination: { page: 1, limit, total: 0, pages: 0, nextCursor: null, hasMore: false },
    };
  }

  const where: any = {
    tenantId,
    visitType: "OPD",
    departmentId: { in: departmentFilter },
  };

  // Show only WAITING and IN_PROGRESS by default
  if (status) {
    where.status = status;
  } else {
    where.status = { in: ["WAITING", "IN_PROGRESS"] };
  }

  if (doctorId) {
    where.doctorId = doctorId;
  }

  const includeRelations = {
    patient: {
      select: {
        id: true,
        uhid: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        phoneNumber: true,
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
        id: true,
        appointmentDate: true,
        appointmentTime: true,
        tokenNumber: true,
      },
    },
  };

  // CURSOR-BASED PAGINATION (preferred)
  if (cursor || !page) {
    const decodedCursor = decodeCursor(cursor);
    
    if (decodedCursor?.id && decodedCursor?.createdAt) {
      const cursorCondition = {
        OR: [
          { checkInTime: { gt: decodedCursor.createdAt } },
          {
            AND: [
              { checkInTime: decodedCursor.createdAt },
              { id: { gt: decodedCursor.id } },
            ],
          },
        ],
      };
      where.AND = where.AND ? [...where.AND, cursorCondition] : [cursorCondition];
    } else if (decodedCursor?.id) {
      where.id = { gt: decodedCursor.id };
    }

    const visits = await prisma.visit.findMany({
      where,
      include: includeRelations,
      orderBy: [
        { priority: "desc" },
        { checkInTime: "asc" },
        { id: "asc" },
      ],
      take: limit + 1,
    });

    const hasMore = visits.length > limit;
    const data = hasMore ? visits.slice(0, limit) : visits;
    
    const nextCursor = hasMore && data.length > 0
      ? encodeCursor({ id: data[data.length - 1].id, createdAt: data[data.length - 1].checkInTime || data[data.length - 1].createdAt })
      : null;

    return {
      visits: data,
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
  console.warn('[DEPRECATION] Using offset pagination in getOPDVisits. Migrate to cursor-based.');
  const [visits, total] = await Promise.all([
    prisma.visit.findMany({
      where,
      include: includeRelations,
      orderBy: [
        { priority: "desc" },
        { checkInTime: "asc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.visit.count({ where }),
  ]);

  return {
    visits,
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
 * Get doctor's OPD queue for their departments (Phase-1 Hardening)
 * Filters by visitType=OPD, status IN (WAITING, IN_PROGRESS), doctorId
 * Sorted by priority then check-in time
 * 
 * Uses CURSOR-BASED pagination for scalability
 */
export async function getDoctorOPDQueue(
  tenantId: string,
  doctorId: string,
  options: HybridPaginationParams & {
    departmentIds?: string[];
  } = {}
) {
  const { cursor, page, departmentIds = [], limit: rawLimit = 50 } = options;
  const limit = sanitizeLimit(rawLimit);

  const where: any = {
    tenantId,
    visitType: "OPD",
    doctorId,
    status: { in: ["WAITING", "IN_PROGRESS"] },
  };

  // Filter by doctor's departments if provided
  if (departmentIds.length > 0) {
    where.departmentId = { in: departmentIds };
  }

  const includeRelations = {
    patient: {
      select: {
        id: true,
        uhid: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        phoneNumber: true,
        bloodGroup: true,
        allergies: true,
      },
    },
    department: {
      select: {
        id: true,
        name: true,
      },
    },
    vitals: {
      orderBy: { recordedAt: "desc" } as const,
      take: 1,
      select: {
        bloodPressureSystolic: true,
        bloodPressureDiastolic: true,
        pulseRate: true,
        temperature: true,
        spO2: true,
        weight: true,
        height: true,
        recordedAt: true,
      },
    },
    consultations: {
      orderBy: { consultationDate: "desc" } as const,
      take: 1,
      select: {
        id: true,
        consultationDate: true,
        status: true,
      },
    },
  };

  // CURSOR-BASED PAGINATION (preferred)
  if (cursor || !page) {
    const decodedCursor = decodeCursor(cursor);
    
    if (decodedCursor?.id && decodedCursor?.createdAt) {
      const cursorCondition = {
        OR: [
          { checkInTime: { gt: decodedCursor.createdAt } },
          {
            AND: [
              { checkInTime: decodedCursor.createdAt },
              { id: { gt: decodedCursor.id } },
            ],
          },
        ],
      };
      where.AND = where.AND ? [...where.AND, cursorCondition] : [cursorCondition];
    } else if (decodedCursor?.id) {
      where.id = { gt: decodedCursor.id };
    }

    const visits = await prisma.visit.findMany({
      where,
      include: includeRelations,
      orderBy: [
        { priority: "desc" },
        { checkInTime: "asc" },
        { id: "asc" },
      ],
      take: limit + 1,
    });

    const hasMore = visits.length > limit;
    const data = hasMore ? visits.slice(0, limit) : visits;
    
    const nextCursor = hasMore && data.length > 0
      ? encodeCursor({ id: data[data.length - 1].id, createdAt: data[data.length - 1].checkInTime || data[data.length - 1].createdAt })
      : null;

    return {
      visits: data,
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
  console.warn('[DEPRECATION] Using offset pagination in getDoctorOPDQueue. Migrate to cursor-based.');
  const [visits, total] = await Promise.all([
    prisma.visit.findMany({
      where,
      include: includeRelations,
      orderBy: [
        { priority: "desc" },
        { checkInTime: "asc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.visit.count({ where }),
  ]);

  return {
    visits,
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
 * Get user's accessible departments
 * Used to enforce OPD access restrictions
 */
export async function getUserDepartments(
  userId: string,
  tenantId: string
) {
  const userDepts = await prisma.userDepartment.findMany({
    where: {
      userId,
      tenantId,
      isActive: true,
    },
    include: {
      department: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  return userDepts.map((ud) => ({
    id: ud.department.id,
    name: ud.department.name,
    code: ud.department.code,
  }));
}