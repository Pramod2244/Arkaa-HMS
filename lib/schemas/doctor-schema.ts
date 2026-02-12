/**
 * HMS Medical Masters - Doctor Schema
 * 
 * Zod validation schemas for doctor master CRUD operations.
 */

import { z } from "zod";

// ============== ENUMS ==============

export const GenderEnum = z.enum(["MALE", "FEMALE", "OTHER"]);
export const DoctorStatusEnum = z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE"]);

// ============== CREATE SCHEMA ==============

export const CreateDoctorSchema = z.object({
  // Identity
  userId: z.string().uuid("Invalid user ID"),
  registrationNumber: z
    .string()
    .max(50, "Registration number must be 50 characters or less")
    .optional()
    .nullable(),
  registrationAuthority: z
    .string()
    .max(100, "Registration authority must be 100 characters or less")
    .optional()
    .nullable(),
  registrationDate: z.coerce.date().optional().nullable(),

  // Personal Info
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(100, "Full name must be 100 characters or less")
    .trim(),
  gender: GenderEnum,
  dateOfBirth: z.coerce.date().optional().nullable(),
  mobile: z
    .string()
    .min(10, "Mobile number must be at least 10 digits")
    .max(15, "Mobile number must be 15 digits or less")
    .regex(/^[0-9+\-\s]+$/, "Invalid mobile number format"),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .nullable()
    .or(z.literal("")),

  // Professional Info
  qualifications: z
    .array(z.string().trim())
    .min(1, "At least one qualification is required"),
  specializations: z
    .array(z.string().trim())
    .default([]),
  yearsOfExperience: z
    .number()
    .int()
    .min(0, "Years of experience cannot be negative")
    .max(70, "Years of experience seems too high")
    .optional()
    .nullable(),
  consultationFee: z
    .number()
    .min(0, "Consultation fee cannot be negative")
    .optional()
    .nullable(),
  followUpFee: z
    .number()
    .min(0, "Follow-up fee cannot be negative")
    .optional()
    .nullable(),

  // Department Mapping
  primaryDepartmentId: z.string().uuid("Invalid primary department ID"),
  departmentIds: z
    .array(z.string().uuid())
    .min(1, "At least one department is required"),

  // Status & Availability
  status: DoctorStatusEnum.optional().default("ACTIVE"),
  isSchedulable: z.boolean().optional().default(true),
  allowWalkIn: z.boolean().optional().default(true),
});

export type CreateDoctorInput = z.infer<typeof CreateDoctorSchema>;

// ============== UPDATE SCHEMA ==============

export const UpdateDoctorSchema = z.object({
  // Registration (can be updated)
  registrationNumber: z
    .string()
    .max(50, "Registration number must be 50 characters or less")
    .optional()
    .nullable(),
  registrationAuthority: z
    .string()
    .max(100, "Registration authority must be 100 characters or less")
    .optional()
    .nullable(),
  registrationDate: z.coerce.date().optional().nullable(),

  // Personal Info
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(100, "Full name must be 100 characters or less")
    .trim()
    .optional(),
  gender: GenderEnum.optional(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  mobile: z
    .string()
    .min(10, "Mobile number must be at least 10 digits")
    .max(15, "Mobile number must be 15 digits or less")
    .regex(/^[0-9+\-\s]+$/, "Invalid mobile number format")
    .optional(),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .nullable()
    .or(z.literal("")),

  // Professional Info
  qualifications: z
    .array(z.string().trim())
    .min(1, "At least one qualification is required")
    .optional(),
  specializations: z
    .array(z.string().trim())
    .optional(),
  yearsOfExperience: z
    .number()
    .int()
    .min(0, "Years of experience cannot be negative")
    .max(70, "Years of experience seems too high")
    .optional()
    .nullable(),
  consultationFee: z
    .number()
    .min(0, "Consultation fee cannot be negative")
    .optional()
    .nullable(),
  followUpFee: z
    .number()
    .min(0, "Follow-up fee cannot be negative")
    .optional()
    .nullable(),

  // Department Mapping (restricted if doctor has visits)
  primaryDepartmentId: z.string().uuid("Invalid primary department ID").optional(),
  departmentIds: z
    .array(z.string().uuid())
    .min(1, "At least one department is required")
    .optional(),

  // Status & Availability
  status: DoctorStatusEnum.optional(),
  isSchedulable: z.boolean().optional(),
  allowWalkIn: z.boolean().optional(),

  // Optimistic locking
  version: z.number().int().min(1, "Version is required for update"),
});

export type UpdateDoctorInput = z.infer<typeof UpdateDoctorSchema>;

// ============== QUERY SCHEMA ==============

const statusFilterSchema = z.string().nullish().transform(val => {
  if (!val || val === "ALL") return undefined;
  if (val === "ACTIVE" || val === "INACTIVE" || val === "ON_LEAVE") {
    return val as "ACTIVE" | "INACTIVE" | "ON_LEAVE";
  }
  return undefined;
});

export const DoctorQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().trim().nullish().transform(val => val || undefined),
  status: statusFilterSchema,
  departmentId: z.string().uuid().nullish().transform(val => val || undefined),
  primaryDepartmentId: z.string().uuid().nullish().transform(val => val || undefined),
  isSchedulable: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().optional().default(false),
  sortBy: z.enum([
    "fullName", 
    "doctorCode", 
    "status", 
    "primaryDepartment",
    "createdAt", 
    "updatedAt"
  ]).optional().default("fullName"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type DoctorQueryInput = z.infer<typeof DoctorQuerySchema>;

// ============== DEPARTMENT FILTER SCHEMA ==============

export const DoctorsByDepartmentSchema = z.object({
  departmentId: z.string().uuid("Invalid department ID"),
  status: DoctorStatusEnum.optional(),
  isSchedulable: z.boolean().optional(),
  allowWalkIn: z.boolean().optional(),
});

export type DoctorsByDepartmentInput = z.infer<typeof DoctorsByDepartmentSchema>;

// ============== IMPORT SCHEMA ==============

export const ImportDoctorRowSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(100, "Full name must be 100 characters or less")
    .trim(),
  mobile: z
    .string()
    .min(10, "Mobile number must be at least 10 digits")
    .max(15, "Mobile number must be 15 digits or less"),
  email: z.string().email("Invalid email address").optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  registrationNumber: z.string().optional().nullable(),
  qualifications: z.string().optional(), // Comma-separated
  specializations: z.string().optional(), // Comma-separated
  primaryDepartmentCode: z.string().min(1, "Primary department code is required"),
  departmentCodes: z.string().optional(), // Comma-separated additional departments
  consultationFee: z.coerce.number().optional().nullable(),
  followUpFee: z.coerce.number().optional().nullable(),
  yearsOfExperience: z.coerce.number().int().optional().nullable(),
});

export type ImportDoctorRow = z.infer<typeof ImportDoctorRowSchema>;

// ============== AUDIT QUERY SCHEMA ==============

export const DoctorAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  action: z.string().nullish().transform(val => val || undefined),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type DoctorAuditQueryInput = z.infer<typeof DoctorAuditQuerySchema>;

// ============== SCHEDULE SCHEMA ==============

export const DoctorScheduleUpdateSchema = z.object({
  isSchedulable: z.boolean(),
  allowWalkIn: z.boolean(),
  version: z.number().int().min(1, "Version is required"),
});

export type DoctorScheduleUpdateInput = z.infer<typeof DoctorScheduleUpdateSchema>;

// ============== STATUS UPDATE SCHEMA ==============

export const DoctorStatusUpdateSchema = z.object({
  status: DoctorStatusEnum,
  version: z.number().int().min(1, "Version is required"),
});

export type DoctorStatusUpdateInput = z.infer<typeof DoctorStatusUpdateSchema>;
