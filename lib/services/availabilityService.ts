/**
 * HMS Appointment System - Doctor Availability Service
 * 
 * Business logic for managing doctor availability schedules.
 * Includes CRUD, overlap validation, slot generation, and capacity checks.
 */

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  CreateAvailabilityInput,
  UpdateAvailabilityInput,
  AvailabilityQueryInput,
  BulkCreateAvailabilityInput,
  SlotQueryInput,
  TimeSlot,
  DoctorDaySlots,
  CopyAvailabilityInput,
} from "@/lib/schemas/availability-schema";
import { DayOfWeek, AvailabilityStatus } from "@/app/generated/prisma";

// ============== TYPES ==============

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

interface AvailabilityWithRelations {
  id: string;
  tenantId: string;
  doctorId: string;
  departmentId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxPatientsPerSlot: number;
  maxPatientsPerDay: number | null;
  allowWalkIn: boolean;
  walkInSlotReservation: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: AvailabilityStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  doctor: {
    id: string;
    doctorCode: string;
    fullName: string;
    status: string;
    isSchedulable: boolean;
  };
  department: {
    id: string;
    code: string;
    name: string;
  };
}

// ============== HELPER FUNCTIONS ==============

/**
 * Convert time string (HH:mm) to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes from midnight to time string (HH:mm)
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Get day of week enum from Date
 */
function getDayOfWeekFromDate(date: Date): DayOfWeek {
  const days: DayOfWeek[] = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];
  return days[date.getDay()];
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

// ============== SERVICE ==============

export const availabilityService = {
  /**
   * Create a new availability slot
   */
  async create(
    tenantId: string,
    input: CreateAvailabilityInput,
    performedBy: string
  ): Promise<ServiceResult<AvailabilityWithRelations>> {
    try {
      // 1. Validate doctor exists and is schedulable
      const doctor = await prisma.doctor.findFirst({
        where: {
          id: input.doctorId,
          tenantId,
          isDeleted: false,
        },
      });

      if (!doctor) {
        return { success: false, error: "Doctor not found", errorCode: "DOCTOR_NOT_FOUND" };
      }

      if (!doctor.isSchedulable) {
        return { success: false, error: "Doctor is not schedulable", errorCode: "DOCTOR_NOT_SCHEDULABLE" };
      }

      // 2. Validate department exists and doctor has access
      const department = await prisma.department.findFirst({
        where: {
          id: input.departmentId,
          tenantId,
          isDeleted: false,
          status: "ACTIVE",
        },
      });

      if (!department) {
        return { success: false, error: "Department not found", errorCode: "DEPARTMENT_NOT_FOUND" };
      }

      // Check if doctor is assigned to this department
      const doctorDept = await prisma.doctorDepartment.findFirst({
        where: {
          doctorId: input.doctorId,
          departmentId: input.departmentId,
          isActive: true,
        },
      });

      if (!doctorDept && doctor.primaryDepartmentId !== input.departmentId) {
        return {
          success: false,
          error: "Doctor is not assigned to this department",
          errorCode: "DOCTOR_NOT_IN_DEPARTMENT",
        };
      }

      // 3. Check for overlapping availability
      const overlapping = await prisma.doctorAvailability.findFirst({
        where: {
          tenantId,
          doctorId: input.doctorId,
          departmentId: input.departmentId,
          dayOfWeek: input.dayOfWeek as DayOfWeek,
          status: "ACTIVE",
        },
      });

      if (overlapping) {
        // Check time overlap
        if (timeRangesOverlap(input.startTime, input.endTime, overlapping.startTime, overlapping.endTime)) {
          return {
            success: false,
            error: `Overlapping availability exists for ${input.dayOfWeek} from ${overlapping.startTime} to ${overlapping.endTime}`,
            errorCode: "AVAILABILITY_OVERLAP",
          };
        }
      }

      // 4. Create availability
      const availability = await prisma.doctorAvailability.create({
        data: {
          tenantId,
          doctorId: input.doctorId,
          departmentId: input.departmentId,
          dayOfWeek: input.dayOfWeek as DayOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
          slotDurationMinutes: input.slotDurationMinutes,
          maxPatientsPerSlot: input.maxPatientsPerSlot,
          maxPatientsPerDay: input.maxPatientsPerDay,
          allowWalkIn: input.allowWalkIn,
          walkInSlotReservation: input.walkInSlotReservation,
          effectiveFrom: input.effectiveFrom || new Date(),
          effectiveTo: input.effectiveTo,
          status: input.status as AvailabilityStatus,
          createdBy: performedBy,
        },
        include: {
          doctor: {
            select: {
              id: true,
              doctorCode: true,
              fullName: true,
              status: true,
              isSchedulable: true,
            },
          },
          department: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      // 5. Audit log
      await createAuditLog({
        tenantId,
        performedBy,
        entityType: "DOCTOR_AVAILABILITY",
        entityId: availability.id,
        action: "CREATE",
        newValue: availability,
      });

      return { success: true, data: availability as AvailabilityWithRelations };
    } catch (error) {
      console.error("Create availability error:", error);
      return { success: false, error: "Failed to create availability", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Bulk create availability for multiple days
   */
  async bulkCreate(
    tenantId: string,
    input: BulkCreateAvailabilityInput,
    performedBy: string
  ): Promise<ServiceResult<AvailabilityWithRelations[]>> {
    try {
      const results: AvailabilityWithRelations[] = [];
      const errors: string[] = [];

      for (const dayOfWeek of input.daysOfWeek) {
        const result = await this.create(
          tenantId,
          {
            ...input,
            dayOfWeek,
          },
          performedBy
        );

        if (result.success && result.data) {
          results.push(result.data);
        } else {
          errors.push(`${dayOfWeek}: ${result.error}`);
        }
      }

      if (results.length === 0) {
        return {
          success: false,
          error: errors.join("; "),
          errorCode: "BULK_CREATE_FAILED",
        };
      }

      return {
        success: true,
        data: results,
        ...(errors.length > 0 && { error: `Partial success. Errors: ${errors.join("; ")}` }),
      };
    } catch (error) {
      console.error("Bulk create availability error:", error);
      return { success: false, error: "Failed to create availability", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Update availability
   */
  async update(
    tenantId: string,
    id: string,
    input: UpdateAvailabilityInput,
    performedBy: string
  ): Promise<ServiceResult<AvailabilityWithRelations>> {
    try {
      const existing = await prisma.doctorAvailability.findFirst({
        where: { id, tenantId },
        include: {
          doctor: { select: { id: true, doctorCode: true, fullName: true, status: true, isSchedulable: true } },
          department: { select: { id: true, code: true, name: true } },
        },
      });

      if (!existing) {
        return { success: false, error: "Availability not found", errorCode: "NOT_FOUND" };
      }

      if (existing.version !== input.version) {
        return {
          success: false,
          error: "Record has been modified. Please refresh and try again.",
          errorCode: "VERSION_CONFLICT",
        };
      }

      // If updating times, check for overlap
      if (input.startTime || input.endTime) {
        const newStart = input.startTime || existing.startTime;
        const newEnd = input.endTime || existing.endTime;

        const overlapping = await prisma.doctorAvailability.findFirst({
          where: {
            tenantId,
            doctorId: existing.doctorId,
            departmentId: existing.departmentId,
            dayOfWeek: existing.dayOfWeek,
            status: "ACTIVE",
            id: { not: id },
          },
        });

        if (overlapping && timeRangesOverlap(newStart, newEnd, overlapping.startTime, overlapping.endTime)) {
          return {
            success: false,
            error: `Would create overlapping availability with ${overlapping.startTime} to ${overlapping.endTime}`,
            errorCode: "AVAILABILITY_OVERLAP",
          };
        }
      }

      const updated = await prisma.doctorAvailability.update({
        where: { id },
        data: {
          ...(input.startTime && { startTime: input.startTime }),
          ...(input.endTime && { endTime: input.endTime }),
          ...(input.slotDurationMinutes && { slotDurationMinutes: input.slotDurationMinutes }),
          ...(input.maxPatientsPerSlot && { maxPatientsPerSlot: input.maxPatientsPerSlot }),
          ...(input.maxPatientsPerDay !== undefined && { maxPatientsPerDay: input.maxPatientsPerDay }),
          ...(input.allowWalkIn !== undefined && { allowWalkIn: input.allowWalkIn }),
          ...(input.walkInSlotReservation !== undefined && { walkInSlotReservation: input.walkInSlotReservation }),
          ...(input.effectiveFrom && { effectiveFrom: input.effectiveFrom }),
          ...(input.effectiveTo !== undefined && { effectiveTo: input.effectiveTo }),
          ...(input.status && { status: input.status as AvailabilityStatus }),
          version: { increment: 1 },
          updatedBy: performedBy,
        },
        include: {
          doctor: { select: { id: true, doctorCode: true, fullName: true, status: true, isSchedulable: true } },
          department: { select: { id: true, code: true, name: true } },
        },
      });

      await createAuditLog({
        tenantId,
        performedBy,
        entityType: "DOCTOR_AVAILABILITY",
        entityId: id,
        action: "UPDATE",
        oldValue: existing,
        newValue: updated,
      });

      return { success: true, data: updated as AvailabilityWithRelations };
    } catch (error) {
      console.error("Update availability error:", error);
      return { success: false, error: "Failed to update availability", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Delete availability
   */
  async delete(
    tenantId: string,
    id: string,
    performedBy: string
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await prisma.doctorAvailability.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return { success: false, error: "Availability not found", errorCode: "NOT_FOUND" };
      }

      await prisma.doctorAvailability.delete({ where: { id } });

      await createAuditLog({
        tenantId,
        performedBy,
        entityType: "DOCTOR_AVAILABILITY",
        entityId: id,
        action: "DELETE",
        oldValue: existing,
      });

      return { success: true };
    } catch (error) {
      console.error("Delete availability error:", error);
      return { success: false, error: "Failed to delete availability", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Get availability by ID
   */
  async getById(
    tenantId: string,
    id: string
  ): Promise<AvailabilityWithRelations | null> {
    return prisma.doctorAvailability.findFirst({
      where: { id, tenantId },
      include: {
        doctor: { select: { id: true, doctorCode: true, fullName: true, status: true, isSchedulable: true } },
        department: { select: { id: true, code: true, name: true } },
      },
    }) as Promise<AvailabilityWithRelations | null>;
  },

  /**
   * List availability with filters
   */
  async list(
    tenantId: string,
    query: AvailabilityQueryInput
  ): Promise<AvailabilityWithRelations[]> {
    const now = new Date();

    return prisma.doctorAvailability.findMany({
      where: {
        tenantId,
        ...(query.doctorId && { doctorId: query.doctorId }),
        ...(query.departmentId && { departmentId: query.departmentId }),
        ...(query.dayOfWeek && { dayOfWeek: query.dayOfWeek as DayOfWeek }),
        ...(query.status && { status: query.status as AvailabilityStatus }),
        ...(!query.includeExpired && {
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: now } },
          ],
        }),
      },
      include: {
        doctor: { select: { id: true, doctorCode: true, fullName: true, status: true, isSchedulable: true } },
        department: { select: { id: true, code: true, name: true } },
      },
      orderBy: [
        { dayOfWeek: "asc" },
        { startTime: "asc" },
      ],
    }) as Promise<AvailabilityWithRelations[]>;
  },

  /**
   * Get doctor's availability for a specific date with slot info
   */
  async getDoctorDaySlots(
    tenantId: string,
    query: SlotQueryInput
  ): Promise<ServiceResult<DoctorDaySlots>> {
    try {
      const date = new Date(query.date);
      const dayOfWeek = getDayOfWeekFromDate(date);

      // 1. Get doctor info
      const doctor = await prisma.doctor.findFirst({
        where: {
          id: query.doctorId,
          tenantId,
          isDeleted: false,
          status: "ACTIVE",
          isSchedulable: true,
        },
        select: {
          id: true,
          fullName: true,
        },
      });

      if (!doctor) {
        return { success: false, error: "Doctor not found or not available", errorCode: "DOCTOR_NOT_AVAILABLE" };
      }

      // 2. Get availability for this day
      const availabilityWhere: {
        tenantId: string;
        doctorId: string;
        dayOfWeek: DayOfWeek;
        status: AvailabilityStatus;
        effectiveFrom: { lte: Date };
        departmentId?: string;
      } = {
        tenantId,
        doctorId: query.doctorId,
        dayOfWeek: dayOfWeek,
        status: "ACTIVE",
        effectiveFrom: { lte: date },
      };

      if (query.departmentId) {
        availabilityWhere.departmentId = query.departmentId;
      }

      const availabilities = await prisma.doctorAvailability.findMany({
        where: {
          ...availabilityWhere,
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: date } },
          ],
        },
        include: {
          department: { select: { id: true, code: true, name: true } },
        },
        orderBy: { startTime: "asc" },
      });

      if (availabilities.length === 0) {
        return {
          success: false,
          error: "Doctor has no availability on this day",
          errorCode: "NO_AVAILABILITY",
        };
      }

      // Use first availability for department info
      const primaryAvailability = availabilities[0];
      const departmentId = primaryAvailability.departmentId;
      const departmentName = primaryAvailability.department.name;

      // 3. Get existing appointments for this date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAppointments = await prisma.appointment.findMany({
        where: {
          tenantId,
          doctorMasterId: query.doctorId,
          appointmentDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            in: ["BOOKED", "CONFIRMED", "CHECKED_IN"],
          },
        },
        select: {
          appointmentTime: true,
          isWalkIn: true,
        },
      });

      // Count appointments per time slot
      const bookingCounts = new Map<string, number>();
      existingAppointments.forEach((apt) => {
        if (apt.appointmentTime) {
          const count = bookingCounts.get(apt.appointmentTime) || 0;
          bookingCounts.set(apt.appointmentTime, count + 1);
        }
      });

      // 4. Generate slots
      const slots: TimeSlot[] = [];
      let totalCapacity = 0;
      let totalBooked = 0;
      let maxPatientsPerDay: number | null = null;
      let allowWalkIn = false;

      for (const availability of availabilities) {
        const startMinutes = timeToMinutes(availability.startTime);
        const endMinutes = timeToMinutes(availability.endTime);
        const duration = availability.slotDurationMinutes;

        if (availability.maxPatientsPerDay) {
          maxPatientsPerDay = availability.maxPatientsPerDay;
        }
        if (availability.allowWalkIn) {
          allowWalkIn = true;
        }

        for (let time = startMinutes; time < endMinutes; time += duration) {
          const timeStr = minutesToTime(time);
          const endTimeStr = minutesToTime(time + duration);
          const bookedCount = bookingCounts.get(timeStr) || 0;
          const availableCount = availability.maxPatientsPerSlot - bookedCount;

          totalCapacity += availability.maxPatientsPerSlot;
          totalBooked += bookedCount;

          slots.push({
            time: timeStr,
            endTime: endTimeStr,
            maxCapacity: availability.maxPatientsPerSlot,
            bookedCount,
            availableCount: Math.max(0, availableCount),
            isAvailable: availableCount > 0,
            isWalkInOnly: false, // Can be enhanced with walk-in reservation logic
          });
        }
      }

      const dailyBookedCount = existingAppointments.length;
      const isDayFull = maxPatientsPerDay ? dailyBookedCount >= maxPatientsPerDay : slots.every((s) => !s.isAvailable);

      return {
        success: true,
        data: {
          doctorId: doctor.id,
          doctorName: doctor.fullName,
          departmentId,
          departmentName,
          date: date.toISOString().split("T")[0],
          dayOfWeek,
          totalCapacity,
          totalBooked,
          totalAvailable: totalCapacity - totalBooked,
          maxPatientsPerDay,
          dailyBookedCount,
          isDayFull,
          allowWalkIn,
          slots,
        },
      };
    } catch (error) {
      console.error("Get doctor day slots error:", error);
      return { success: false, error: "Failed to get slots", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Copy availability from one day to others
   */
  async copyToOtherDays(
    tenantId: string,
    input: CopyAvailabilityInput,
    performedBy: string
  ): Promise<ServiceResult<AvailabilityWithRelations[]>> {
    try {
      const source = await prisma.doctorAvailability.findFirst({
        where: { id: input.sourceAvailabilityId, tenantId },
      });

      if (!source) {
        return { success: false, error: "Source availability not found", errorCode: "NOT_FOUND" };
      }

      const results: AvailabilityWithRelations[] = [];
      const errors: string[] = [];

      for (const targetDay of input.targetDays) {
        if (targetDay === source.dayOfWeek) continue; // Skip same day

        // Check for existing availability on target day
        if (input.replaceExisting) {
          await prisma.doctorAvailability.deleteMany({
            where: {
              tenantId,
              doctorId: source.doctorId,
              departmentId: source.departmentId,
              dayOfWeek: targetDay as DayOfWeek,
            },
          });
        }

        const result = await this.create(
          tenantId,
          {
            doctorId: source.doctorId,
            departmentId: source.departmentId,
            dayOfWeek: targetDay,
            startTime: source.startTime,
            endTime: source.endTime,
            slotDurationMinutes: source.slotDurationMinutes,
            maxPatientsPerSlot: source.maxPatientsPerSlot,
            maxPatientsPerDay: source.maxPatientsPerDay,
            allowWalkIn: source.allowWalkIn,
            walkInSlotReservation: source.walkInSlotReservation,
            effectiveFrom: source.effectiveFrom,
            effectiveTo: source.effectiveTo,
            status: source.status,
          },
          performedBy
        );

        if (result.success && result.data) {
          results.push(result.data);
        } else {
          errors.push(`${targetDay}: ${result.error}`);
        }
      }

      if (results.length === 0 && errors.length > 0) {
        return { success: false, error: errors.join("; "), errorCode: "COPY_FAILED" };
      }

      return {
        success: true,
        data: results,
        ...(errors.length > 0 && { error: `Partial success. Errors: ${errors.join("; ")}` }),
      };
    } catch (error) {
      console.error("Copy availability error:", error);
      return { success: false, error: "Failed to copy availability", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Disable all availability for a specific day
   */
  async disableDay(
    tenantId: string,
    doctorId: string,
    departmentId: string,
    dayOfWeek: DayOfWeek,
    performedBy: string
  ): Promise<ServiceResult<number>> {
    try {
      const result = await prisma.doctorAvailability.updateMany({
        where: {
          tenantId,
          doctorId,
          departmentId,
          dayOfWeek,
          status: "ACTIVE",
        },
        data: {
          status: "INACTIVE",
          updatedBy: performedBy,
        },
      });

      await createAuditLog({
        tenantId,
        performedBy,
        entityType: "DOCTOR_AVAILABILITY",
        entityId: `${doctorId}-${departmentId}-${dayOfWeek}`,
        action: "DISABLE_DAY",
        newValue: { doctorId, departmentId, dayOfWeek, disabledCount: result.count },
      });

      return { success: true, data: result.count };
    } catch (error) {
      console.error("Disable day error:", error);
      return { success: false, error: "Failed to disable day", errorCode: "INTERNAL_ERROR" };
    }
  },

  /**
   * Validate if a slot can be booked
   */
  async validateSlotBooking(
    tenantId: string,
    doctorId: string,
    date: Date,
    time: string,
    isWalkIn: boolean = false
  ): Promise<ServiceResult<{ canBook: boolean; reason?: string }>> {
    try {
      const dayOfWeek = getDayOfWeekFromDate(date);

      // 1. Get availability
      const availability = await prisma.doctorAvailability.findFirst({
        where: {
          tenantId,
          doctorId,
          dayOfWeek,
          status: "ACTIVE",
          effectiveFrom: { lte: date },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: date } },
          ],
        },
        include: {
          doctor: { select: { status: true, isSchedulable: true } },
        },
      });

      if (!availability) {
        return { success: true, data: { canBook: false, reason: "No availability for this day" } };
      }

      // 2. Check doctor status
      if (availability.doctor.status !== "ACTIVE") {
        return { success: true, data: { canBook: false, reason: "Doctor is not active" } };
      }

      if (!availability.doctor.isSchedulable) {
        return { success: true, data: { canBook: false, reason: "Doctor is not schedulable" } };
      }

      // 3. Check if time is within availability window
      const timeMinutes = timeToMinutes(time);
      const startMinutes = timeToMinutes(availability.startTime);
      const endMinutes = timeToMinutes(availability.endTime);

      if (timeMinutes < startMinutes || timeMinutes >= endMinutes) {
        return { success: true, data: { canBook: false, reason: "Time is outside availability window" } };
      }

      // 4. Check walk-in permission
      if (isWalkIn && !availability.allowWalkIn) {
        return { success: true, data: { canBook: false, reason: "Walk-ins not allowed for this doctor" } };
      }

      // 5. Check slot capacity
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const slotBookings = await prisma.appointment.count({
        where: {
          tenantId,
          doctorMasterId: doctorId,
          appointmentDate: { gte: startOfDay, lte: endOfDay },
          appointmentTime: time,
          status: { in: ["BOOKED", "CONFIRMED", "CHECKED_IN"] },
        },
      });

      if (slotBookings >= availability.maxPatientsPerSlot) {
        return { success: true, data: { canBook: false, reason: "Slot is fully booked" } };
      }

      // 6. Check daily capacity
      if (availability.maxPatientsPerDay) {
        const dailyBookings = await prisma.appointment.count({
          where: {
            tenantId,
            doctorMasterId: doctorId,
            appointmentDate: { gte: startOfDay, lte: endOfDay },
            status: { in: ["BOOKED", "CONFIRMED", "CHECKED_IN"] },
          },
        });

        if (dailyBookings >= availability.maxPatientsPerDay) {
          return { success: true, data: { canBook: false, reason: "Doctor's daily limit reached" } };
        }
      }

      return { success: true, data: { canBook: true } };
    } catch (error) {
      console.error("Validate slot booking error:", error);
      return { success: false, error: "Failed to validate booking", errorCode: "INTERNAL_ERROR" };
    }
  },
};
