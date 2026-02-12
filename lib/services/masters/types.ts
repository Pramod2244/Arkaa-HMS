/**
 * HMS Medical Masters - Common Types
 * 
 * This file defines the baseline structure for all medical masters.
 * ALL masters MUST follow this structure for consistency.
 */

import { MasterStatus } from "@/app/generated/prisma/client";

// ============== BASE MASTER INTERFACE ==============

/**
 * BaseMaster - Common fields for all medical masters
 * Every master entity MUST include these fields
 */
export interface BaseMaster {
  id: string;
  tenantId: string;
  code: string;       // Unique, human-readable, immutable
  name: string;       // Unique per tenant
  description: string | null;
  status: MasterStatus;
  isDeleted: boolean;
  version: number;    // Optimistic locking
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

// ============== CRUD INPUT TYPES ==============

export interface CreateMasterInput {
  name: string;
  description?: string | null;
  status?: MasterStatus;
}

export interface UpdateMasterInput {
  name?: string;
  description?: string | null;
  status?: MasterStatus;
  version: number;  // Required for optimistic locking
}

// ============== QUERY OPTIONS ==============

export interface MasterQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: MasterStatus;
  includeDeleted?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MasterListResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ============== IMPORT/EXPORT TYPES ==============

export type ExportFormat = 'csv' | 'excel' | 'json';

export interface ImportRowResult {
  row: number;
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: ImportRowResult[];
  isDryRun: boolean;
}

export interface ImportOptions {
  dryRun?: boolean;
  skipDuplicates?: boolean;
}

export interface ExportOptions {
  format: ExportFormat;
  selectedIds?: string[];
  includeDeleted?: boolean;
}

// ============== VALIDATION TYPES ==============

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// ============== DELETE/USAGE TYPES ==============

export interface UsageCheckResult {
  isUsed: boolean;
  usageCount: number;
  usedIn: {
    entity: string;
    count: number;
  }[];
}

export enum DeleteAction {
  SOFT_DELETE = 'SOFT_DELETE',       // isDeleted = true, status = INACTIVE
  DISABLE_ONLY = 'DISABLE_ONLY',     // status = INACTIVE (when used)
}

// ============== AUDIT TYPES ==============

export interface AuditEntry {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  performedBy: string | null;
  performedAt: Date;
  performerName?: string;
}

export interface AuditQueryOptions {
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  action?: string;
  performedBy?: string;
}

// ============== MASTER PERMISSIONS ==============

export const MASTER_PERMISSIONS = {
  // Department Master
  DEPARTMENT_VIEW: 'DEPARTMENT_VIEW',
  DEPARTMENT_CREATE: 'DEPARTMENT_CREATE',
  DEPARTMENT_UPDATE: 'DEPARTMENT_EDIT',  // Maps to DEPARTMENT_EDIT in DB
  DEPARTMENT_DELETE: 'DEPARTMENT_DELETE',
  DEPARTMENT_IMPORT: 'DEPARTMENT_IMPORT',
  DEPARTMENT_EXPORT: 'DEPARTMENT_EXPORT',
  
  // Doctor Master (future)
  DOCTOR_VIEW: 'DOCTOR_VIEW',
  DOCTOR_CREATE: 'DOCTOR_CREATE',
  DOCTOR_UPDATE: 'DOCTOR_EDIT',  // Maps to DOCTOR_EDIT in DB
  DOCTOR_DELETE: 'DOCTOR_DELETE',
  DOCTOR_IMPORT: 'DOCTOR_IMPORT',
  DOCTOR_EXPORT: 'DOCTOR_EXPORT',
  
  // Generic Master Admin (Super Admin)
  MASTER_ADMIN: 'MASTER_ADMIN',  // Full access to all masters
} as const;

// Role-Permission mapping for masters
export const MASTER_ROLE_PERMISSIONS: Record<string, string[]> = {
  // Super Admin - Full access
  SUPER_ADMIN: Object.values(MASTER_PERMISSIONS),
  
  // Hospital Admin - CRUD + Import
  ADMIN: [
    MASTER_PERMISSIONS.DEPARTMENT_VIEW,
    MASTER_PERMISSIONS.DEPARTMENT_CREATE,
    MASTER_PERMISSIONS.DEPARTMENT_UPDATE,
    MASTER_PERMISSIONS.DEPARTMENT_DELETE,
    MASTER_PERMISSIONS.DEPARTMENT_IMPORT,
    MASTER_PERMISSIONS.DEPARTMENT_EXPORT,
    MASTER_PERMISSIONS.DOCTOR_VIEW,
    MASTER_PERMISSIONS.DOCTOR_CREATE,
    MASTER_PERMISSIONS.DOCTOR_UPDATE,
    MASTER_PERMISSIONS.DOCTOR_DELETE,
    MASTER_PERMISSIONS.DOCTOR_IMPORT,
    MASTER_PERMISSIONS.DOCTOR_EXPORT,
  ],
  
  // Staff - Read only
  RECEPTIONIST: [
    MASTER_PERMISSIONS.DEPARTMENT_VIEW,
    MASTER_PERMISSIONS.DOCTOR_VIEW,
  ],
  
  // Doctor - Read limited
  DOCTOR: [
    MASTER_PERMISSIONS.DEPARTMENT_VIEW,
    MASTER_PERMISSIONS.DOCTOR_VIEW,
  ],
};

// ============== ERROR CODES ==============

export const MASTER_ERROR_CODES = {
  // Validation errors
  INVALID_INPUT: 'MASTER_INVALID_INPUT',
  DUPLICATE_CODE: 'MASTER_DUPLICATE_CODE',
  DUPLICATE_NAME: 'MASTER_DUPLICATE_NAME',
  
  // Business rule errors
  CODE_IMMUTABLE: 'MASTER_CODE_IMMUTABLE',
  CANNOT_DELETE_USED: 'MASTER_CANNOT_DELETE_USED',
  VERSION_CONFLICT: 'MASTER_VERSION_CONFLICT',
  NOT_FOUND: 'MASTER_NOT_FOUND',
  ALREADY_DELETED: 'MASTER_ALREADY_DELETED',
  
  // Permission errors
  ACCESS_DENIED: 'MASTER_ACCESS_DENIED',
  
  // Import errors
  IMPORT_VALIDATION_FAILED: 'MASTER_IMPORT_VALIDATION_FAILED',
  IMPORT_PARTIAL_SUCCESS: 'MASTER_IMPORT_PARTIAL_SUCCESS',
} as const;
