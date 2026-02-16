/**
 * HMS Phase-1 Hardening: Doctor Cache
 * 
 * Redis cache for doctor master data.
 * Doctors are queried frequently for appointment booking and OPD queue.
 * 
 * Cache Strategy:
 * - TTL: 15 minutes (shorter than departments as doctors may change status)
 * - Invalidate on: create, update, delete, status change
 * - Key pattern: hms:{tenantId}:doctors
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

export interface CachedDoctor {
  id: string;
  doctorCode: string;
  fullName: string;
  specializations: string[];
  qualifications: string[];
  status: string;
  userId: string;
  primaryDepartmentId: string;
  primaryDepartment?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

/**
 * Get all active doctors for a tenant (cached)
 */
export async function getCachedDoctors(tenantId: string): Promise<CachedDoctor[]> {
  const key = CacheKeys.doctors(tenantId);
  
  return cacheAside(
    key,
    async () => {
      const startTime = Date.now();
      
      const doctors = await prisma.doctor.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          isDeleted: false,
        },
        select: {
          id: true,
          doctorCode: true,
          fullName: true,
          specializations: true,
          qualifications: true,
          status: true,
          userId: true,
          primaryDepartmentId: true,
          primaryDepartment: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { fullName: 'asc' },
      });

      const queryTime = Date.now() - startTime;
      if (queryTime > 100) {
        console.warn(`[DoctorCache] Slow query: ${queryTime}ms for tenant ${tenantId}`);
      }

      return doctors;
    },
    CacheTTL.DOCTORS
  );
}

/**
 * Get doctors by department (cached with filtering)
 */
export async function getCachedDoctorsByDepartment(
  tenantId: string,
  departmentId: string
): Promise<CachedDoctor[]> {
  // Get all doctors from cache, then filter
  // This is efficient because department filtering is common
  // and the full list is already in cache
  const allDoctors = await getCachedDoctors(tenantId);
  return allDoctors.filter(d => d.primaryDepartmentId === departmentId);
}

/**
 * Get single doctor by ID (cached)
 */
export async function getCachedDoctorById(
  tenantId: string,
  doctorId: string
): Promise<CachedDoctor | null> {
  const key = CacheKeys.doctor(tenantId, doctorId);
  
  // Try cache
  const cached = await cacheGet<CachedDoctor>(key);
  if (cached !== undefined) {
    return cached;
  }

  // Cache miss - query DB
  const doctor = await prisma.doctor.findFirst({
    where: {
      id: doctorId,
      tenantId,
    },
    select: {
      id: true,
      doctorCode: true,
      fullName: true,
      specializations: true,
      qualifications: true,
      status: true,
      userId: true,
      primaryDepartmentId: true,
      primaryDepartment: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  if (doctor) {
    await cacheSet(key, doctor, CacheTTL.DOCTORS);
  }

  return doctor;
}

/**
 * Invalidate doctor cache for a tenant
 * Call after create/update/delete operations
 */
export async function invalidateDoctorCache(tenantId: string, doctorId?: string): Promise<void> {
  // Always invalidate the list
  await cacheDel(CacheKeys.doctors(tenantId));
  
  // Invalidate specific doctor if provided
  if (doctorId) {
    await cacheDel(CacheKeys.doctor(tenantId, doctorId));
  }
  
  console.log(`[DoctorCache] Invalidated cache for tenant ${tenantId}`);
}

/**
 * Warm up doctor cache for a tenant
 */
export async function warmUpDoctorCache(tenantId: string): Promise<void> {
  console.log(`[DoctorCache] Warming up cache for tenant ${tenantId}`);
  await getCachedDoctors(tenantId);
}
