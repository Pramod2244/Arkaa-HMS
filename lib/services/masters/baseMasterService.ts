/**
 * HMS Medical Masters - Base Master Service
 * 
 * Abstract base class providing reusable CRUD, audit, and validation
 * functionality for all medical masters.
 * 
 * ALL master services MUST extend this class.
 */

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { MasterStatus } from "@/app/generated/prisma/client";
import {
  BaseMaster,
  MasterQueryOptions,
  MasterListResult,
  UsageCheckResult,
  DeleteAction,
  ImportResult,
  ImportOptions,
  AuditEntry,
  AuditQueryOptions,
  MASTER_ERROR_CODES,
} from "./types";

// ============== BASE MASTER SERVICE ==============

export abstract class BaseMasterService<T extends BaseMaster> {
  /**
   * Entity type name for audit logs
   */
  protected abstract readonly entityType: string;
  
  /**
   * Code prefix for auto-generation (e.g., "DEPT" for departments)
   */
  protected abstract readonly codePrefix: string;
  
  /**
   * Fields that can be updated when entity is in use
   */
  protected abstract readonly editableFieldsWhenUsed: string[];
  
  // ============== ABSTRACT METHODS (Must be implemented) ==============
  
  /**
   * Check if the entity is used elsewhere in the system
   */
  protected abstract checkUsage(tenantId: string, id: string): Promise<UsageCheckResult>;
  
  /**
   * Create the entity in the database
   */
  protected abstract createInDb(
    tenantId: string,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<T>;
  
  /**
   * Update the entity in the database
   */
  protected abstract updateInDb(
    tenantId: string,
    id: string,
    data: Partial<T>
  ): Promise<T>;
  
  /**
   * Find entity by ID
   */
  protected abstract findById(tenantId: string, id: string): Promise<T | null>;
  
  /**
   * Find entity by code
   */
  protected abstract findByCode(tenantId: string, code: string): Promise<T | null>;
  
  /**
   * Find entity by name
   */
  protected abstract findByName(tenantId: string, name: string): Promise<T | null>;
  
  /**
   * List entities with filters
   */
  protected abstract listFromDb(
    tenantId: string,
    options: MasterQueryOptions
  ): Promise<MasterListResult<T>>;
  
  /**
   * Get next sequence number for code generation
   */
  protected abstract getNextSequence(tenantId: string): Promise<number>;
  
  // ============== UTILITY METHODS ==============
  
  /**
   * Generate unique code for the master
   * Format: PREFIX-NAME (e.g., DEPT-CARDIOLOGY)
   */
  protected generateCode(name: string): string {
    const sanitized = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 20);
    return `${this.codePrefix}-${sanitized}`;
  }
  
  /**
   * Validate name uniqueness
   */
  protected async validateNameUnique(
    tenantId: string,
    name: string,
    excludeId?: string
  ): Promise<boolean> {
    const existing = await this.findByName(tenantId, name);
    if (!existing) return true;
    return excludeId ? existing.id === excludeId : false;
  }
  
  /**
   * Validate code uniqueness
   */
  protected async validateCodeUnique(
    tenantId: string,
    code: string,
    excludeId?: string
  ): Promise<boolean> {
    const existing = await this.findByCode(tenantId, code);
    if (!existing) return true;
    return excludeId ? existing.id === excludeId : false;
  }
  
  // ============== PUBLIC CRUD METHODS ==============
  
  /**
   * Create a new master entity
   */
  async create(
    tenantId: string,
    input: {
      name: string;
      description?: string | null;
      status?: MasterStatus;
    },
    userId: string
  ): Promise<{ success: boolean; data?: T; error?: string; errorCode?: string }> {
    // Validate name
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return {
        success: false,
        error: 'Name is required',
        errorCode: MASTER_ERROR_CODES.INVALID_INPUT,
      };
    }
    
    // Check name uniqueness
    const isNameUnique = await this.validateNameUnique(tenantId, trimmedName);
    if (!isNameUnique) {
      return {
        success: false,
        error: `${this.entityType} with this name already exists`,
        errorCode: MASTER_ERROR_CODES.DUPLICATE_NAME,
      };
    }
    
    // Generate code
    const code = this.generateCode(trimmedName);
    
    // Check code uniqueness (in case of name collision after sanitization)
    const isCodeUnique = await this.validateCodeUnique(tenantId, code);
    if (!isCodeUnique) {
      // Append sequence number to make unique
      const seq = await this.getNextSequence(tenantId);
      const uniqueCode = `${code}${seq}`;
      
      const created = await this.createInDb(tenantId, {
        tenantId,
        code: uniqueCode,
        name: trimmedName,
        description: input.description ?? null,
        status: input.status ?? MasterStatus.ACTIVE,
        isDeleted: false,
        version: 1,
        createdBy: userId,
        updatedBy: userId,
      } as Omit<T, 'id' | 'createdAt' | 'updatedAt'>);
      
      // Audit log
      await createAuditLog({
        tenantId,
        performedBy: userId,
        entityType: this.entityType,
        entityId: created.id,
        action: 'CREATE',
        newValue: created,
      });
      
      return { success: true, data: created };
    }
    
    // Create entity
    const created = await this.createInDb(tenantId, {
      tenantId,
      code,
      name: trimmedName,
      description: input.description ?? null,
      status: input.status ?? MasterStatus.ACTIVE,
      isDeleted: false,
      version: 1,
      createdBy: userId,
      updatedBy: userId,
    } as Omit<T, 'id' | 'createdAt' | 'updatedAt'>);
    
    // Audit log
    await createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: this.entityType,
      entityId: created.id,
      action: 'CREATE',
      newValue: created,
    });
    
    return { success: true, data: created };
  }
  
  /**
   * Update an existing master entity
   */
  async update(
    tenantId: string,
    id: string,
    input: {
      name?: string;
      description?: string | null;
      status?: MasterStatus;
      version: number; // Required for optimistic locking
    },
    userId: string
  ): Promise<{ success: boolean; data?: T; error?: string; errorCode?: string }> {
    // Find existing
    const existing = await this.findById(tenantId, id);
    if (!existing) {
      return {
        success: false,
        error: `${this.entityType} not found`,
        errorCode: MASTER_ERROR_CODES.NOT_FOUND,
      };
    }
    
    // Check if deleted
    if (existing.isDeleted) {
      return {
        success: false,
        error: `Cannot update deleted ${this.entityType}`,
        errorCode: MASTER_ERROR_CODES.ALREADY_DELETED,
      };
    }
    
    // Optimistic locking - check version
    if (existing.version !== input.version) {
      return {
        success: false,
        error: `${this.entityType} has been modified by another user. Please refresh and try again.`,
        errorCode: MASTER_ERROR_CODES.VERSION_CONFLICT,
      };
    }
    
    // Check usage to determine editable fields
    const usage = await this.checkUsage(tenantId, id);
    const updateData: Partial<T> = { version: existing.version + 1 } as Partial<T>;
    
    // If used, only allow certain fields to be updated
    if (usage.isUsed) {
      if (input.name && input.name !== existing.name) {
        if (!this.editableFieldsWhenUsed.includes('name')) {
          return {
            success: false,
            error: `Cannot change name of ${this.entityType} that is in use`,
            errorCode: MASTER_ERROR_CODES.CANNOT_DELETE_USED,
          };
        }
      }
    }
    
    // Validate name if changing
    if (input.name && input.name.trim() !== existing.name) {
      const trimmedName = input.name.trim();
      const isNameUnique = await this.validateNameUnique(tenantId, trimmedName, id);
      if (!isNameUnique) {
        return {
          success: false,
          error: `${this.entityType} with this name already exists`,
          errorCode: MASTER_ERROR_CODES.DUPLICATE_NAME,
        };
      }
      (updateData as Record<string, unknown>).name = trimmedName;
    }
    
    // Update description
    if (input.description !== undefined) {
      (updateData as Record<string, unknown>).description = input.description;
    }
    
    // Update status
    if (input.status !== undefined) {
      (updateData as Record<string, unknown>).status = input.status;
    }
    
    // Set updatedBy
    (updateData as Record<string, unknown>).updatedBy = userId;
    
    // Update in DB
    const updated = await this.updateInDb(tenantId, id, updateData);
    
    // Audit log
    await createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: this.entityType,
      entityId: id,
      action: 'UPDATE',
      oldValue: existing,
      newValue: updated,
    });
    
    return { success: true, data: updated };
  }
  
  /**
   * Delete (soft) a master entity
   * If entity is used: only disable (status = INACTIVE)
   * If not used: soft delete (isDeleted = true, status = INACTIVE)
   */
  async delete(
    tenantId: string,
    id: string,
    userId: string
  ): Promise<{ success: boolean; action?: DeleteAction; error?: string; errorCode?: string }> {
    // Find existing
    const existing = await this.findById(tenantId, id);
    if (!existing) {
      return {
        success: false,
        error: `${this.entityType} not found`,
        errorCode: MASTER_ERROR_CODES.NOT_FOUND,
      };
    }
    
    // Check if already deleted
    if (existing.isDeleted) {
      return {
        success: false,
        error: `${this.entityType} is already deleted`,
        errorCode: MASTER_ERROR_CODES.ALREADY_DELETED,
      };
    }
    
    // Check usage
    const usage = await this.checkUsage(tenantId, id);
    
    let action: DeleteAction;
    let updateData: Partial<T>;
    
    if (usage.isUsed) {
      // Entity is used - only disable
      action = DeleteAction.DISABLE_ONLY;
      updateData = {
        status: MasterStatus.INACTIVE,
        version: existing.version + 1,
        updatedBy: userId,
      } as Partial<T>;
    } else {
      // Entity not used - soft delete
      action = DeleteAction.SOFT_DELETE;
      updateData = {
        status: MasterStatus.INACTIVE,
        isDeleted: true,
        version: existing.version + 1,
        updatedBy: userId,
      } as Partial<T>;
    }
    
    // Update in DB
    await this.updateInDb(tenantId, id, updateData);
    
    // Audit log
    await createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: this.entityType,
      entityId: id,
      action: 'DELETE',
      oldValue: existing,
      newValue: { ...existing, ...updateData },
    });
    
    return { success: true, action };
  }
  
  /**
   * Get entity by ID
   */
  async getById(tenantId: string, id: string): Promise<T | null> {
    return this.findById(tenantId, id);
  }
  
  /**
   * List entities with pagination and filters
   */
  async list(tenantId: string, options: MasterQueryOptions = {}): Promise<MasterListResult<T>> {
    return this.listFromDb(tenantId, {
      page: options.page ?? 1,
      limit: options.limit ?? 10,
      search: options.search,
      status: options.status,
      includeDeleted: options.includeDeleted ?? false,
      sortBy: options.sortBy ?? 'name',
      sortOrder: options.sortOrder ?? 'asc',
    });
  }
  
  // ============== AUDIT METHODS ==============
  
  /**
   * Get audit history for an entity
   */
  async getAuditHistory(
    tenantId: string,
    entityId: string,
    options: AuditQueryOptions = {}
  ): Promise<MasterListResult<AuditEntry>> {
    const { page = 1, limit = 10, startDate, endDate, action, performedBy } = options;
    
    const where: Record<string, unknown> = {
      tenantId,
      entityType: this.entityType,
      entityId,
    };
    
    if (startDate || endDate) {
      where.performedAt = {};
      if (startDate) (where.performedAt as Record<string, unknown>).gte = startDate;
      if (endDate) (where.performedAt as Record<string, unknown>).lte = endDate;
    }
    
    if (action) {
      where.action = action;
    }
    
    if (performedBy) {
      where.performedBy = performedBy;
    }
    
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { performedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { fullName: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);
    
    const data: AuditEntry[] = logs.map((log) => ({
      id: log.id,
      action: log.action as 'CREATE' | 'UPDATE' | 'DELETE',
      entityType: log.entityType,
      entityId: log.entityId ?? '',
      oldValue: log.oldValue as Record<string, unknown> | null,
      newValue: log.newValue as Record<string, unknown> | null,
      performedBy: log.performedBy,
      performedAt: log.performedAt,
      performerName: log.user?.fullName ?? 'Unknown',
    }));
    
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
  
  // ============== IMPORT METHODS ==============
  
  /**
   * Validate import data row
   */
  protected validateImportRow(
    row: Record<string, unknown>,
    _rowIndex: number
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Name is required
    if (!row.name || typeof row.name !== 'string' || !row.name.trim()) {
      errors.push('Name is required');
    }
    
    // Status validation (if provided)
    if (row.status && !['ACTIVE', 'INACTIVE'].includes(String(row.status))) {
      errors.push('Status must be ACTIVE or INACTIVE');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * Import multiple records
   */
  async import(
    tenantId: string,
    rows: Record<string, unknown>[],
    userId: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const { dryRun = false } = options;
    const result: ImportResult = {
      totalRows: rows.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      isDryRun: dryRun,
    };
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel rows start at 2 (1 is header)
      
      // Validate row
      const validation = this.validateImportRow(row, i);
      if (!validation.valid) {
        result.errorCount++;
        result.errors.push({
          row: rowNum,
          success: false,
          error: validation.errors.join('; '),
          data: row,
        });
        continue;
      }
      
      // Check for duplicate name
      const name = String(row.name).trim();
      const existingByName = await this.findByName(tenantId, name);
      if (existingByName) {
        result.errorCount++;
        result.errors.push({
          row: rowNum,
          success: false,
          error: `Duplicate name: "${name}" already exists`,
          data: row,
        });
        continue;
      }
      
      // Check for duplicate code (if provided)
      if (row.code) {
        const code = String(row.code).trim().toUpperCase();
        const existingByCode = await this.findByCode(tenantId, code);
        if (existingByCode) {
          result.errorCount++;
          result.errors.push({
            row: rowNum,
            success: false,
            error: `Duplicate code: "${code}" already exists`,
            data: row,
          });
          continue;
        }
      }
      
      // If dry run, don't actually create
      if (dryRun) {
        result.successCount++;
        continue;
      }
      
      // Create record
      try {
        await this.create(
          tenantId,
          {
            name,
            description: row.description ? String(row.description) : null,
            status: row.status === 'INACTIVE' ? MasterStatus.INACTIVE : MasterStatus.ACTIVE,
          },
          userId
        );
        result.successCount++;
      } catch (error) {
        result.errorCount++;
        result.errors.push({
          row: rowNum,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: row,
        });
      }
    }
    
    return result;
  }
  
  // ============== EXPORT METHODS ==============
  
  /**
   * Get data for export
   */
  async getExportData(
    tenantId: string,
    options: { selectedIds?: string[]; includeDeleted?: boolean } = {}
  ): Promise<T[]> {
    const queryOptions: MasterQueryOptions = {
      limit: 10000, // Max export limit
      includeDeleted: options.includeDeleted,
    };
    
    const result = await this.listFromDb(tenantId, queryOptions);
    
    if (options.selectedIds && options.selectedIds.length > 0) {
      return result.data.filter((item) => options.selectedIds!.includes(item.id));
    }
    
    return result.data;
  }
  
  /**
   * Format data for CSV/Excel export
   */
  formatForExport(data: T[]): Record<string, unknown>[] {
    return data.map((item) => ({
      Code: item.code,
      Name: item.name,
      Description: item.description ?? '',
      Status: item.status,
      'Created At': item.createdAt.toISOString(),
      'Updated At': item.updatedAt.toISOString(),
    }));
  }
}

export default BaseMasterService;
