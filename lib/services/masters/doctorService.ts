/**
 * HMS Medical Masters - Doctor Service
 * 
 * Business logic for Doctor master operations.
 * Handles CRUD, department mapping, and audit logging.
 */

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { 
  Doctor, 
  DoctorStatus, 
  Gender,
  Prisma 
} from "@/app/generated/prisma/client";
import { 
  CreateDoctorInput, 
  UpdateDoctorInput, 
  DoctorQueryInput 
} from "@/lib/schemas/doctor-schema";

// ============== TYPES ==============

export interface DoctorMaster extends Doctor {
  primaryDepartment?: {
    id: string;
    code: string;
    name: string;
  };
  departments?: {
    id: string;
    departmentId: string;
    isPrimary: boolean;
    department: {
      id: string;
      code: string;
      name: string;
    };
  }[];
  user?: {
    id: string;
    email: string;
    fullName: string;
    isActive: boolean;
  };
}

export interface DoctorListResult {
  data: DoctorMaster[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface DoctorUsageStats {
  isUsed: boolean;
  usageCount: number;
  appointments: number;
  visits: number;
  consultations: number;
  prescriptions: number;
}

// ============== ERROR CODES ==============

export const DOCTOR_ERROR_CODES = {
  NOT_FOUND: "DOCTOR_NOT_FOUND",
  ALREADY_EXISTS: "DOCTOR_ALREADY_EXISTS",
  USER_ALREADY_DOCTOR: "USER_ALREADY_DOCTOR",
  INVALID_INPUT: "INVALID_INPUT",
  VERSION_CONFLICT: "VERSION_CONFLICT",
  ALREADY_DELETED: "ALREADY_DELETED",
  HAS_VISITS: "HAS_VISITS",
  DEPARTMENT_NOT_FOUND: "DEPARTMENT_NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  PRIMARY_DEPT_CHANGE_NOT_ALLOWED: "PRIMARY_DEPT_CHANGE_NOT_ALLOWED",
} as const;

// ============== DOCTOR SERVICE CLASS ==============

class DoctorService {
  private entityType = "DOCTOR";

  // ============== CODE GENERATION ==============

  private async generateDoctorCode(tenantId: string): Promise<string> {
    const count = await prisma.doctor.count({ where: { tenantId } });
    const sequence = (count + 1).toString().padStart(5, "0");
    return `DOC-${sequence}`;
  }

  // ============== CREATE ==============

  async create(
    tenantId: string,
    input: CreateDoctorInput,
    userId: string
  ): Promise<{ success: boolean; data?: DoctorMaster; error?: string; errorCode?: string }> {
    try {
      // 1. Verify user exists and is not already a doctor
      const user = await prisma.user.findFirst({
        where: { id: input.userId, tenantId },
      });

      if (!user) {
        return {
          success: false,
          error: "User not found",
          errorCode: DOCTOR_ERROR_CODES.USER_NOT_FOUND,
        };
      }

      // Check if user already has a doctor profile
      const existingDoctor = await prisma.doctor.findFirst({
        where: { userId: input.userId, tenantId },
      });

      if (existingDoctor) {
        return {
          success: false,
          error: "This user already has a doctor profile",
          errorCode: DOCTOR_ERROR_CODES.USER_ALREADY_DOCTOR,
        };
      }

      // 2. Verify primary department exists
      const primaryDept = await prisma.department.findFirst({
        where: { 
          id: input.primaryDepartmentId, 
          tenantId,
          isDeleted: false,
        },
      });

      if (!primaryDept) {
        return {
          success: false,
          error: "Primary department not found",
          errorCode: DOCTOR_ERROR_CODES.DEPARTMENT_NOT_FOUND,
        };
      }

      // 3. Verify all departments exist
      const departments = await prisma.department.findMany({
        where: {
          id: { in: input.departmentIds },
          tenantId,
          isDeleted: false,
        },
      });

      if (departments.length !== input.departmentIds.length) {
        return {
          success: false,
          error: "One or more departments not found",
          errorCode: DOCTOR_ERROR_CODES.DEPARTMENT_NOT_FOUND,
        };
      }

      // 4. Generate doctor code
      const doctorCode = await this.generateDoctorCode(tenantId);

      // 5. Create doctor with department mappings
      const doctor = await prisma.doctor.create({
        data: {
          tenantId,
          doctorCode,
          userId: input.userId,
          registrationNumber: input.registrationNumber,
          registrationAuthority: input.registrationAuthority,
          registrationDate: input.registrationDate,
          fullName: input.fullName,
          gender: input.gender as Gender,
          dateOfBirth: input.dateOfBirth,
          mobile: input.mobile,
          email: input.email || null,
          qualifications: input.qualifications,
          specializations: input.specializations || [],
          yearsOfExperience: input.yearsOfExperience,
          consultationFee: input.consultationFee,
          followUpFee: input.followUpFee,
          primaryDepartmentId: input.primaryDepartmentId,
          status: (input.status || "ACTIVE") as DoctorStatus,
          isSchedulable: input.isSchedulable ?? true,
          allowWalkIn: input.allowWalkIn ?? true,
          createdBy: userId,
          departments: {
            create: input.departmentIds.map((deptId) => ({
              tenantId,
              departmentId: deptId,
              isPrimary: deptId === input.primaryDepartmentId,
            })),
          },
        },
        include: {
          primaryDepartment: {
            select: { id: true, code: true, name: true },
          },
          departments: {
            include: {
              department: {
                select: { id: true, code: true, name: true },
              },
            },
          },
          user: {
            select: { id: true, email: true, fullName: true, isActive: true },
          },
        },
      });

      // 6. Create audit log
      await createAuditLog({
        tenantId,
        performedBy: userId,
        entityType: this.entityType,
        entityId: doctor.id,
        action: "CREATE",
        newValue: doctor,
      });

      return { success: true, data: doctor as DoctorMaster };
    } catch (error) {
      console.error("DoctorService.create error:", error);
      throw error;
    }
  }

  // ============== GET BY ID ==============

  async getById(
    tenantId: string,
    id: string
  ): Promise<DoctorMaster | null> {
    const doctor = await prisma.doctor.findFirst({
      where: { id, tenantId },
      include: {
        primaryDepartment: {
          select: { id: true, code: true, name: true },
        },
        departments: {
          include: {
            department: {
              select: { id: true, code: true, name: true },
            },
          },
        },
        user: {
          select: { id: true, email: true, fullName: true, isActive: true },
        },
      },
    });

    return doctor as DoctorMaster | null;
  }

  // ============== LIST ==============

  async list(
    tenantId: string,
    options: DoctorQueryInput
  ): Promise<DoctorListResult> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      departmentId,
      primaryDepartmentId,
      isSchedulable,
      includeDeleted = false,
      sortBy = "fullName",
      sortOrder = "asc",
    } = options;

    // Build where clause
    const where: Prisma.DoctorWhereInput = { tenantId };

    if (!includeDeleted) {
      where.isDeleted = false;
    }

    if (status) {
      where.status = status as DoctorStatus;
    }

    if (primaryDepartmentId) {
      where.primaryDepartmentId = primaryDepartmentId;
    }

    if (departmentId) {
      where.departments = {
        some: {
          departmentId,
          isActive: true,
        },
      };
    }

    if (isSchedulable !== undefined) {
      where.isSchedulable = isSchedulable;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { doctorCode: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search, mode: "insensitive" } },
        { registrationNumber: { contains: search, mode: "insensitive" } },
        { primaryDepartment: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Build order by
    let orderBy: Prisma.DoctorOrderByWithRelationInput = {};
    switch (sortBy) {
      case "fullName":
        orderBy = { fullName: sortOrder };
        break;
      case "doctorCode":
        orderBy = { doctorCode: sortOrder };
        break;
      case "status":
        orderBy = { status: sortOrder };
        break;
      case "primaryDepartment":
        orderBy = { primaryDepartment: { name: sortOrder } };
        break;
      case "createdAt":
        orderBy = { createdAt: sortOrder };
        break;
      case "updatedAt":
        orderBy = { updatedAt: sortOrder };
        break;
      default:
        orderBy = { fullName: "asc" };
    }

    // Execute query
    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          primaryDepartment: {
            select: { id: true, code: true, name: true },
          },
          departments: {
            include: {
              department: {
                select: { id: true, code: true, name: true },
              },
            },
          },
          user: {
            select: { id: true, email: true, fullName: true, isActive: true },
          },
        },
      }),
      prisma.doctor.count({ where }),
    ]);

    return {
      data: doctors as DoctorMaster[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ============== UPDATE ==============

  async update(
    tenantId: string,
    id: string,
    input: UpdateDoctorInput,
    userId: string
  ): Promise<{ success: boolean; data?: DoctorMaster; error?: string; errorCode?: string }> {
    try {
      // 1. Get existing doctor
      const existing = await this.getById(tenantId, id);

      if (!existing) {
        return {
          success: false,
          error: "Doctor not found",
          errorCode: DOCTOR_ERROR_CODES.NOT_FOUND,
        };
      }

      if (existing.isDeleted) {
        return {
          success: false,
          error: "Cannot update deleted doctor",
          errorCode: DOCTOR_ERROR_CODES.ALREADY_DELETED,
        };
      }

      // 2. Optimistic locking check
      if (existing.version !== input.version) {
        return {
          success: false,
          error: "Doctor has been modified by another user. Please refresh and try again.",
          errorCode: DOCTOR_ERROR_CODES.VERSION_CONFLICT,
        };
      }

      // 3. Check if doctor has visits (restricts primary department change)
      if (input.primaryDepartmentId && input.primaryDepartmentId !== existing.primaryDepartmentId) {
        const usage = await this.checkUsage(tenantId, id);
        if (usage.visits > 0) {
          return {
            success: false,
            error: "Cannot change primary department. Doctor has existing visits.",
            errorCode: DOCTOR_ERROR_CODES.PRIMARY_DEPT_CHANGE_NOT_ALLOWED,
          };
        }
      }

      // 4. Verify new primary department exists (if changing)
      if (input.primaryDepartmentId) {
        const primaryDept = await prisma.department.findFirst({
          where: {
            id: input.primaryDepartmentId,
            tenantId,
            isDeleted: false,
          },
        });

        if (!primaryDept) {
          return {
            success: false,
            error: "Primary department not found",
            errorCode: DOCTOR_ERROR_CODES.DEPARTMENT_NOT_FOUND,
          };
        }
      }

      // 5. Build update data
      const updateData: Prisma.DoctorUpdateInput = {
        version: existing.version + 1,
        updatedBy: userId,
      };

      // Update fields if provided
      if (input.registrationNumber !== undefined) updateData.registrationNumber = input.registrationNumber;
      if (input.registrationAuthority !== undefined) updateData.registrationAuthority = input.registrationAuthority;
      if (input.registrationDate !== undefined) updateData.registrationDate = input.registrationDate;
      if (input.fullName) updateData.fullName = input.fullName;
      if (input.gender) updateData.gender = input.gender as Gender;
      if (input.dateOfBirth !== undefined) updateData.dateOfBirth = input.dateOfBirth;
      if (input.mobile) updateData.mobile = input.mobile;
      if (input.email !== undefined) updateData.email = input.email || null;
      if (input.qualifications) updateData.qualifications = input.qualifications;
      if (input.specializations) updateData.specializations = input.specializations;
      if (input.yearsOfExperience !== undefined) updateData.yearsOfExperience = input.yearsOfExperience;
      if (input.consultationFee !== undefined) updateData.consultationFee = input.consultationFee;
      if (input.followUpFee !== undefined) updateData.followUpFee = input.followUpFee;
      if (input.primaryDepartmentId) updateData.primaryDepartment = { connect: { id: input.primaryDepartmentId } };
      if (input.status) updateData.status = input.status as DoctorStatus;
      if (input.isSchedulable !== undefined) updateData.isSchedulable = input.isSchedulable;
      if (input.allowWalkIn !== undefined) updateData.allowWalkIn = input.allowWalkIn;

      // 6. Update doctor and department mappings
      const updated = await prisma.$transaction(async (tx) => {
        // Update doctor
        const doctor = await tx.doctor.update({
          where: { id },
          data: updateData,
          include: {
            primaryDepartment: {
              select: { id: true, code: true, name: true },
            },
            departments: {
              include: {
                department: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
            user: {
              select: { id: true, email: true, fullName: true, isActive: true },
            },
          },
        });

        // Update department mappings if provided
        if (input.departmentIds && input.departmentIds.length > 0) {
          // Delete existing mappings
          await tx.doctorDepartment.deleteMany({
            where: { doctorId: id },
          });

          // Create new mappings
          await tx.doctorDepartment.createMany({
            data: input.departmentIds.map((deptId) => ({
              tenantId,
              doctorId: id,
              departmentId: deptId,
              isPrimary: deptId === (input.primaryDepartmentId || existing.primaryDepartmentId),
            })),
          });

          // Re-fetch with updated departments
          return await tx.doctor.findFirst({
            where: { id },
            include: {
              primaryDepartment: {
                select: { id: true, code: true, name: true },
              },
              departments: {
                include: {
                  department: {
                    select: { id: true, code: true, name: true },
                  },
                },
              },
              user: {
                select: { id: true, email: true, fullName: true, isActive: true },
              },
            },
          });
        }

        return doctor;
      });

      // 7. Create audit log
      await createAuditLog({
        tenantId,
        performedBy: userId,
        entityType: this.entityType,
        entityId: id,
        action: "UPDATE",
        oldValue: existing,
        newValue: updated,
      });

      return { success: true, data: updated as DoctorMaster };
    } catch (error) {
      console.error("DoctorService.update error:", error);
      throw error;
    }
  }

  // ============== SOFT DELETE / DISABLE ==============

  async disable(
    tenantId: string,
    id: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; errorCode?: string }> {
    try {
      const existing = await this.getById(tenantId, id);

      if (!existing) {
        return {
          success: false,
          error: "Doctor not found",
          errorCode: DOCTOR_ERROR_CODES.NOT_FOUND,
        };
      }

      if (existing.isDeleted) {
        return {
          success: false,
          error: "Doctor already disabled",
          errorCode: DOCTOR_ERROR_CODES.ALREADY_DELETED,
        };
      }

      // Check usage
      const usage = await this.checkUsage(tenantId, id);

      if (usage.isUsed) {
        // Has usage - only mark as INACTIVE
        await prisma.doctor.update({
          where: { id },
          data: {
            status: "INACTIVE",
            isSchedulable: false,
            updatedBy: userId,
            version: existing.version + 1,
          },
        });

        await createAuditLog({
          tenantId,
          performedBy: userId,
          entityType: this.entityType,
          entityId: id,
          action: "DISABLE",
          oldValue: { status: existing.status },
          newValue: { status: "INACTIVE", reason: "Has existing records" },
        });
      } else {
        // No usage - soft delete
        await prisma.doctor.update({
          where: { id },
          data: {
            isDeleted: true,
            status: "INACTIVE",
            isSchedulable: false,
            updatedBy: userId,
            version: existing.version + 1,
          },
        });

        await createAuditLog({
          tenantId,
          performedBy: userId,
          entityType: this.entityType,
          entityId: id,
          action: "DELETE",
          oldValue: existing,
          newValue: { isDeleted: true },
        });
      }

      return { success: true };
    } catch (error) {
      console.error("DoctorService.disable error:", error);
      throw error;
    }
  }

  // ============== CHECK USAGE ==============

  async checkUsage(tenantId: string, id: string): Promise<DoctorUsageStats> {
    const [appointments, visits, consultations, prescriptions] = await Promise.all([
      prisma.appointment.count({ where: { tenantId, doctorMasterId: id } }),
      prisma.visit.count({ where: { tenantId, doctorMasterId: id } }),
      prisma.consultation.count({ where: { tenantId, doctorMasterId: id } }),
      prisma.prescription.count({ where: { tenantId, doctorMasterId: id } }),
    ]);

    const usageCount = appointments + visits + consultations + prescriptions;

    return {
      isUsed: usageCount > 0,
      usageCount,
      appointments,
      visits,
      consultations,
      prescriptions,
    };
  }

  // ============== GET DOCTORS BY DEPARTMENT ==============

  async getByDepartment(
    tenantId: string,
    departmentId: string,
    options?: {
      status?: DoctorStatus;
      isSchedulable?: boolean;
      allowWalkIn?: boolean;
    }
  ): Promise<DoctorMaster[]> {
    const where: Prisma.DoctorWhereInput = {
      tenantId,
      isDeleted: false,
      departments: {
        some: {
          departmentId,
          isActive: true,
        },
      },
    };

    if (options?.status) {
      where.status = options.status;
    } else {
      where.status = "ACTIVE";
    }

    if (options?.isSchedulable !== undefined) {
      where.isSchedulable = options.isSchedulable;
    }

    if (options?.allowWalkIn !== undefined) {
      where.allowWalkIn = options.allowWalkIn;
    }

    const doctors = await prisma.doctor.findMany({
      where,
      orderBy: { fullName: "asc" },
      include: {
        primaryDepartment: {
          select: { id: true, code: true, name: true },
        },
        departments: {
          include: {
            department: {
              select: { id: true, code: true, name: true },
            },
          },
        },
        user: {
          select: { id: true, email: true, fullName: true, isActive: true },
        },
      },
    });

    return doctors as DoctorMaster[];
  }

  // ============== GET ACTIVE DOCTORS FOR DROPDOWN ==============

  async getActiveDoctors(tenantId: string): Promise<DoctorMaster[]> {
    const doctors = await prisma.doctor.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        isDeleted: false,
      },
      orderBy: { fullName: "asc" },
      include: {
        primaryDepartment: {
          select: { id: true, code: true, name: true },
        },
        departments: {
          include: {
            department: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    return doctors as DoctorMaster[];
  }

  // ============== GET SCHEDULABLE DOCTORS ==============

  async getSchedulableDoctors(
    tenantId: string,
    departmentId?: string
  ): Promise<DoctorMaster[]> {
    const where: Prisma.DoctorWhereInput = {
      tenantId,
      status: "ACTIVE",
      isDeleted: false,
      isSchedulable: true,
    };

    if (departmentId) {
      where.departments = {
        some: {
          departmentId,
          isActive: true,
        },
      };
    }

    const doctors = await prisma.doctor.findMany({
      where,
      orderBy: { fullName: "asc" },
      include: {
        primaryDepartment: {
          select: { id: true, code: true, name: true },
        },
        departments: {
          include: {
            department: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    return doctors as DoctorMaster[];
  }

  // ============== UPDATE STATUS ==============

  async updateStatus(
    tenantId: string,
    id: string,
    status: DoctorStatus,
    version: number,
    userId: string
  ): Promise<{ success: boolean; data?: DoctorMaster; error?: string; errorCode?: string }> {
    const existing = await this.getById(tenantId, id);

    if (!existing) {
      return {
        success: false,
        error: "Doctor not found",
        errorCode: DOCTOR_ERROR_CODES.NOT_FOUND,
      };
    }

    if (existing.version !== version) {
      return {
        success: false,
        error: "Doctor has been modified. Please refresh and try again.",
        errorCode: DOCTOR_ERROR_CODES.VERSION_CONFLICT,
      };
    }

    const updated = await prisma.doctor.update({
      where: { id },
      data: {
        status,
        isSchedulable: status === "ACTIVE",
        version: existing.version + 1,
        updatedBy: userId,
      },
      include: {
        primaryDepartment: {
          select: { id: true, code: true, name: true },
        },
        departments: {
          include: {
            department: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    await createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: this.entityType,
      entityId: id,
      action: "UPDATE",
      oldValue: { status: existing.status },
      newValue: { status },
    });

    return { success: true, data: updated as DoctorMaster };
  }

  // ============== GET AUDIT HISTORY ==============

  async getAuditHistory(
    tenantId: string,
    doctorId: string,
    options: { page?: number; limit?: number; action?: string }
  ) {
    const { page = 1, limit = 10, action } = options;

    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      entityType: this.entityType,
      entityId: doctorId,
    };

    if (action) {
      where.action = action;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { performedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, fullName: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

// Export singleton instance
export const doctorService = new DoctorService();
