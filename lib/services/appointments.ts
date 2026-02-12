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

export const AppointmentSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  departmentId: z.string().optional(),
  doctorId: z.string().optional(),
  appointmentDate: z.string().min(1, "Appointment date is required"),
  appointmentTime: z.string().optional(),
  notes: z.string().optional(),
});

export type AppointmentInput = z.infer<typeof AppointmentSchema>;

/**
 * Get appointments with CURSOR-BASED pagination (Phase-1 Hardening)
 * 
 * Supports hybrid pagination for backward compatibility:
 * - If cursor is provided: uses cursor-based pagination
 * - If page is provided (legacy): uses offset pagination (deprecated)
 */
export async function getAppointments(
  tenantId: string,
  options: HybridPaginationParams & {
    date?: string;
    doctorId?: string;
    status?: string;
  } = {}
) {
  const { cursor, page, limit: rawLimit = DEFAULT_LIMIT, date, doctorId, status } = options;
  const limit = sanitizeLimit(rawLimit);

  const where: any = { tenantId };

  if (date) {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    where.appointmentDate = {
      gte: startDate,
      lt: endDate,
    };
  }

  if (doctorId) {
    where.doctorId = doctorId;
  }

  if (status) {
    where.status = status;
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
    doctorMaster: {
      select: {
        id: true,
        doctorCode: true,
        fullName: true,
      },
    },
    department: {
      select: {
        id: true,
        name: true,
        code: true,
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

    const appointments = await prisma.appointment.findMany({
      where,
      include: includeRelations,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
    });

    const hasMore = appointments.length > limit;
    const data = hasMore ? appointments.slice(0, limit) : appointments;
    
    const nextCursor = hasMore && data.length > 0
      ? encodeCursor({ id: data[data.length - 1].id, createdAt: data[data.length - 1].createdAt })
      : null;

    return {
      appointments: data,
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
  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: includeRelations,
      orderBy: [
        { appointmentDate: 'desc' },
        { appointmentTime: 'asc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.appointment.count({ where }),
  ]);

  return {
    appointments,
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

export async function createAppointment(
  data: AppointmentInput,
  tenantId: string,
  userId: string
) {
  // Generate token number for the day
  const appointmentDate = new Date(data.appointmentDate);
  const startOfDay = new Date(appointmentDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(appointmentDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existingAppointments = await prisma.appointment.count({
    where: {
      tenantId,
      appointmentDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const tokenNumber = existingAppointments + 1;

  const appointment = await prisma.appointment.create({
    data: {
      patientId: data.patientId,
      departmentId: data.departmentId || null,
      doctorId: data.doctorId || null,
      appointmentDate: appointmentDate,
      appointmentTime: data.appointmentTime || null,
      tokenNumber,
      status: 'BOOKED',
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

  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "Appointment",
    entityId: appointment.id,
    action: "CREATE",
    newValue: appointment,
  });

  return appointment;
}

export async function updateAppointment(
  id: string,
  data: Partial<AppointmentInput>,
  tenantId: string,
  userId: string
) {
  const existingAppointment = await prisma.appointment.findFirst({
    where: { id, tenantId },
  });

  if (!existingAppointment) {
    throw new Error("Appointment not found");
  }

  const updateData: any = {
    updatedBy: userId,
  };

  if (data.patientId !== undefined) updateData.patientId = data.patientId;
  if (data.departmentId !== undefined) updateData.departmentId = data.departmentId || null;
  if (data.doctorId !== undefined) updateData.doctorId = data.doctorId || null;
  if (data.appointmentDate !== undefined) updateData.appointmentDate = new Date(data.appointmentDate);
  if (data.appointmentTime !== undefined) updateData.appointmentTime = data.appointmentTime || null;
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  const appointment = await prisma.appointment.update({
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
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "Appointment",
    entityId: appointment.id,
    action: "UPDATE",
    oldValue: existingAppointment,
    newValue: appointment,
  });

  return appointment;
}

export async function cancelAppointment(
  id: string,
  tenantId: string,
  userId: string
) {
  const existingAppointment = await prisma.appointment.findFirst({
    where: { id, tenantId },
  });

  if (!existingAppointment) {
    throw new Error("Appointment not found");
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      updatedBy: userId,
    },
  });

  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "Appointment",
    entityId: appointment.id,
    action: "UPDATE",
    oldValue: existingAppointment,
    newValue: appointment,
  });

  return appointment;
}