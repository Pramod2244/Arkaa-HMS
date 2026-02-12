import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import {
  getCachedPermissions,
  setCachedPermissions,
  getCachedRoles,
  setCachedRoles,
  logCacheStats,
} from "@/lib/cache/permission-cache";

export class AppError extends Error {
  public statusCode: number;
  public errorCode?: string;

  constructor(message: string, statusCode: number = 500, errorCode?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * Get user permission codes with LRU CACHING (Phase-1 Hardening)
 * 
 * Cache-aside pattern:
 * 1. Check cache first
 * 2. On cache miss, query DB
 * 3. Store result in cache
 * 
 * TTL: 5 minutes (configurable in permission-cache.ts)
 */
export async function getUserPermissionCodes(
  userId: string,
  tenantId: string | null
): Promise<string[]> {
  if (!tenantId) return []; // super admin handled separately in auth

  // ===== CACHE CHECK =====
  const cachedPermissions = getCachedPermissions(tenantId, userId);
  if (cachedPermissions !== undefined) {
    // Cache hit - return immediately
    return cachedPermissions;
  }

  // ===== CACHE MISS - Query DB =====
  const startTime = Date.now();
  
  const userWithRoles = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!userWithRoles) {
    // Cache empty result to prevent repeated DB hits for non-existent users
    setCachedPermissions(tenantId, userId, []);
    return [];
  }

  // Extract role codes and cache them
  const roleCodes = userWithRoles.userRoles.map(ur => ur.role.code);
  setCachedRoles(tenantId, userId, roleCodes);

  // Check if user has ADMIN role - ADMIN gets ALL permissions
  const hasAdminRole = roleCodes.includes('ADMIN');
  if (hasAdminRole) {
    // Return all permissions for ADMIN role
    const allPermissions = await prisma.permission.findMany({ select: { code: true } });
    const permissionCodes = allPermissions.map(p => p.code);
    
    // Cache with result
    setCachedPermissions(tenantId, userId, permissionCodes);
    
    const queryTime = Date.now() - startTime;
    if (queryTime > 100) {
      console.warn(`[RBAC] Slow permission query for ADMIN user ${userId}: ${queryTime}ms`);
    }
    
    return permissionCodes;
  }

  // For non-admin users, get explicit permissions
  const userWithPermissions = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });

  if (!userWithPermissions) {
    setCachedPermissions(tenantId, userId, []);
    return [];
  }

  const codes = new Set<string>();
  for (const ur of userWithPermissions.userRoles) {
    for (const rp of ur.role.rolePermissions) {
      codes.add(rp.permission.code);
    }
  }
  
  const permissionCodes = Array.from(codes);
  
  // ===== CACHE RESULT =====
  setCachedPermissions(tenantId, userId, permissionCodes);
  
  const queryTime = Date.now() - startTime;
  if (queryTime > 100) {
    console.warn(`[RBAC] Slow permission query for user ${userId}: ${queryTime}ms`);
  }
  
  // Log stats periodically (every 100 cache misses)
  const stats = { misses: 0 }; // Simplified - real implementation would track
  if (stats.misses % 100 === 0) {
    logCacheStats();
  }
  
  return permissionCodes;
}

export function hasPermission(
  session: SessionPayload | null,
  permissionCode: string
): boolean {
  if (!session) return false;
  if (session.isSuperAdmin) return true;

  // Check if user has ADMIN role (which should have all permissions loaded)
  return session.permissions.includes(permissionCode);
}

export function requirePermission(
  session: SessionPayload | null,
  permissionCode: string
): void {
  if (!session) {
    throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
  }

  if (session.isSuperAdmin) return;

  if (!session.permissions.includes(permissionCode)) {
    throw new AppError(
      `You do not have permission to perform this action`,
      403,
      "PERMISSION_DENIED"
    );
  }
}

// Re-export cache invalidation functions for use in role/permission update handlers
export {
  invalidateUserCache,
  invalidateTenantCache,
  invalidateAllPermissionCaches,
} from "@/lib/cache/permission-cache";
