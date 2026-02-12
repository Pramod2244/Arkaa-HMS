/**
 * HMS Medical Masters - Department Schema
 * 
 * Zod validation schemas for department master CRUD operations.
 */

import { z } from "zod";

// ============== ENUMS ==============

export const MasterStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);

// ============== CREATE SCHEMA ==============

export const CreateDepartmentSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .trim()
    .nullable()
    .optional(),
  status: MasterStatusEnum.optional().default("ACTIVE"),
});

export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;

// ============== UPDATE SCHEMA ==============

export const UpdateDepartmentSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .trim()
    .nullable()
    .optional(),
  status: MasterStatusEnum.optional(),
  version: z.number().int().min(1, "Version is required for update"),
});

export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>;

// ============== RESTRICTED UPDATE SCHEMA ==============
// For system departments: ONLY description and status can be modified
// Code and Name are READ-ONLY

export const UpdateDepartmentRestrictedSchema = z.object({
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .trim()
    .nullable()
    .optional(),
  status: MasterStatusEnum.optional(),
  version: z.number().int().min(1, "Version is required for update"),
});

export type UpdateDepartmentRestrictedInput = z.infer<typeof UpdateDepartmentRestrictedSchema>;

// ============== QUERY SCHEMA ==============

// Helper to filter out "ALL" and transform to undefined
const statusFilterSchema = z.string().nullish().transform(val => {
  if (!val || val === "ALL") return undefined;
  if (val === "ACTIVE" || val === "INACTIVE") return val as "ACTIVE" | "INACTIVE";
  return undefined;
});

export const DepartmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().trim().nullish().transform(val => val || undefined),
  status: statusFilterSchema,
  includeDeleted: z.coerce.boolean().optional().default(false),
  sortBy: z.enum(["name", "code", "status", "createdAt", "updatedAt"]).optional().default("name"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type DepartmentQueryInput = z.infer<typeof DepartmentQuerySchema>;

// ============== IMPORT SCHEMA ==============

export const ImportDepartmentRowSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  description: z
    .string()
    .max(500)
    .trim()
    .nullable()
    .optional()
    .transform((v) => v || null),
  status: MasterStatusEnum.optional().default("ACTIVE"),
});

export const ImportDepartmentSchema = z.object({
  rows: z.array(ImportDepartmentRowSchema).min(1, "At least one row is required"),
  dryRun: z.boolean().optional().default(false),
});

export type ImportDepartmentInput = z.infer<typeof ImportDepartmentSchema>;

// ============== EXPORT SCHEMA ==============

export const ExportDepartmentSchema = z.object({
  format: z.enum(["csv", "excel", "json"]),
  selectedIds: z.array(z.string().uuid()).optional(),
  includeDeleted: z.boolean().optional().default(false),
});

export type ExportDepartmentInput = z.infer<typeof ExportDepartmentSchema>;

// ============== BULK ACTION SCHEMA ==============

export const BulkStatusUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "At least one ID is required"),
  status: MasterStatusEnum,
});

export type BulkStatusUpdateInput = z.infer<typeof BulkStatusUpdateSchema>;

// ============== AUDIT QUERY SCHEMA ==============

export const AuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  startDate: z.string().nullish().transform(val => val || undefined).pipe(z.coerce.date().optional()),
  endDate: z.string().nullish().transform(val => val || undefined).pipe(z.coerce.date().optional()),
  action: z.string().nullish().transform(val => val || undefined).pipe(z.enum(["CREATE", "UPDATE", "DELETE"]).optional()),
  performedBy: z.string().nullish().transform(val => val || undefined).pipe(z.string().uuid().optional()),
});

export type AuditQueryInput = z.infer<typeof AuditQuerySchema>;
