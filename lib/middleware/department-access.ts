/**
 * Department Access Control Middleware
 * 
 * Enforces tenant and department-level security:
 * - Users can only access data for their assigned departments
 * - Prevents cross-department data leakage
 * - Validates permission + department combination
 */

import { SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class DepartmentAccessError extends Error {
  constructor(message: string = "Access denied") {
    super(message);
    this.name = "DepartmentAccessError";
  }
}

/**
 * Verify user has access to a specific department
 * Used before allowing OPD operations in that department
 */
export async function verifyDepartmentAccess(
  session: SessionPayload,
  departmentId: string
): Promise<boolean> {
  // Super admin has access to all
  if (session.isSuperAdmin) return true;

  // Check if department is in user's assigned departments
  return session.departmentIds?.includes(departmentId) ?? false;
}

/**
 * Verify user can perform action on an OPD visit
 * Checks both permission and department access
 */
export async function verifyOPDVisitAccess(
  session: SessionPayload,
  visitId: string,
  requiredPermission: string
): Promise<boolean> {
  // Check permission first
  if (!session.permissions?.includes(requiredPermission)) {
    throw new DepartmentAccessError(
      `Permission denied. Required: ${requiredPermission}`
    );
  }

  // Check department access
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { departmentId: true, tenantId: true },
  });

  if (!visit) {
    throw new DepartmentAccessError("Visit not found");
  }

  // Verify tenant match
  if (visit.tenantId !== session.tenantId) {
    throw new DepartmentAccessError("Cross-tenant access denied");
  }

  // Verify department access
  if (!visit.departmentId || !session.departmentIds?.includes(visit.departmentId)) {
    throw new DepartmentAccessError(
      "You are not assigned to this visit's department"
    );
  }

  return true;
}

/**
 * Get accessible department IDs for user
 * Returns empty array if user has no department assignments
 */
export function getAccessibleDepartmentIds(session: SessionPayload): string[] {
  if (session.isSuperAdmin) {
    // Super admin can access all (will be filtered by tenantId in queries)
    return [];
  }

  return session.departmentIds ?? [];
}

/**
 * Build Prisma WHERE clause for department filtering
 * Ensures queries only return data from user's departments
 */
export function buildDepartmentFilter(
  session: SessionPayload,
  departmentFieldName: string = "departmentId"
): Record<string, any> {
  if (session.isSuperAdmin) {
    // Super admin - no department filter, only tenant filter
    return {};
  }

  const deptIds = session.departmentIds ?? [];
  if (deptIds.length === 0) {
    // User has no departments - return empty result
    return { [departmentFieldName]: { in: [] } };
  }

  return { [departmentFieldName]: { in: deptIds } };
}

/**
 * Verify doctor belongs to specified department
 * Used when assigning doctors to OPD visits
 */
export async function verifyDoctorDepartmentAssignment(
  doctorId: string,
  departmentId: string,
  tenantId: string
): Promise<boolean> {
  const assignment = await prisma.userDepartment.findFirst({
    where: {
      userId: doctorId,
      departmentId,
      tenantId,
      isActive: true,
    },
  });

  return !!assignment;
}

/**
 * Verify all doctors in array are assigned to department
 * Used for batch operations
 */
export async function verifyDoctorsInDepartment(
  doctorIds: string[],
  departmentId: string,
  tenantId: string
): Promise<boolean> {
  if (doctorIds.length === 0) return true;

  const count = await prisma.userDepartment.count({
    where: {
      userId: { in: doctorIds },
      departmentId,
      tenantId,
      isActive: true,
    },
  });

  return count === doctorIds.length;
}

/**
 * Get departments accessible by user
 * Returns full department objects with metadata
 */
export async function getUserAccessibleDepartments(
  userId: string,
  tenantId: string
) {
  return prisma.userDepartment.findMany({
    where: {
      userId,
      tenantId,
      isActive: true,
    },
    select: {
      department: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
        },
      },
    },
  });
}

/**
 * Enforce department-level data isolation in OPD queries
 * Call before returning sensitive data to ensure user can access it
 */
export async function enforceOPDDataAccess(
  session: SessionPayload,
  dataItem: { departmentId: string; tenantId: string },
  action: string = "access"
): Promise<void> {
  // Verify tenant
  if (dataItem.tenantId !== session.tenantId) {
    throw new DepartmentAccessError(
      `Cannot ${action} data from different tenant`
    );
  }

  // Verify department access
  if (!session.departmentIds?.includes(dataItem.departmentId)) {
    throw new DepartmentAccessError(
      `Cannot ${action} data from department: ${dataItem.departmentId}`
    );
  }
}

/**
 * Verify user can create OPD visit in department
 * Receptionist assigned to dept can create visits there
 */
export async function verifyOPDVisitCreationAccess(
  session: SessionPayload,
  departmentId: string,
  requiredPermission: string = "OPD_CREATE"
): Promise<void> {
  // Check permission
  if (!session.permissions?.includes(requiredPermission)) {
    throw new DepartmentAccessError(
      `Permission denied. Required: ${requiredPermission}`
    );
  }

  // Check department access
  if (!session.departmentIds?.includes(departmentId)) {
    throw new DepartmentAccessError(
      "You are not assigned to this department"
    );
  }
}

/**
 * Verify consultation belongs to user's accessible visit
 * Used for consultation operations
 */
export async function verifyConsultationAccess(
  session: SessionPayload,
  consultationId: string,
  requiredPermission: string
): Promise<boolean> {
  // Check permission
  if (!session.permissions?.includes(requiredPermission)) {
    throw new DepartmentAccessError(`Permission denied: ${requiredPermission}`);
  }

  // Get consultation with visit details
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: {
      visit: {
        select: {
          id: true,
          departmentId: true,
          tenantId: true,
        },
      },
    },
  });

  if (!consultation) {
    throw new DepartmentAccessError("Consultation not found");
  }

  // Verify tenant
  if (consultation.visit.tenantId !== session.tenantId) {
    throw new DepartmentAccessError("Cross-tenant access denied");
  }

  // Verify department access
  if (!consultation.visit.departmentId || !session.departmentIds?.includes(consultation.visit.departmentId)) {
    throw new DepartmentAccessError(
      "You are not assigned to this consultation's department"
    );
  }

  return true;
}

/**
 * Audit log helper for department-scoped operations
 * Automatically includes department context
 */
export function getDepartmentAuditContext(
  departmentId: string,
  session: SessionPayload
): Record<string, any> {
  return {
    departmentId,
    userId: session.userId,
    tenantId: session.tenantId,
    timestamp: new Date(),
  };
}
