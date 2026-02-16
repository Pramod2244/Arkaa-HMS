// @ts-nocheck
/**
 * HMS Phase-1 Hardening: Redis Cache Client
 * 
 * Redis client abstraction for caching master data.
 * Implements cache-aside pattern with TTL-based expiration.
 * 
 * Features:
 * - Connection pooling
 * - Automatic reconnection
 * - Graceful fallback when Redis unavailable
 * - JSON serialization for complex objects
 * 
 * Environment:
 * - REDIS_URL: Redis connection URL (default: redis://localhost:6379)
 * - REDIS_ENABLED: Enable/disable Redis (default: true)
 */

import { createClient, RedisClientType } from 'redis';

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';
const DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutes

// Singleton client
let redisClient: RedisClientType | null = null;
let isConnected = false;
let connectionPromise: Promise<void> | null = null;

// Cache statistics
const stats = {
  hits: 0,
  misses: 0,
  errors: 0,
  sets: 0,
};

/**
 * Get or create Redis client
 */
async function getClient(): Promise<RedisClientType | null> {
  if (!REDIS_ENABLED) {
    return null;
  }

  if (isConnected && redisClient) {
    return redisClient;
  }

  if (connectionPromise) {
    await connectionPromise;
    return redisClient;
  }

  connectionPromise = (async () => {
    try {
      redisClient = createClient({
        url: REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('[Redis] Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      redisClient.on('error', (err) => {
        console.error('[Redis] Connection error:', err.message);
        isConnected = false;
        stats.errors++;
      });

      redisClient.on('connect', () => {
        console.log('[Redis] Connected to', REDIS_URL);
        isConnected = true;
      });

      redisClient.on('reconnecting', () => {
        console.log('[Redis] Reconnecting...');
        isConnected = false;
      });

      await redisClient.connect();
    } catch (error) {
      console.error('[Redis] Failed to connect:', error);
      redisClient = null;
      isConnected = false;
    } finally {
      connectionPromise = null;
    }
  })();

  await connectionPromise;
  return redisClient;
}

// ============== CORE CACHE OPERATIONS ==============

/**
 * Get value from Redis cache
 * Returns undefined on cache miss or Redis error
 */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const client = await getClient();
    if (!client) {
      stats.misses++;
      return undefined;
    }

    const value = await client.get(key);
    if (value === null) {
      stats.misses++;
      return undefined;
    }

    stats.hits++;
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`[Redis] Get error for key ${key}:`, error);
    stats.errors++;
    return undefined;
  }
}

/**
 * Set value in Redis cache with TTL
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<boolean> {
  try {
    const client = await getClient();
    if (!client) {
      return false;
    }

    await client.setEx(key, ttlSeconds, JSON.stringify(value));
    stats.sets++;
    return true;
  } catch (error) {
    console.error(`[Redis] Set error for key ${key}:`, error);
    stats.errors++;
    return false;
  }
}

/**
 * Delete key from Redis cache
 */
export async function cacheDel(key: string): Promise<boolean> {
  try {
    const client = await getClient();
    if (!client) {
      return false;
    }

    await client.del(key);
    return true;
  } catch (error) {
    console.error(`[Redis] Delete error for key ${key}:`, error);
    stats.errors++;
    return false;
  }
}

/**
 * Delete all keys matching a pattern
 */
export async function cacheDelPattern(pattern: string): Promise<number> {
  try {
    const client = await getClient();
    if (!client) {
      return 0;
    }

    const keys = await client.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }

    await client.del(keys);
    console.log(`[Redis] Deleted ${keys.length} keys matching pattern: ${pattern}`);
    return keys.length;
  } catch (error) {
    console.error(`[Redis] Delete pattern error for ${pattern}:`, error);
    stats.errors++;
    return 0;
  }
}

/**
 * Get multiple values from cache
 */
export async function cacheGetMany<T>(keys: string[]): Promise<Map<string, T>> {
  const result = new Map<string, T>();
  
  try {
    const client = await getClient();
    if (!client || keys.length === 0) {
      return result;
    }

    const values = await client.mGet(keys);
    
    for (let i = 0; i < keys.length; i++) {
      const value = values[i];
      if (value !== null) {
        result.set(keys[i], JSON.parse(value) as T);
        stats.hits++;
      } else {
        stats.misses++;
      }
    }
  } catch (error) {
    console.error('[Redis] GetMany error:', error);
    stats.errors++;
  }

  return result;
}

// ============== CACHE-ASIDE PATTERN HELPER ==============

/**
 * Cache-aside pattern helper
 * Checks cache first, falls back to fetcher, caches result
 */
export async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  // Cache miss - fetch from source
  const value = await fetcher();

  // Cache the result (fire and forget)
  cacheSet(key, value, ttlSeconds).catch((err) => {
    console.error(`[Redis] Failed to cache ${key}:`, err);
  });

  return value;
}

// ============== STATS & MONITORING ==============

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? (stats.hits / total * 100).toFixed(2) : '0.00';
  
  return {
    ...stats,
    hitRate: `${hitRate}%`,
    isConnected,
    enabled: REDIS_ENABLED,
  };
}

/**
 * Log cache statistics
 */
export function logCacheStats(): void {
  const s = getCacheStats();
  console.log(`[Redis] Stats: connected=${s.isConnected}, hits=${s.hits}, ` +
    `misses=${s.misses}, hitRate=${s.hitRate}, errors=${s.errors}`);
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = await getClient();
    if (!client) return false;
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Graceful shutdown
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    console.log('[Redis] Connection closed');
  }
}

// ============== CACHE KEY BUILDERS ==============

/**
 * Standard cache key builders for HMS entities
 */
export const CacheKeys = {
  // Master data
  departments: (tenantId: string) => `hms:${tenantId}:departments`,
  department: (tenantId: string, id: string) => `hms:${tenantId}:department:${id}`,
  doctors: (tenantId: string) => `hms:${tenantId}:doctors`,
  doctor: (tenantId: string, id: string) => `hms:${tenantId}:doctor:${id}`,
  roles: (tenantId: string) => `hms:${tenantId}:roles`,
  permissions: () => `hms:global:permissions`,
  tenantSettings: (tenantId: string) => `hms:${tenantId}:settings`,
  tenantSetting: (tenantId: string, key: string) => `hms:${tenantId}:setting:${key}`,
  
  // Pattern for bulk invalidation
  tenantPattern: (tenantId: string) => `hms:${tenantId}:*`,
};

// ============== TTL CONSTANTS ==============

export const CacheTTL = {
  DEPARTMENTS: 30 * 60,     // 30 minutes
  DOCTORS: 15 * 60,         // 15 minutes
  ROLES: 30 * 60,           // 30 minutes
  PERMISSIONS: 60 * 60,     // 1 hour (rarely changes)
  TENANT_SETTINGS: 30 * 60, // 30 minutes
};
