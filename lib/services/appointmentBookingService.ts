/**
 * HMS Appointment System - Enhanced Appointment Booking Service
 * 
 * Handles appointment booking with slot validation, capacity checks,
 * walk-in support, and OPD queue integration.
 */

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { availabilityService } from "@/lib/services/availabilityService";
import { syncOPDQueueSnapshot } from "@/lib/services/opd-queue-snapshot";
import {
  CreateAppointmentInput,
  RescheduleAppointmentInput,
  CancelAppointmentInput,
  WalkInAppointmentInput,
  AppointmentQueryInput,
  AppointmentWithRelations,
} from "@/lib/schemas/appointment-schema";
import { BookingSource } from "@/app/generated/prisma";

// ============== TYPES ==============

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ============== HELPER FUNCTIONS ==============

/**
 * Generate daily token number for appointment
 */
async function generateDailyToken(
  tenantId: string,
  departmentId: string,
  date: Date
): Promise<number> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const maxToken = await prisma.appointment.findFirst({
    where: {
      tenantId,
      departmentId,
      appointmentDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: { tokenNumber: "desc" },
    select: { tokenNumber: true },
  });

  return (maxToken?.tokenNumber || 0) + 1;
}

/**
 * Get next available walk-in slot for a doctor
 */
async function getNextWalkInSlot(
  tenantId: string,
  doctorId: string,
  departmentId: string
): Promise<{ time: string; endTime: string } | null> {
  const now = new Date();
  const result = await availabilityService.getDoctorDaySlots(tenantId, {
    doctorId,
    departmentId,
    date: now.toISOString().split("T")[0],
  });

  if (!result.success || !result.data) return null;
  if (!result.data.allowWalkIn) return null;

  // Find next available slot
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  for (const slot of result.data.slots) {
    const slotMinutes = parseInt(slot.time.split(":")[0]) * 60 + parseInt(slot.time.split(":")[1]);
    if (slotMinutes >= currentTime && slot.isAvailable) {
      return { time: slot.time, endTime: slot.endTime };
    }
  }

  return null;
}

// ============== SERVICE ==============

export const appointmentBookingService = {
  /**
   * Book a new appointment with slot validation
   */
  async book(
    tenantId: string,
    input: CreateAppointmentInput,
    performedBy: string
  ): Promise<ServiceResult<AppointmentWithRelations>> {
    try {
      // 1. Validate patient exists
      const patient = await prisma.patient.findFirst({
        where: { id: input.patientId, tenantId, status: "ACTIVE" },
      });

      if (!patient) {
        return { success: false, error: "Patient not found", errorCode: "PATIENT_NOT_FOUND" };
      }

      // 2. Validate slot availability
      const slotValidation = await availabilityService.validateSlotBooking(
        tenantId,
        input.doctorId,
        new Date(input.appointmentDate),
        input.appointmentTime,
        input.isWalkIn
      );

      if (!slotValidation.success) {
        return { success: false, error: slotValidation.error, errorCode: "VALIDATION_ERROR" };
      }

      if (!slotValidation.data?.canBook) {
        return {
          success: false,
          error: slotValidation.data?.reason || "Slot not available",
          errorCode: "SLOT_UNAVAILABLE",
        };
      }

      // 3. Check for duplicate booking
      const existingBooking = await prisma.appointment.findFirst({
        where: {
          tenantId,
          patientId: input.patientId,
          appointmentDate: new Date(input.appointmentDate),
          status: { in: ["BOOKED", "CONFIRMED", "CHECKED_IN"] },
        },
      });

      if (existingBooking) {
        return {
          success: false,
          error: "Patient already has an appointment on this date",
          errorCode: "DUPLICATE_BOOKING",
        };
      }

      // 4. Generate token number
      const tokenNumber = await generateDailyToken(
        tenantId,
        input.departmentId,
        new Date(input.appointmentDate)
      );

      // 5. Create appointment
      const appointment = await prisma.appointment.create({
        data: {
          tenantId,
          patientId: input.patientId,
          departmentId: input.departmentId,
          doctorMasterId: input.doctorId,
          appointmentDate: new Date(input.appointmentDate),
          appointmentTime: input.appointmentTime,
          slotEndTime: input.slotEndTime,
          tokenNumber,
          status: "BOOKED",
          isWalkIn: input.isWalkIn,
          bookingSource: input.bookingSource as BookingSource,
          chiefComplaint: input.chiefComplaint,
          notes: input.notes,
          createdBy: performedBy,
          updatedBy: performedBy,
        },
        include: {
          patient: {
            select: { id: true, uhid: true, firstName: true, lastName: true, phoneNumber: true },
          },
          doctorMaster: {
            select: { id: true, doctorCode: true, fullName: true },
          },
          department: {
            select: { id: true, name: true, code: true },
          },
        },
      });

      // 6. Audit log
      await createAuditLog({
        tenantId,
        performedBy,
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        action: "CREATE",
        newValue: { ...appointment, tokenNumber },
      });

      return { success: true, data: appointment as unknown as AppointmentWithRelations };
    } catch (error) {
      console.error("Book appointment error:", error);
      return { success: false, error: "Failed to book appointment", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Walk-in appointment booking (auto-assigns next available slot)
   */
  async walkIn(
    tenantId: string,
    input: WalkInAppointmentInput,
    performedBy: string
  ): Promise<ServiceResult<AppointmentWithRelations>> {
    try {
      // 1. Find next available walk-in slot
      const slot = await getNextWalkInSlot(tenantId, input.doctorId, input.departmentId);

      if (!slot) {
        return {
          success: false,
          error: "No walk-in slots available for this doctor today",
          errorCode: "NO_WALKIN_SLOTS",
        };
      }

      // 2. Book the appointment
      return this.book(
        tenantId,
        {
          patientId: input.patientId,
          departmentId: input.departmentId,
          doctorId: input.doctorId,
          appointmentDate: new Date().toISOString().split("T")[0],
          appointmentTime: slot.time,
          slotEndTime: slot.endTime,
          isWalkIn: true,
          bookingSource: "WALKIN",
          chiefComplaint: input.chiefComplaint,
          notes: input.notes,
        },
        performedBy
      );
    } catch (error) {
      console.error("Walk-in appointment error:", error);
      return { success: false, error: "Failed to create walk-in appointment", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Reschedule an existing appointment
   */
  async reschedule(
    tenantId: string,
    input: RescheduleAppointmentInput,
    performedBy: string
  ): Promise<ServiceResult<AppointmentWithRelations>> {
    try {
      // 1. Get existing appointment
      const existing = await prisma.appointment.findFirst({
        where: {
          id: input.appointmentId,
          tenantId,
          status: { in: ["BOOKED", "CONFIRMED"] },
        },
        include: {
          patient: { select: { id: true, uhid: true, firstName: true, lastName: true, phoneNumber: true } },
        },
      });

      if (!existing) {
        return { success: false, error: "Appointment not found or cannot be rescheduled", errorCode: "NOT_FOUND" };
      }

      const newDoctorId = input.newDoctorId || existing.doctorMasterId;
      if (!newDoctorId) {
        return { success: false, error: "Doctor is required", errorCode: "DOCTOR_REQUIRED" };
      }

      // 2. Validate new slot
      const slotValidation = await availabilityService.validateSlotBooking(
        tenantId,
        newDoctorId,
        new Date(input.newDate),
        input.newTime,
        existing.isWalkIn
      );

      if (!slotValidation.success || !slotValidation.data?.canBook) {
        return {
          success: false,
          error: slotValidation.data?.reason || "New slot not available",
          errorCode: "SLOT_UNAVAILABLE",
        };
      }

      // 3. Generate new token for new date if different
      let newToken = existing.tokenNumber;
      if (input.newDate !== existing.appointmentDate.toISOString().split("T")[0]) {
        newToken = await generateDailyToken(
          tenantId,
          existing.departmentId!,
          new Date(input.newDate)
        );
      }

      // 4. Update appointment
      const updated = await prisma.appointment.update({
        where: { id: input.appointmentId },
        data: {
          appointmentDate: new Date(input.newDate),
          appointmentTime: input.newTime,
          slotEndTime: input.newSlotEndTime,
          tokenNumber: newToken,
          doctorMasterId: newDoctorId,
          status: "RESCHEDULED",
          notes: input.reason ? `${existing.notes || ""}\nRescheduled: ${input.reason}` : existing.notes,
          updatedBy: performedBy,
        },
        include: {
          patient: { select: { id: true, uhid: true, firstName: true, lastName: true, phoneNumber: true } },
          doctorMaster: { select: { id: true, doctorCode: true, fullName: true } },
          department: { select: { id: true, name: true, code: true } },
        },
      });

      await createAuditLog({
        tenantId,
        performedBy,
        entityType: "APPOINTMENT",
        entityId: input.appointmentId,
        action: "RESCHEDULE",
        oldValue: existing,
        newValue: updated,
      });

      return { success: true, data: updated as unknown as AppointmentWithRelations };
    } catch (error) {
      console.error("Reschedule appointment error:", error);
      return { success: false, error: "Failed to reschedule appointment", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Cancel an appointment
   */
  async cancel(
    tenantId: string,
    input: CancelAppointmentInput,
    performedBy: string
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await prisma.appointment.findFirst({
        where: {
          id: input.appointmentId,
          tenantId,
          status: { notIn: ["CANCELLED", "COMPLETED"] },
        },
      });

      if (!existing) {
        return { success: false, error: "Appointment not found or already cancelled/completed", errorCode: "NOT_FOUND" };
      }

      await prisma.appointment.update({
        where: { id: input.appointmentId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: input.cancelReason,
          updatedBy: performedBy,
        },
      });

      await createAuditLog({
        tenantId,
        performedBy,
        entityType: "APPOINTMENT",
        entityId: input.appointmentId,
        action: "CANCEL",
        oldValue: existing,
        newValue: { status: "CANCELLED", cancelReason: input.cancelReason },
      });

      return { success: true };
    } catch (error) {
      console.error("Cancel appointment error:", error);
      return { success: false, error: "Failed to cancel appointment", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Check-in patient for appointment
   * Creates a Visit record and syncs OPD Queue for doctor dashboard
   */
  async checkIn(
    tenantId: string,
    appointmentId: string,
    performedBy: string
  ): Promise<ServiceResult<AppointmentWithRelations>> {
    try {
      const existing = await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          tenantId,
          status: { in: ["BOOKED", "CONFIRMED", "RESCHEDULED"] },
        },
        include: {
          doctorMaster: {
            select: { id: true, userId: true, doctorCode: true, fullName: true },
          },
        },
      });

      if (!existing) {
        return { success: false, error: "Appointment not found or not in valid state for check-in", errorCode: "NOT_FOUND" };
      }

      // Generate next token number for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const lastToken = await prisma.visit.findFirst({
        where: {
          tenantId,
          departmentId: existing.departmentId,
          checkInTime: { gte: today, lt: tomorrow },
        },
        orderBy: { tokenNumber: 'desc' },
        select: { tokenNumber: true },
      });

      const tokenNumber = (lastToken?.tokenNumber || 0) + 1;

      // Get next visit number for patient
      const lastVisit = await prisma.visit.findFirst({
        where: { patientId: existing.patientId },
        orderBy: { visitNumber: 'desc' },
        select: { visitNumber: true },
      });

      const visitNumber = (lastVisit?.visitNumber || 0) + 1;

      // Create Visit record linked to appointment
      const visit = await prisma.visit.create({
        data: {
          patientId: existing.patientId,
          appointmentId: existing.id,
          doctorId: existing.doctorMaster?.userId || null, // Link to User ID
          departmentId: existing.departmentId,
          visitType: 'OPD',
          visitNumber,
          tokenNumber,
          status: 'WAITING',
          priority: 'NORMAL',
          checkInTime: new Date(),
          notes: existing.chiefComplaint,
          tenantId,
          createdBy: performedBy,
          updatedBy: performedBy,
        },
      });

      // Update appointment status
      const updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: "CHECKED_IN",
          checkedInAt: new Date(),
          tokenNumber,
          updatedBy: performedBy,
        },
        include: {
          patient: { select: { id: true, uhid: true, firstName: true, lastName: true, phoneNumber: true } },
          doctorMaster: { select: { id: true, doctorCode: true, fullName: true } },
          department: { select: { id: true, name: true, code: true } },
        },
      });

      // Sync OPD Queue snapshot for doctor dashboard
      try {
        await syncOPDQueueSnapshot(visit.id);
      } catch (syncErr) {
        console.error('[CheckIn] Failed to sync OPD queue snapshot:', syncErr);
      }

      await createAuditLog({
        tenantId,
        performedBy,
        entityType: "APPOINTMENT",
        entityId: appointmentId,
        action: "CHECK_IN",
        oldValue: existing,
        newValue: { ...updated, visitId: visit.id },
      });

      return { success: true, data: updated as unknown as AppointmentWithRelations };
    } catch (error) {
      console.error("Check-in error:", error);
      return { success: false, error: "Failed to check-in", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Mark appointment as in-progress
   */
  async startConsultation(
    tenantId: string,
    appointmentId: string,
    performedBy: string
  ): Promise<ServiceResult<AppointmentWithRelations>> {
    try {
      const existing = await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          tenantId,
          status: "CHECKED_IN",
        },
      });

      if (!existing) {
        return { success: false, error: "Appointment not found or patient not checked in", errorCode: "NOT_FOUND" };
      }

      const updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: "IN_PROGRESS",
          updatedBy: performedBy,
        },
        include: {
          patient: { select: { id: true, uhid: true, firstName: true, lastName: true, phoneNumber: true } },
          doctorMaster: { select: { id: true, doctorCode: true, fullName: true } },
          department: { select: { id: true, name: true, code: true } },
        },
      });

      return { success: true, data: updated as unknown as AppointmentWithRelations };
    } catch (error) {
      console.error("Start consultation error:", error);
      return { success: false, error: "Failed to start consultation", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Mark appointment as completed
   */
  async complete(
    tenantId: string,
    appointmentId: string,
    performedBy: string
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          tenantId,
          status: { in: ["CHECKED_IN", "IN_PROGRESS"] },
        },
      });

      if (!existing) {
        return { success: false, error: "Appointment not found or not in valid state", errorCode: "NOT_FOUND" };
      }

      await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: "COMPLETED",
          updatedBy: performedBy,
        },
      });

      await createAuditLog({
        tenantId,
        performedBy,
        entityType: "APPOINTMENT",
        entityId: appointmentId,
        action: "COMPLETE",
        oldValue: existing,
      });

      return { success: true };
    } catch (error) {
      console.error("Complete appointment error:", error);
      return { success: false, error: "Failed to complete appointment", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Get appointment by ID
   */
  async getById(
    tenantId: string,
    appointmentId: string
  ): Promise<AppointmentWithRelations | null> {
    return prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        patient: { select: { id: true, uhid: true, firstName: true, lastName: true, phoneNumber: true } },
        doctorMaster: { select: { id: true, doctorCode: true, fullName: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    }) as Promise<AppointmentWithRelations | null>;
  },

  /**
   * List appointments with filters
   */
  async list(
    tenantId: string,
    query: AppointmentQueryInput
  ): Promise<PaginatedResult<AppointmentWithRelations>> {
    const where: Record<string, unknown> = { tenantId };

    // Date filters
    if (query.date) {
      const startOfDay = new Date(query.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(query.date);
      endOfDay.setHours(23, 59, 59, 999);
      where.appointmentDate = { gte: startOfDay, lte: endOfDay };
    } else if (query.startDate || query.endDate) {
      where.appointmentDate = {};
      if (query.startDate) {
        (where.appointmentDate as Record<string, Date>).gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);
        (where.appointmentDate as Record<string, Date>).lte = endDate;
      }
    }

    if (query.patientId) where.patientId = query.patientId;
    if (query.doctorId) where.doctorMasterId = query.doctorId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.status) where.status = query.status;
    if (query.isWalkIn !== undefined) where.isWalkIn = query.isWalkIn;

    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          patient: { select: { id: true, uhid: true, firstName: true, lastName: true, phoneNumber: true } },
          doctorMaster: { select: { id: true, doctorCode: true, fullName: true } },
          department: { select: { id: true, name: true, code: true } },
        },
        orderBy: [
          { appointmentDate: "asc" },
          { tokenNumber: "asc" },
        ],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.appointment.count({ where }),
    ]);

    return {
      items: items as unknown as AppointmentWithRelations[],
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  },

  /**
   * Get OPD queue for a department/doctor on a date
   */
  async getOPDQueue(
    tenantId: string,
    departmentId: string,
    date: string,
    doctorId?: string
  ): Promise<AppointmentWithRelations[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const where: Record<string, unknown> = {
      tenantId,
      departmentId,
      appointmentDate: { gte: startOfDay, lte: endOfDay },
      status: { in: ["BOOKED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "RESCHEDULED"] },
    };

    if (doctorId) {
      where.doctorMasterId = doctorId;
    }

    return prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, uhid: true, firstName: true, lastName: true, phoneNumber: true } },
        doctorMaster: { select: { id: true, doctorCode: true, fullName: true } },
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: [
        { tokenNumber: "asc" },
      ],
    }) as unknown as AppointmentWithRelations[];
  },
};
