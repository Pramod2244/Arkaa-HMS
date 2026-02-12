/**
 * HMS Phase-1 Hardening: Cache Index
 * 
 * Central export for all cache modules.
 * Provides unified cache management and invalidation.
 */

// Core Redis client
export {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  cacheGetMany,
  cacheAside,
  getCacheStats,
  logCacheStats,
  isRedisAvailable,
  closeRedisConnection,
  CacheKeys,
  CacheTTL,
} from './redis-client';

// Permission cache (in-memory LRU)
export {
  getCachedPermissions,
  setCachedPermissions,
  getCachedRoles,
  setCachedRoles,
  invalidateUserCache,
  invalidateTenantCache,
  invalidateAllPermissionCaches,
  getPermissionCacheStats,
  logCacheStats as logPermissionCacheStats,
} from './permission-cache';

// Department cache (Redis)
export {
  getCachedDepartments,
  getCachedDepartmentById,
  invalidateDepartmentCache,
  warmUpDepartmentCache,
  type CachedDepartment,
} from './department-cache';

// Doctor cache (Redis)
export {
  getCachedDoctors,
  getCachedDoctorsByDepartment,
  getCachedDoctorById,
  invalidateDoctorCache,
  warmUpDoctorCache,
  type CachedDoctor,
} from './doctor-cache';

/**
 * Invalidate all caches for a tenant
 * Call when major tenant configuration changes
 */
export async function invalidateAllTenantCaches(tenantId: string): Promise<void> {
  const { invalidateTenantCache: invalidatePerms } = await import('./permission-cache');
  const { invalidateDepartmentCache } = await import('./department-cache');
  const { invalidateDoctorCache } = await import('./doctor-cache');
  const { cacheDelPattern, CacheKeys } = await import('./redis-client');
  
  // Invalidate in-memory permission cache
  invalidatePerms(tenantId);
  
  // Invalidate Redis caches
  await Promise.all([
    invalidateDepartmentCache(tenantId),
    invalidateDoctorCache(tenantId),
    cacheDelPattern(CacheKeys.tenantPattern(tenantId)),
  ]);
  
  console.log(`[Cache] All caches invalidated for tenant ${tenantId}`);
}

/**
 * Warm up all caches for a tenant
 * Call during app startup for active tenants
 */
export async function warmUpTenantCaches(tenantId: string): Promise<void> {
  const { warmUpDepartmentCache } = await import('./department-cache');
  const { warmUpDoctorCache } = await import('./doctor-cache');
  
  await Promise.all([
    warmUpDepartmentCache(tenantId),
    warmUpDoctorCache(tenantId),
  ]);
  
  console.log(`[Cache] Caches warmed up for tenant ${tenantId}`);
}

/**
 * Get combined cache statistics
 */
export async function getAllCacheStats() {
  const { getCacheStats } = await import('./redis-client');
  const { getPermissionCacheStats } = await import('./permission-cache');
  
  return {
    redis: getCacheStats(),
    permissions: getPermissionCacheStats(),
  };
}
