import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import type { Prisma } from "@/app/generated/prisma/client";

export interface AppointmentSlot {
  date: Date;
  time: string; // "09:00", "09:15", etc.
  doctorId: string;
  isAvailable: boolean;
  appointmentId?: string; // if booked
}

export interface DoctorCalendarData {
  doctorId: string;
  doctorName: string;
  slots: AppointmentSlot[];
  totalSlots: number;
  bookedSlots: number;
  availableSlots: number;
}

export interface AppointmentConflict {
  hasConflict: boolean;
  message?: string;
  existingAppointmentId?: string;
}

// Configuration
const CLINIC_START_HOUR = 9; // 9 AM
const CLINIC_END_HOUR = 18; // 6 PM
const SLOT_DURATION_MINUTES = 15; // 15-minute slots

/**
 * Generate all available time slots for a given date range
 */
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = CLINIC_START_HOUR; hour < CLINIC_END_HOUR; hour++) {
    for (let minutes = 0; minutes < 60; minutes += SLOT_DURATION_MINUTES) {
      const timeStr = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}`;
      slots.push(timeStr);
    }
  }
  return slots;
}

/**
 * Check if a doctor has a conflicting appointment
 */
export async function checkAppointmentConflict(
  doctorId: string,
  appointmentDate: Date,
  appointmentTime: string,
  tenantId: string
): Promise<AppointmentConflict> {
  console.log(
    "[Appointment] Checking conflict for doctor",
    doctorId,
    "on",
    appointmentDate,
    "at",
    appointmentTime
  );

  // Create date range for the day
  const dayStart = new Date(appointmentDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(appointmentDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Check for existing appointment at the same time
  const existingAppointment = await prisma.appointment.findFirst({
    where: {
      tenantId,
      doctorId,
      appointmentDate: {
        gte: dayStart,
        lte: dayEnd,
      },
      appointmentTime,
      status: {
        in: ["BOOKED", "CONFIRMED", "COMPLETED"],
      },
    },
    select: {
      id: true,
    },
  });

  if (existingAppointment) {
    console.log(
      "[Appointment] Conflict detected with existing appointment",
      existingAppointment.id
    );
    return {
      hasConflict: true,
      message: "Doctor is already booked for this slot",
      existingAppointmentId: existingAppointment.id,
    };
  }

  console.log("[Appointment] No conflict found");
  return { hasConflict: false };
}

/**
 * Get doctor's calendar for a date range
 */
export async function getDoctorCalendar(
  doctorId: string,
  startDate: Date,
  endDate: Date,
  tenantId: string
): Promise<DoctorCalendarData> {
  console.log(
    "[DoctorCalendar] Fetching calendar for doctor",
    doctorId,
    "from",
    startDate,
    "to",
    endDate
  );

  // Fetch doctor info
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      fullName: true,
    },
  });

  if (!doctor) {
    throw new Error("Doctor not found");
  }

  // Fetch appointments for this doctor in date range
  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      doctorId,
      appointmentDate: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        in: ["BOOKED", "CONFIRMED", "COMPLETED"],
      },
    },
    select: {
      id: true,
      appointmentDate: true,
      appointmentTime: true,
    },
  });

  // Generate slots across all days
  const slots: AppointmentSlot[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const timeSlots = generateTimeSlots();

    const bookedTimes = appointments
      .filter(
        (apt) =>
          apt.appointmentDate.toISOString().split("T")[0] === dateStr &&
          apt.appointmentTime
      )
      .map((apt) => apt.appointmentTime);

    timeSlots.forEach((time) => {
      const isBooked = bookedTimes.includes(time);
      slots.push({
        date: new Date(currentDate),
        time,
        doctorId,
        isAvailable: !isBooked,
        appointmentId: isBooked
          ? appointments.find(
              (apt) =>
                apt.appointmentDate.toISOString().split("T")[0] === dateStr &&
                apt.appointmentTime === time
            )?.id
          : undefined,
      });
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    doctorId,
    doctorName: doctor.fullName,
    slots,
    totalSlots: slots.length,
    bookedSlots: slots.filter((s) => !s.isAvailable).length,
    availableSlots: slots.filter((s) => s.isAvailable).length,
  };
}

/**
 * Get multiple doctors' calendars
 */
export async function getMultipleDoctorsCalendar(
  doctorIds: string[],
  startDate: Date,
  endDate: Date,
  tenantId: string
): Promise<DoctorCalendarData[]> {
  const allCalendars: DoctorCalendarData[] = [];

  for (const doctorId of doctorIds) {
    const calendar = await getDoctorCalendar(doctorId, startDate, endDate, tenantId);
    allCalendars.push(calendar);
  }

  return allCalendars;
}

/**
 * Get available doctors for a department
 */
export async function getDoctorsForDepartment(
  departmentId: string,
  tenantId: string
) {
  return prisma.userDepartment.findMany({
    where: {
      tenantId,
      departmentId,
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Create appointment with conflict check
 */
export async function createAppointmentWithConflictCheck(
  data: {
    patientId: string;
    departmentId?: string;
    doctorId?: string;
    appointmentDate: string;
    appointmentTime: string;
    notes?: string;
  },
  tenantId: string,
  userId: string
) {
  console.log("[Appointment] Creating appointment with conflict check", data);

  const appointmentDate = new Date(data.appointmentDate);

  if (!data.appointmentTime) {
    throw new Error("Appointment time is required");
  }

  const appointment = await prisma.$transaction(async (tx) => {
    // If doctor is specified, check for conflicts
    if (data.doctorId) {
      const conflict = await checkAppointmentConflict(
        data.doctorId,
        appointmentDate,
        data.appointmentTime,
        tenantId
      );

      if (conflict.hasConflict) {
        console.error("[Appointment] Conflict detected:", conflict.message);
        throw new Error(conflict.message || "Doctor slot is not available");
      }
    }

    // Generate token number for the day
    const dayStart = new Date(appointmentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(appointmentDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existingAppointments = await tx.appointment.count({
      where: {
        tenantId,
        appointmentDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    const tokenNumber = existingAppointments + 1;

    // Create appointment
    return tx.appointment.create({
      data: {
        patientId: data.patientId,
        departmentId: data.departmentId || null,
        doctorId: data.doctorId || null,
        appointmentDate,
        appointmentTime: data.appointmentTime,
        tokenNumber,
        status: "BOOKED",
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
      },
    });
  });

  // Create audit log
  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "APPOINTMENT",
    entityId: appointment.id,
    action: "CREATE",
    newValue: appointment,
  });

  console.log("[Appointment] Appointment created successfully:", appointment.id);
  return appointment;
}

/**
 * Get appointments by date range and filters
 */
export async function getAppointmentsByDateRange(
  startDate: Date,
  endDate: Date,
  tenantId: string,
  filters?: {
    doctorId?: string;
    departmentId?: string;
    patientId?: string;
    status?: string;
  }
) {
  const where: Prisma.AppointmentWhereInput = {
    tenantId,
    appointmentDate: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (filters?.doctorId) where.doctorId = filters.doctorId;
  if (filters?.departmentId) where.departmentId = filters.departmentId;
  if (filters?.patientId) where.patientId = filters.patientId;
  if (filters?.status) where.status = filters.status;

  return prisma.appointment.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          uhid: true,
          firstName: true,
          lastName: true,
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
    orderBy: [
      { appointmentDate: "asc" },
      { appointmentTime: "asc" },
    ],
  });
}
