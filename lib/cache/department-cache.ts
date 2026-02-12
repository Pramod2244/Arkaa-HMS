/**
 * HMS Phase-1 Hardening: Department Cache
 * 
 * Redis cache for department master data.
 * Departments are read-heavy, low-churn data - perfect for caching.
 * 
 * Cache Strategy:
 * - TTL: 30 minutes
 * - Invalidate on: create, update, delete
 * - Key pattern: hms:{tenantId}:departments
 */

import { prisma } from "@/lib/prisma";
import {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheAside,
  CacheKeys,
  CacheTTL,
} from "@/lib/cache/redis-client";

export interface CachedDepartment {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  isDeleted: boolean;
}

/**
 * Get all active departments for a tenant (cached)
 */
export async function getCachedDepartments(tenantId: string): Promise<CachedDepartment[]> {
  const key = CacheKeys.departments(tenantId);
  
  return cacheAside(
    key,
    async () => {
      const startTime = Date.now();
      
      const departments = await prisma.department.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          isDeleted: false,
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          status: true,
          isDeleted: true,
        },
        orderBy: { name: 'asc' },
      });

      const queryTime = Date.now() - startTime;
      if (queryTime > 100) {
        console.warn(`[DepartmentCache] Slow query: ${queryTime}ms for tenant ${tenantId}`);
      }

      return departments;
    },
    CacheTTL.DEPARTMENTS
  );
}

/**
 * Get single department by ID (cached)
 */
export async function getCachedDepartmentById(
  tenantId: string,
  departmentId: string
): Promise<CachedDepartment | null> {
  const key = CacheKeys.department(tenantId, departmentId);
  
  // Try cache
  const cached = await cacheGet<CachedDepartment>(key);
  if (cached !== undefined) {
    return cached;
  }

  // Cache miss - query DB
  const department = await prisma.department.findFirst({
    where: {
      id: departmentId,
      tenantId,
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      status: true,
      isDeleted: true,
    },
  });

  if (department) {
    await cacheSet(key, department, CacheTTL.DEPARTMENTS);
  }

  return department;
}

/**
 * Invalidate department cache for a tenant
 * Call after create/update/delete operations
 */
export async function invalidateDepartmentCache(tenantId: string, departmentId?: string): Promise<void> {
  // Always invalidate the list
  await cacheDel(CacheKeys.departments(tenantId));
  
  // Invalidate specific department if provided
  if (departmentId) {
    await cacheDel(CacheKeys.department(tenantId, departmentId));
  }
  
  console.log(`[DepartmentCache] Invalidated cache for tenant ${tenantId}`);
}

/**
 * Warm up department cache for a tenant
 * Call during app startup or after bulk operations
 */
export async function warmUpDepartmentCache(tenantId: string): Promise<void> {
  console.log(`[DepartmentCache] Warming up cache for tenant ${tenantId}`);
  await getCachedDepartments(tenantId);
}
