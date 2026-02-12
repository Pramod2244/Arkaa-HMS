/**
 * HMS Phase-1 Hardening: Permission Cache
 * 
 * In-memory LRU cache for user permissions to eliminate
 * DB hits on every request. Critical for hot path protection.
 * 
 * Features:
 * - LRU eviction when max size reached
 * - TTL-based expiration (5 minutes default)
 * - Per-tenant user key isolation
 * - Cache invalidation on role/permission changes
 * - Observability metrics integration
 * 
 * CRITICAL: This is a per-process cache. In multi-instance
 * deployments, cache invalidation is eventually consistent.
 * For strict consistency, use Redis (Phase 2).
 */

import { recordCacheMetric } from '../observability';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_SIZE = 1000; // Max 1000 users cached

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTtl: number;
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, size: 0 };

  constructor(maxSize: number = DEFAULT_MAX_SIZE, defaultTtl: number = DEFAULT_TTL_MS) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    this.stats.hits++;
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    // Delete existing entry first (for LRU ordering)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtl),
    });
    
    this.stats.size = this.cache.size;
  }

  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * Delete all entries matching a pattern
   * Used for bulk invalidation (e.g., all users of a tenant)
   */
  deleteByPattern(pattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Cleanup expired entries (call periodically)
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }
}

// ============== PERMISSION CACHE ==============

/**
 * Cache key format: tenantId:userId:permissions
 */
function buildPermissionKey(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}:permissions`;
}

/**
 * Cache key format: tenantId:userId:roles
 */
function buildRolesKey(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}:roles`;
}

// Singleton cache instance
const permissionCache = new LRUCache<string[]>(DEFAULT_MAX_SIZE, DEFAULT_TTL_MS);
const rolesCache = new LRUCache<string[]>(DEFAULT_MAX_SIZE, DEFAULT_TTL_MS);

// Cleanup interval (every 60 seconds)
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const permCleanup = permissionCache.cleanup();
    const rolesCleanup = rolesCache.cleanup();
    if (permCleanup > 0 || rolesCleanup > 0) {
      console.log(`[PermissionCache] Cleanup: ${permCleanup} permissions, ${rolesCleanup} roles expired`);
    }
  }, 60000);
}

// Start cleanup on module load
startCleanup();

// ============== PUBLIC API ==============

/**
 * Get cached permissions for a user
 * Returns undefined if not in cache (cache miss)
 */
export function getCachedPermissions(tenantId: string, userId: string): string[] | undefined {
  const key = buildPermissionKey(tenantId, userId);
  const result = permissionCache.get(key);
  recordCacheMetric('permissions', result !== undefined);
  return result;
}

/**
 * Set permissions in cache
 */
export function setCachedPermissions(tenantId: string, userId: string, permissions: string[]): void {
  const key = buildPermissionKey(tenantId, userId);
  permissionCache.set(key, permissions);
}

/**
 * Get cached roles for a user
 */
export function getCachedRoles(tenantId: string, userId: string): string[] | undefined {
  const key = buildRolesKey(tenantId, userId);
  const result = rolesCache.get(key);
  recordCacheMetric('roles', result !== undefined);
  return result;
}

/**
 * Set roles in cache
 */
export function setCachedRoles(tenantId: string, userId: string, roles: string[]): void {
  const key = buildRolesKey(tenantId, userId);
  rolesCache.set(key, roles);
}

/**
 * Invalidate cache for a specific user
 * Call when user's roles change
 */
export function invalidateUserCache(tenantId: string, userId: string): void {
  const permKey = buildPermissionKey(tenantId, userId);
  const rolesKey = buildRolesKey(tenantId, userId);
  
  permissionCache.delete(permKey);
  rolesCache.delete(rolesKey);
  
  console.log(`[PermissionCache] Invalidated cache for user ${userId} in tenant ${tenantId}`);
}

/**
 * Invalidate all users in a tenant
 * Call when tenant-wide role or permission changes occur
 */
export function invalidateTenantCache(tenantId: string): void {
  const permCount = permissionCache.deleteByPattern(tenantId);
  const rolesCount = rolesCache.deleteByPattern(tenantId);
  
  console.log(`[PermissionCache] Invalidated ${permCount + rolesCount} entries for tenant ${tenantId}`);
}

/**
 * Invalidate all permission caches
 * Call when global permission definitions change
 */
export function invalidateAllPermissionCaches(): void {
  permissionCache.clear();
  rolesCache.clear();
  
  console.log('[PermissionCache] All permission caches cleared');
}

/**
 * Get cache statistics for monitoring
 */
export function getPermissionCacheStats(): { permissions: CacheStats; roles: CacheStats } {
  return {
    permissions: permissionCache.getStats(),
    roles: rolesCache.getStats(),
  };
}

/**
 * Log cache statistics (for observability)
 */
export function logCacheStats(): void {
  const stats = getPermissionCacheStats();
  const permHitRate = stats.permissions.hits + stats.permissions.misses > 0
    ? (stats.permissions.hits / (stats.permissions.hits + stats.permissions.misses) * 100).toFixed(2)
    : '0.00';
  
  console.log(`[PermissionCache] Stats: size=${stats.permissions.size}, ` +
    `hits=${stats.permissions.hits}, misses=${stats.permissions.misses}, ` +
    `hitRate=${permHitRate}%, evictions=${stats.permissions.evictions}`);
}
