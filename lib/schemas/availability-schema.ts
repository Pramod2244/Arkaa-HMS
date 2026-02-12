/**
 * HMS Appointment System - Doctor Availability Schemas
 * 
 * Zod validation schemas for doctor availability management.
 * Supports create, update, query, and bulk operations.
 */

import { z } from "zod";

// ============== ENUMS ==============

export const DayOfWeekEnum = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

export const AvailabilityStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);

// Time format validation (HH:mm)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TimeString = z.string().regex(timeRegex, "Invalid time format. Use HH:mm (e.g., 09:00)");

// ============== CREATE SCHEMA ==============

export const CreateAvailabilitySchema = z.object({
  doctorId: z.string().uuid("Invalid doctor ID"),
  departmentId: z.string().uuid("Invalid department ID"),
  dayOfWeek: DayOfWeekEnum,
  startTime: TimeString,
  endTime: TimeString,
  slotDurationMinutes: z.coerce.number().int().min(5).max(120).default(15),
  maxPatientsPerSlot: z.coerce.number().int().min(1).max(10).default(1),
  maxPatientsPerDay: z.coerce.number().int().min(1).max(200).nullish(),
  allowWalkIn: z.boolean().default(true),
  walkInSlotReservation: z.coerce.number().int().min(0).max(50).default(0),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullish(),
  status: AvailabilityStatusEnum.default("ACTIVE"),
}).refine(
  (data) => {
    const [startH, startM] = data.startTime.split(":").map(Number);
    const [endH, endM] = data.endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return endMinutes > startMinutes;
  },
  { message: "End time must be after start time", path: ["endTime"] }
).refine(
  (data) => {
    if (!data.effectiveFrom || !data.effectiveTo) return true;
    return data.effectiveTo >= data.effectiveFrom;
  },
  { message: "Effective end date must be after start date", path: ["effectiveTo"] }
);

export type CreateAvailabilityInput = z.infer<typeof CreateAvailabilitySchema>;

// ============== UPDATE SCHEMA ==============

export const UpdateAvailabilitySchema = z.object({
  startTime: TimeString.optional(),
  endTime: TimeString.optional(),
  slotDurationMinutes: z.coerce.number().int().min(5).max(120).optional(),
  maxPatientsPerSlot: z.coerce.number().int().min(1).max(10).optional(),
  maxPatientsPerDay: z.coerce.number().int().min(1).max(200).nullish(),
  allowWalkIn: z.boolean().optional(),
  walkInSlotReservation: z.coerce.number().int().min(0).max(50).optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullish(),
  status: AvailabilityStatusEnum.optional(),
  version: z.number().int().min(1, "Version is required for optimistic locking"),
});

export type UpdateAvailabilityInput = z.infer<typeof UpdateAvailabilitySchema>;

// ============== QUERY SCHEMA ==============

export const AvailabilityQuerySchema = z.object({
  doctorId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  dayOfWeek: DayOfWeekEnum.optional(),
  status: AvailabilityStatusEnum.optional(),
  includeExpired: z.coerce.boolean().optional().default(false),
});

export type AvailabilityQueryInput = z.infer<typeof AvailabilityQuerySchema>;

// ============== BULK CREATE SCHEMA ==============
// For creating availability across multiple days at once

export const BulkCreateAvailabilitySchema = z.object({
  doctorId: z.string().uuid("Invalid doctor ID"),
  departmentId: z.string().uuid("Invalid department ID"),
  daysOfWeek: z.array(DayOfWeekEnum).min(1, "Select at least one day"),
  startTime: TimeString,
  endTime: TimeString,
  slotDurationMinutes: z.coerce.number().int().min(5).max(120).default(15),
  maxPatientsPerSlot: z.coerce.number().int().min(1).max(10).default(1),
  maxPatientsPerDay: z.coerce.number().int().min(1).max(200).nullish(),
  allowWalkIn: z.boolean().default(true),
  walkInSlotReservation: z.coerce.number().int().min(0).max(50).default(0),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullish(),
  status: AvailabilityStatusEnum.default("ACTIVE"),
}).refine(
  (data) => {
    const [startH, startM] = data.startTime.split(":").map(Number);
    const [endH, endM] = data.endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return endMinutes > startMinutes;
  },
  { message: "End time must be after start time", path: ["endTime"] }
);

export type BulkCreateAvailabilityInput = z.infer<typeof BulkCreateAvailabilitySchema>;

// ============== SLOT QUERY SCHEMA ==============
// For getting available slots for appointment booking

export const SlotQuerySchema = z.object({
  doctorId: z.string().uuid("Invalid doctor ID"),
  departmentId: z.string().uuid("Invalid department ID").optional(),
  date: z.coerce.date(),
});

export type SlotQueryInput = z.infer<typeof SlotQuerySchema>;

// ============== SLOT RESPONSE TYPE ==============

export interface TimeSlot {
  time: string;           // HH:mm
  endTime: string;        // HH:mm
  maxCapacity: number;    // maxPatientsPerSlot
  bookedCount: number;    // Current bookings
  availableCount: number; // maxCapacity - bookedCount
  isAvailable: boolean;   // availableCount > 0
  isWalkInOnly: boolean;  // For walk-in reserved slots
}

export interface DoctorDaySlots {
  doctorId: string;
  doctorName: string;
  departmentId: string;
  departmentName: string;
  date: string;           // ISO date
  dayOfWeek: string;
  totalCapacity: number;
  totalBooked: number;
  totalAvailable: number;
  maxPatientsPerDay: number | null;
  dailyBookedCount: number;
  isDayFull: boolean;
  allowWalkIn: boolean;
  slots: TimeSlot[];
}

// ============== COPY AVAILABILITY SCHEMA ==============
// For copying availability from one day to others

export const CopyAvailabilitySchema = z.object({
  sourceAvailabilityId: z.string().uuid("Invalid availability ID"),
  targetDays: z.array(DayOfWeekEnum).min(1, "Select at least one target day"),
  replaceExisting: z.boolean().default(false),
});

export type CopyAvailabilityInput = z.infer<typeof CopyAvailabilitySchema>;

// ============== DISABLE DAY SCHEMA ==============

export const DisableDaySchema = z.object({
  doctorId: z.string().uuid("Invalid doctor ID"),
  departmentId: z.string().uuid("Invalid department ID"),
  dayOfWeek: DayOfWeekEnum,
});

export type DisableDayInput = z.infer<typeof DisableDaySchema>;
