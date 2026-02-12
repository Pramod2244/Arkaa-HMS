import { z } from "zod";

// ============== ENUMS ==============

export const BookingSourceEnum = z.enum(["ONLINE", "RECEPTION", "PHONE", "WALKIN"]);
export const AppointmentStatusEnum = z.enum([
  "BOOKED",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
  "CHECKED_IN",
  "IN_PROGRESS",
  "RESCHEDULED",
]);

// ============== BASIC SCHEMA (Legacy support) ==============

export const AppointmentSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  departmentId: z.string().optional(),
  doctorId: z.string().optional(),
  appointmentDate: z.string().min(1, "Appointment date is required"),
  appointmentTime: z.string().optional(),
  notes: z.string().optional(),
});

export type AppointmentFormData = z.infer<typeof AppointmentSchema>;

// ============== ENHANCED BOOKING SCHEMA ==============

export const CreateAppointmentSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  departmentId: z.string().uuid("Invalid department ID"),
  doctorId: z.string().uuid("Invalid doctor ID"),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  appointmentTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be HH:mm format"),
  slotEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  chiefComplaint: z.string().max(500, "Chief complaint too long").optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
  isWalkIn: z.boolean().default(false),
  bookingSource: BookingSourceEnum.default("RECEPTION"),
}).refine(
  (data) => {
    // Parse the appointment date as local date (not UTC)
    const [year, month, day] = data.appointmentDate.split('-').map(Number);
    const appointmentDate = new Date(year, month - 1, day);
    appointmentDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return appointmentDate >= today;
  },
  { message: "Appointment date cannot be in the past", path: ["appointmentDate"] }
);

export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;

// ============== RESCHEDULE SCHEMA ==============

export const RescheduleAppointmentSchema = z.object({
  appointmentId: z.string().uuid("Invalid appointment ID"),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  newTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be HH:mm format"),
  newSlotEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  newDoctorId: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
}).refine(
  (data) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newDate = new Date(data.newDate);
    return newDate >= today;
  },
  { message: "New date cannot be in the past", path: ["newDate"] }
);

export type RescheduleAppointmentInput = z.infer<typeof RescheduleAppointmentSchema>;

// ============== CANCEL SCHEMA ==============

export const CancelAppointmentSchema = z.object({
  appointmentId: z.string().uuid("Invalid appointment ID"),
  cancelReason: z.string().min(1, "Cancel reason is required").max(500),
});

export type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;

// ============== CHECK-IN SCHEMA ==============

export const CheckInAppointmentSchema = z.object({
  appointmentId: z.string().uuid("Invalid appointment ID"),
});

export type CheckInAppointmentInput = z.infer<typeof CheckInAppointmentSchema>;

// ============== QUERY SCHEMA ==============

export const AppointmentQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  patientId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  status: AppointmentStatusEnum.optional(),
  isWalkIn: z.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type AppointmentQueryInput = z.infer<typeof AppointmentQuerySchema>;

// ============== WALK-IN SCHEMA ==============

export const WalkInAppointmentSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  departmentId: z.string().uuid("Invalid department ID"),
  doctorId: z.string().uuid("Invalid doctor ID"),
  chiefComplaint: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export type WalkInAppointmentInput = z.infer<typeof WalkInAppointmentSchema>;

// ============== RESPONSE TYPES ==============

export interface AppointmentWithRelations {
  id: string;
  tokenNumber: number | null;
  patientId: string;
  departmentId: string | null;
  doctorId: string | null;
  doctorMasterId: string | null;
  appointmentDate: Date;
  appointmentTime: string | null;
  slotEndTime: string | null;
  status: string;
  isWalkIn: boolean;
  bookingSource: string | null;
  chiefComplaint: string | null;
  notes: string | null;
  checkedInAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  patient: {
    id: string;
    uhid: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
  };
  doctor?: {
    id: string;
    fullName: string;
  } | null;
  doctorMaster?: {
    id: string;
    doctorCode: string;
    fullName: string;
  } | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
}