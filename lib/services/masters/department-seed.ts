/**
 * HMS Medical Masters - Department Seeding Service
 * 
 * Handles seeding of predefined departments for tenants.
 * 
 * RULES:
 * - All tenants get the same predefined departments
 * - Departments are seeded as INACTIVE by default
 * - Admin activates only the departments they need
 * - isSystem = true marks them as system departments
 */

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { MasterStatus } from "@/app/generated/prisma/client";
import { SYSTEM_DEPARTMENTS } from "@/lib/constants/departments";

export interface SeedResult {
  success: boolean;
  created: number;
  skipped: number;
  errors: string[];
}

/**
 * Seed all predefined departments for a specific tenant
 * 
 * @param tenantId - The tenant to seed departments for
 * @param createdBy - User ID who triggered the seeding (use 'SYSTEM' for automated)
 * @returns Result with count of created and skipped departments
 */
export async function seedDepartmentsForTenant(
  tenantId: string,
  createdBy: string = "SYSTEM"
): Promise<SeedResult> {
  const result: SeedResult = {
    success: true,
    created: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Get existing department codes for this tenant
    const existingDepartments = await prisma.department.findMany({
      where: { tenantId },
      select: { code: true },
    });
    const existingCodes = new Set(existingDepartments.map(d => d.code));

    // Seed each department that doesn't exist
    for (const dept of SYSTEM_DEPARTMENTS) {
      try {
        if (existingCodes.has(dept.code)) {
          result.skipped++;
          continue;
        }

        // Create the department
        const created = await prisma.department.create({
          data: {
            tenantId,
            code: dept.code,
            name: dept.name,
            description: dept.description,
            status: MasterStatus.INACTIVE, // Start as INACTIVE
            isDeleted: false,
            version: 1,
            createdBy,
            updatedBy: createdBy,
          },
        });

        // Create audit log for the seeding
        // Use null for performedBy when SYSTEM (no user reference)
        await createAuditLog({
          tenantId,
          performedBy: createdBy === "SYSTEM" ? null : createdBy,
          entityType: "DEPARTMENT",
          entityId: created.id,
          action: "SEED",
          newValue: {
            code: created.code,
            name: created.name,
            description: created.description,
            status: created.status,
            _seedInfo: "System department seeded automatically",
          },
        });

        result.created++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to create ${dept.code}: ${errorMessage}`);
      }
    }
  } catch (error) {
    result.success = false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Seeding failed: ${errorMessage}`);
  }

  return result;
}

/**
 * Backfill departments for all existing tenants
 * 
 * @param createdBy - User ID who triggered the backfill
 * @returns Results per tenant
 */
export async function backfillDepartmentsForAllTenants(
  createdBy: string = "SYSTEM"
): Promise<Map<string, SeedResult>> {
  const results = new Map<string, SeedResult>();

  try {
    // Get all active tenants
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, code: true },
    });

    console.log(`Found ${tenants.length} tenants to backfill departments for`);

    for (const tenant of tenants) {
      console.log(`Seeding departments for tenant: ${tenant.code} (${tenant.id})`);
      const result = await seedDepartmentsForTenant(tenant.id, createdBy);
      results.set(tenant.id, result);
      console.log(`  Created: ${result.created}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
    }
  } catch (error) {
    console.error("Backfill failed:", error);
  }

  return results;
}

/**
 * Check if a tenant has departments seeded
 */
export async function hasDepartmentsSeeded(tenantId: string): Promise<boolean> {
  const count = await prisma.department.count({
    where: { tenantId },
  });
  return count > 0;
}

/**
 * Get seeding status for a tenant
 */
export async function getSeedingStatus(tenantId: string): Promise<{
  total: number;
  active: number;
  inactive: number;
  systemDepartmentCount: number;
}> {
  const [total, active, inactive] = await Promise.all([
    prisma.department.count({ where: { tenantId, isDeleted: false } }),
    prisma.department.count({ where: { tenantId, isDeleted: false, status: MasterStatus.ACTIVE } }),
    prisma.department.count({ where: { tenantId, isDeleted: false, status: MasterStatus.INACTIVE } }),
  ]);

  return {
    total,
    active,
    inactive,
    systemDepartmentCount: SYSTEM_DEPARTMENTS.length,
  };
}
