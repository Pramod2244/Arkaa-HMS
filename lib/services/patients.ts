import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { generateUHID } from "@/lib/patient-utils";
import { z } from "zod";
import { PatientSchema } from "@/lib/schemas/patient-schema";
import { AppError } from "@/lib/rbac";
import {
  decodeCursor,
  encodeCursor,
  sanitizeLimit,
  DEFAULT_LIMIT,
  type HybridPaginationParams,
} from "@/lib/utils/pagination";

export type PatientInput = z.infer<typeof PatientSchema>;

/**
 * Get patients with CURSOR-BASED pagination (Phase-1 Hardening)
 * 
 * Supports hybrid pagination for backward compatibility:
 * - If cursor is provided: uses cursor-based pagination
 * - If page is provided (legacy): uses offset pagination (deprecated)
 * 
 * Cursor-based pagination is O(1) vs O(n) for offset pagination
 */
export async function getPatients(
  tenantId: string,
  options: HybridPaginationParams & {
    search?: string;
    status?: string;
  } = {}
) {
  const { cursor, page, limit: rawLimit = DEFAULT_LIMIT, search, status } = options;
  const limit = sanitizeLimit(rawLimit);

  // Build base where clause
  const where: any = { tenantId };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { uhid: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { phoneNumber: { contains: search } },
    ];
  }

  // CURSOR-BASED PAGINATION (preferred)
  if (cursor || !page) {
    const decodedCursor = decodeCursor(cursor);
    
    // Add cursor condition for compound sort (createdAt desc, id desc)
    if (decodedCursor?.id && decodedCursor?.createdAt) {
      where.OR = where.OR 
        ? { AND: [{ OR: where.OR }, buildCursorCondition(decodedCursor)] }
        : buildCursorCondition(decodedCursor);
    } else if (decodedCursor?.id) {
      where.id = { lt: decodedCursor.id };
    }

    // Fetch limit + 1 to detect hasMore
    const patients = await prisma.patient.findMany({
      where: decodedCursor?.id && decodedCursor?.createdAt 
        ? rebuildWhereWithCursor(where, decodedCursor)
        : where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
    });

    const hasMore = patients.length > limit;
    const data = hasMore ? patients.slice(0, limit) : patients;
    
    const nextCursor = hasMore && data.length > 0
      ? encodeCursor({ id: data[data.length - 1].id, createdAt: data[data.length - 1].createdAt })
      : null;

    // Return with backward-compatible pagination object
    return {
      patients: data,
      pagination: {
        page: 1, // Legacy field - not meaningful with cursor
        limit,
        total: hasMore ? limit + 1 : data.length, // Estimate
        pages: hasMore ? 2 : 1, // Estimate
        nextCursor,
        hasMore,
      },
    };
  }

  // LEGACY OFFSET PAGINATION (deprecated - for backward compatibility only)
  console.warn('[DEPRECATION] Using offset pagination. Migrate to cursor-based pagination.');
  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.patient.count({ where }),
  ]);

  return {
    patients,
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

// Helper to build cursor condition for compound sort
function buildCursorCondition(cursor: { id: string; createdAt?: Date }) {
  if (!cursor.createdAt) {
    return { id: { lt: cursor.id } };
  }
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      {
        AND: [
          { createdAt: cursor.createdAt },
          { id: { lt: cursor.id } },
        ],
      },
    ],
  };
}

// Helper to rebuild where clause with cursor (handles existing OR conditions)
function rebuildWhereWithCursor(where: any, cursor: { id: string; createdAt?: Date }) {
  const cursorCondition = buildCursorCondition(cursor);
  const { OR, ...rest } = where;
  
  if (OR) {
    return {
      ...rest,
      AND: [
        { OR },
        cursorCondition,
      ],
    };
  }
  
  return {
    ...rest,
    ...cursorCondition,
  };
}

export async function getPatientById(id: string, tenantId: string) {
  return prisma.patient.findFirst({
    where: { id, tenantId },
  });
}

export async function searchPatients(
  tenantId: string,
  query: string,
  searchBy: 'mobile' | 'uhid' | 'name',
  includeSummary: boolean = false
) {
  const where: any = { tenantId, status: 'ACTIVE' };

  switch (searchBy) {
    case 'mobile':
      where.phoneNumber = { contains: query };
      break;
    case 'uhid':
      where.uhid = { contains: query, mode: 'insensitive' };
      break;
    case 'name':
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
      ];
      break;
  }

  const patients = await prisma.patient.findMany({
    where,
    take: 10, // Limit results
    orderBy: [
      { firstName: 'asc' },
      { lastName: 'asc' },
    ],
  });

  if (!includeSummary) {
    return patients;
  }

  // Add summary information for each patient
  const patientsWithSummary = await Promise.all(
    patients.map(async (patient) => {
      const [lastVisit, visitCount, outstandingAmount] = await Promise.all([
        // Get last visit
        prisma.visit.findFirst({
          where: { patientId: patient.id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, status: true },
        }),
        // Count total visits
        prisma.visit.count({
          where: { patientId: patient.id },
        }),
        // Calculate outstanding dues (simplified - total invoices minus payments)
        prisma.invoice.aggregate({
          where: { patientId: patient.id },
          _sum: { outstanding: true },
        }),
      ]);

      const summary = {
        lastVisitDate: lastVisit?.createdAt?.toISOString(),
        totalVisits: visitCount,
        outstandingDues: outstandingAmount._sum.outstanding || 0,
        lastVisitSummary: lastVisit ? `Last visit: ${lastVisit.createdAt.toLocaleDateString()} (${lastVisit.status})` : undefined,
      };

      return {
        ...patient,
        summary,
      };
    })
  );

  return patientsWithSummary;
}

export async function createPatient(
  data: PatientInput,
  tenantId: string,
  userId: string
) {
  // Validate and parse date of birth
  let dateOfBirth: Date;
  try {
    // HTML date inputs return YYYY-MM-DD format
    // Create date at noon UTC to avoid timezone issues
    const [year, month, day] = data.dateOfBirth.split('-').map(Number);
    dateOfBirth = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

    // Validate the date is reasonable (not in future, not too old)
    const now = new Date();
    const minDate = new Date(now.getFullYear() - 150, 0, 1); // 150 years ago
    const maxDate = new Date(now.getFullYear() - 1, 11, 31); // 1 year ago

    if (dateOfBirth < minDate || dateOfBirth > maxDate) {
      throw new Error('Invalid date of birth');
    }
  } catch (error) {
    throw new AppError('Invalid date of birth format', 400, 'INVALID_DATE');
  }

  // Generate UHID
  const uhid = await generateUHID(tenantId);

  const patient = await prisma.patient.create({
    data: {
      uhid,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth,
      gender: data.gender,
      phoneNumber: data.phoneNumber,
      email: data.email || null,
      address: data.address || null,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      bloodGroup: data.bloodGroup || null,
      allergies: data.allergies || null,
      medicalHistory: data.medicalHistory || null,
      status: data.status,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "Patient",
    entityId: patient.id,
    action: "CREATE",
    newValue: patient,
  });

  return patient;
}

export async function updatePatient(
  id: string,
  data: Partial<PatientInput>,
  tenantId: string,
  userId: string
) {
  const existingPatient = await prisma.patient.findFirst({
    where: { id, tenantId },
  });

  if (!existingPatient) {
    throw new Error("Patient not found");
  }

  const updateData: any = {
    updatedBy: userId,
  };

  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.dateOfBirth !== undefined) {
    try {
      // HTML date inputs return YYYY-MM-DD format
      // Create date at noon UTC to avoid timezone issues
      const [year, month, day] = data.dateOfBirth.split('-').map(Number);
      updateData.dateOfBirth = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

      // Validate the date is reasonable (not in future, not too old)
      const now = new Date();
      const minDate = new Date(now.getFullYear() - 150, 0, 1); // 150 years ago
      const maxDate = new Date(now.getFullYear() - 1, 11, 31); // 1 year ago

      if (updateData.dateOfBirth < minDate || updateData.dateOfBirth > maxDate) {
        throw new Error('Invalid date of birth');
      }
    } catch (error) {
      throw new AppError('Invalid date of birth format', 400, 'INVALID_DATE');
    }
  }
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.address !== undefined) updateData.address = data.address || null;
  if (data.emergencyContactName !== undefined) updateData.emergencyContactName = data.emergencyContactName || null;
  if (data.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = data.emergencyContactPhone || null;
  if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup || null;
  if (data.allergies !== undefined) updateData.allergies = data.allergies || null;
  if (data.medicalHistory !== undefined) updateData.medicalHistory = data.medicalHistory || null;
  if (data.status !== undefined) updateData.status = data.status;

  const patient = await prisma.patient.update({
    where: { id },
    data: updateData,
  });

  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "Patient",
    entityId: patient.id,
    action: "UPDATE",
    oldValue: existingPatient,
    newValue: patient,
  });

  return patient;
}

export async function deletePatient(id: string, tenantId: string, userId: string) {
  const existingPatient = await prisma.patient.findFirst({
    where: { id, tenantId },
  });

  if (!existingPatient) {
    throw new Error("Patient not found");
  }

  await prisma.patient.delete({
    where: { id },
  });

  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "Patient",
    entityId: id,
    action: "DELETE",
    oldValue: existingPatient,
  });

  return { success: true };
}