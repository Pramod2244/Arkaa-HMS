/**
 * Phase-1 Hardening: Rate Limiting Middleware
 * 
 * In-memory sliding window rate limiter (Redis upgrade path available).
 * Protects against brute force and DoS without external dependencies.
 * 
 * Limits:
 * - Login endpoints: 5 requests / 15 minutes per IP
 * - Patient search: 30 requests / minute per user
 * - API general: 100 requests / minute per user
 * 
 * @module lib/middleware/rate-limiter
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (replaced with Redis in production at scale)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't block process exit
  if (cleanupTimer.unref) cleanupTimer.unref();
}

startCleanup();

/**
 * Rate limit configuration by endpoint pattern
 */
export const RateLimitConfig = {
  // Auth endpoints - strict limits
  LOGIN: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5/15min
  
  // Search endpoints - moderate limits
  PATIENT_SEARCH: { maxRequests: 30, windowMs: 60 * 1000 }, // 30/min
  
  // General API - relaxed limits
  API_GENERAL: { maxRequests: 100, windowMs: 60 * 1000 }, // 100/min
  
  // Heavy operations - strict
  EXPORT: { maxRequests: 5, windowMs: 60 * 1000 }, // 5/min
  IMPORT: { maxRequests: 3, windowMs: 60 * 1000 }, // 3/min
} as const;

export type RateLimitType = keyof typeof RateLimitConfig;

/**
 * Check if a request should be rate limited
 * @returns { allowed: boolean, remaining: number, resetIn: number }
 */
export function checkRateLimit(
  identifier: string,
  type: RateLimitType
): { allowed: boolean; remaining: number; resetIn: number } {
  const config = RateLimitConfig[type];
  const key = `${type}:${identifier}`;
  const now = Date.now();

  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt < now) {
    // First request or window expired
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }

  if (existing.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetIn: existing.resetAt - now,
    };
  }

  // Increment counter
  existing.count += 1;
  rateLimitStore.set(key, existing);

  return {
    allowed: true,
    remaining: config.maxRequests - existing.count,
    resetIn: existing.resetAt - now,
  };
}

/**
 * Get client IP from request headers
 * Supports X-Forwarded-For, X-Real-IP, and direct connection
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // First IP in the list is the client
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  
  // Fallback - in serverless, this may not be available
  return 'unknown';
}

/**
 * Determine rate limit type based on pathname
 */
export function getRateLimitType(pathname: string): RateLimitType {
  // Login endpoints
  if (pathname.includes('/auth/login') || pathname === '/login' || pathname === '/superadmin/login') {
    return 'LOGIN';
  }
  
  // Patient search
  if (pathname.includes('/patients') && (pathname.includes('search') || pathname.includes('list'))) {
    return 'PATIENT_SEARCH';
  }
  
  // Export operations
  if (pathname.includes('export')) {
    return 'EXPORT';
  }
  
  // Import operations
  if (pathname.includes('import')) {
    return 'IMPORT';
  }
  
  // Default API rate limit
  return 'API_GENERAL';
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(
  remaining: number,
  resetIn: number,
  limit: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(Math.ceil((Date.now() + resetIn) / 1000)),
  };
}

/**
 * Apply rate limiting to a request
 * Returns null if allowed, or a Response if blocked
 */
export function applyRateLimit(
  request: Request,
  userId?: string
): { blocked: true; response: Response } | { blocked: false; headers: Record<string, string> } {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  const limitType = getRateLimitType(pathname);
  const config = RateLimitConfig[limitType];
  
  // For login, use IP; for authenticated endpoints, use userId
  const identifier = limitType === 'LOGIN' 
    ? getClientIP(request)
    : userId || getClientIP(request);
  
  const result = checkRateLimit(identifier, limitType);
  const headers = createRateLimitHeaders(result.remaining, result.resetIn, config.maxRequests);
  
  if (!result.allowed) {
    const resetSeconds = Math.ceil(result.resetIn / 1000);
    return {
      blocked: true,
      response: new Response(
        JSON.stringify({
          success: false,
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${resetSeconds} seconds.`,
          errorCode: 'RATE_LIMIT_EXCEEDED',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(resetSeconds),
            ...headers,
          },
        }
      ),
    };
  }
  
  return { blocked: false, headers };
}

/**
 * Reset rate limit for a specific identifier (e.g., after successful login)
 */
export function resetRateLimit(identifier: string, type: RateLimitType): void {
  const key = `${type}:${identifier}`;
  rateLimitStore.delete(key);
}

/**
 * Get current rate limit stats (for monitoring)
 */
export function getRateLimitStats(): {
  totalEntries: number;
  entriesByType: Record<string, number>;
} {
  const entriesByType: Record<string, number> = {};
  
  for (const key of rateLimitStore.keys()) {
    const type = key.split(':')[0];
    entriesByType[type] = (entriesByType[type] || 0) + 1;
  }
  
  return {
    totalEntries: rateLimitStore.size,
    entriesByType,
  };
}
