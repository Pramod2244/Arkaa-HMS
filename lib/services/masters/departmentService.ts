/**
 * HMS Medical Masters - Department Service
 * 
 * Implements department-specific business logic extending the base master service.
 * Handles department CRUD, usage validation, and audit logging.
 * 
 * IMPORTANT: Departments are system masters.
 * - They are seeded automatically for each tenant
 * - Admin can only ACTIVATE/DEACTIVATE and edit description
 * - Cannot create, delete, or change code/name
 */

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { MasterStatus, Department } from "@/app/generated/prisma/client";
import { BaseMasterService } from "./baseMasterService";
import {
  BaseMaster,
  MasterQueryOptions,
  MasterListResult,
  UsageCheckResult,
  MASTER_ERROR_CODES,
} from "./types";

// ============== DEPARTMENT ENTITY TYPE ==============

// Department extends BaseMaster with same fields
// This type alias provides clear distinction for department operations
export type DepartmentMaster = BaseMaster;

// ============== DEPARTMENT SERVICE ==============

class DepartmentService extends BaseMasterService<DepartmentMaster> {
  protected readonly entityType = 'DEPARTMENT';
  protected readonly codePrefix = 'DEPT';
  
  // When department is used, only description and status can be changed
  protected readonly editableFieldsWhenUsed = ['description', 'status'];
  
  // ============== USAGE CHECK ==============
  
  /**
   * Check if department is used in appointments, visits, or user assignments
   */
  protected async checkUsage(tenantId: string, id: string): Promise<UsageCheckResult> {
    const [appointmentCount, visitCount, userAssignmentCount] = await Promise.all([
      prisma.appointment.count({
        where: { tenantId, departmentId: id },
      }),
      prisma.visit.count({
        where: { tenantId, departmentId: id },
      }),
      prisma.userDepartment.count({
        where: { tenantId, departmentId: id, isActive: true },
      }),
    ]);
    
    const usedIn: { entity: string; count: number }[] = [];
    
    if (appointmentCount > 0) {
      usedIn.push({ entity: 'Appointments', count: appointmentCount });
    }
    if (visitCount > 0) {
      usedIn.push({ entity: 'Visits', count: visitCount });
    }
    if (userAssignmentCount > 0) {
      usedIn.push({ entity: 'User Assignments', count: userAssignmentCount });
    }
    
    return {
      isUsed: usedIn.length > 0,
      usageCount: appointmentCount + visitCount + userAssignmentCount,
      usedIn,
    };
  }
  
  // ============== DATABASE OPERATIONS ==============
  
  protected async createInDb(
    tenantId: string,
    data: Omit<DepartmentMaster, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DepartmentMaster> {
    const department = await prisma.department.create({
      data: {
        tenantId: data.tenantId,
        code: data.code,
        name: data.name,
        description: data.description,
        status: data.status,
        isDeleted: data.isDeleted,
        version: data.version,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      },
    });
    
    return this.mapToDepartmentMaster(department);
  }
  
  protected async updateInDb(
    tenantId: string,
    id: string,
    data: Partial<DepartmentMaster>
  ): Promise<DepartmentMaster> {
    const department = await prisma.department.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        status: data.status,
        isDeleted: data.isDeleted,
        version: data.version,
        updatedBy: data.updatedBy,
      },
    });
    
    return this.mapToDepartmentMaster(department);
  }
  
  protected async findById(tenantId: string, id: string): Promise<DepartmentMaster | null> {
    const department = await prisma.department.findFirst({
      where: { id, tenantId },
    });
    
    return department ? this.mapToDepartmentMaster(department) : null;
  }
  
  protected async findByCode(tenantId: string, code: string): Promise<DepartmentMaster | null> {
    const department = await prisma.department.findFirst({
      where: { tenantId, code },
    });
    
    return department ? this.mapToDepartmentMaster(department) : null;
  }
  
  protected async findByName(tenantId: string, name: string): Promise<DepartmentMaster | null> {
    const department = await prisma.department.findFirst({
      where: { 
        tenantId, 
        name: { equals: name, mode: 'insensitive' },
      },
    });
    
    return department ? this.mapToDepartmentMaster(department) : null;
  }
  
  protected async listFromDb(
    tenantId: string,
    options: MasterQueryOptions
  ): Promise<MasterListResult<DepartmentMaster>> {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      includeDeleted = false,
      sortBy = 'name',
      sortOrder = 'asc',
    } = options;
    
    // Build where clause
    const where: Record<string, unknown> = { tenantId };
    
    if (!includeDeleted) {
      where.isDeleted = false;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Build order by
    const orderBy: Record<string, string> = {};
    if (['name', 'code', 'status', 'createdAt', 'updatedAt'].includes(sortBy)) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.name = 'asc';
    }
    
    // Execute query
    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.department.count({ where }),
    ]);
    
    return {
      data: departments.map((d) => this.mapToDepartmentMaster(d)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
  
  protected async getNextSequence(tenantId: string): Promise<number> {
    const count = await prisma.department.count({ where: { tenantId } });
    return count + 1;
  }
  
  // ============== HELPER METHODS ==============
  
  private mapToDepartmentMaster(department: Department): DepartmentMaster {
    return {
      id: department.id,
      tenantId: department.tenantId,
      code: department.code,
      name: department.name,
      description: department.description,
      status: department.status,
      isDeleted: department.isDeleted,
      version: department.version,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
      createdBy: department.createdBy,
      updatedBy: department.updatedBy,
    };
  }
  
  // ============== DEPARTMENT-SPECIFIC METHODS ==============
  
  /**
   * Update department with RESTRICTED fields only (description & status)
   * This is the ONLY update method that should be used for system departments.
   * Code and Name are READ-ONLY and cannot be changed.
   */
  async updateRestricted(
    tenantId: string,
    id: string,
    input: {
      description?: string | null;
      status?: MasterStatus;
      version: number;
    },
    userId: string
  ): Promise<{ success: boolean; data?: DepartmentMaster; error?: string; errorCode?: string }> {
    // Find existing department
    const existing = await this.findById(tenantId, id);
    if (!existing) {
      return {
        success: false,
        error: 'Department not found',
        errorCode: MASTER_ERROR_CODES.NOT_FOUND,
      };
    }

    // Check if deleted
    if (existing.isDeleted) {
      return {
        success: false,
        error: 'Cannot update deleted department',
        errorCode: MASTER_ERROR_CODES.ALREADY_DELETED,
      };
    }

    // Optimistic locking - check version
    if (existing.version !== input.version) {
      return {
        success: false,
        error: 'Department has been modified by another user. Please refresh and try again.',
        errorCode: MASTER_ERROR_CODES.VERSION_CONFLICT,
      };
    }

    // Build update data - ONLY description and status allowed
    const updateData: Partial<DepartmentMaster> = {
      version: existing.version + 1,
      updatedBy: userId,
    };

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    // Update in DB
    const updated = await this.updateInDb(tenantId, id, updateData);

    // MANDATORY: Write audit log for every update
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
   * Get all active departments for dropdown/selection
   */
  async getActiveDepartments(tenantId: string): Promise<DepartmentMaster[]> {
    const result = await this.listFromDb(tenantId, {
      status: MasterStatus.ACTIVE,
      includeDeleted: false,
      limit: 1000,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    
    return result.data;
  }
  
  /**
   * Get department with usage statistics
   */
  async getDepartmentWithStats(tenantId: string, id: string): Promise<{
    department: DepartmentMaster | null;
    stats: UsageCheckResult;
  }> {
    const [department, stats] = await Promise.all([
      this.findById(tenantId, id),
      this.checkUsage(tenantId, id),
    ]);
    
    return { department, stats };
  }
  
  /**
   * Bulk update department status
   */
  async bulkUpdateStatus(
    tenantId: string,
    ids: string[],
    status: MasterStatus,
    userId: string
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    
    for (const id of ids) {
      const existing = await this.findById(tenantId, id);
      if (!existing) {
        failed++;
        errors.push(`Department ${id} not found`);
        continue;
      }
      
      const result = await this.update(
        tenantId,
        id,
        { status, version: existing.version },
        userId
      );
      
      if (result.success) {
        success++;
      } else {
        failed++;
        errors.push(result.error ?? `Failed to update ${id}`);
      }
    }
    
    return { success, failed, errors };
  }
  
  /**
   * Check if department can be safely deleted (not used anywhere)
   */
  async canDelete(tenantId: string, id: string): Promise<{
    canDelete: boolean;
    canDisable: boolean;
    reason?: string;
    usage?: UsageCheckResult;
  }> {
    const usage = await this.checkUsage(tenantId, id);
    
    if (!usage.isUsed) {
      return { canDelete: true, canDisable: true, usage };
    }
    
    // Build reason string
    const usageDetails = usage.usedIn
      .map((u) => `${u.count} ${u.entity}`)
      .join(', ');
    
    return {
      canDelete: false,
      canDisable: true,
      reason: `Department is in use by ${usageDetails}. It will be disabled instead of deleted.`,
      usage,
    };
  }
  
  /**
   * Get departments for import template
   */
  getImportTemplate(): { columns: string[]; sampleRow: Record<string, string> } {
    return {
      columns: ['name', 'description', 'status'],
      sampleRow: {
        name: 'Cardiology',
        description: 'Heart and cardiovascular care department',
        status: 'ACTIVE',
      },
    };
  }
}

// Singleton instance
export const departmentService = new DepartmentService();

export default departmentService;
