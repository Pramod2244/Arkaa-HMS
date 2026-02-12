/**
 * HMS Phase-1 Hardening: Cursor-Based Pagination Utilities
 * 
 * Replaces inefficient OFFSET pagination with cursor-based pagination
 * for scalability to lakhs/crores of records.
 * 
 * Standard pattern:
 * - Use primary key (UUID) or createdAt as cursor
 * - Always order explicitly
 * - Fetch limit + 1 to detect hasMore
 * - Return nextCursor for client
 */

export interface CursorPaginationParams {
  cursor?: string | null;
  limit?: number;
  direction?: 'forward' | 'backward';
}

export interface CursorPaginationResult<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    prevCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

export interface LegacyPaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    nextCursor?: string | null;
    hasMore?: boolean;
  };
}

/**
 * Default pagination limit
 */
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Sanitize and validate pagination limit
 */
export function sanitizeLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

/**
 * Decode cursor from base64 string
 * Cursor format: { id: string, createdAt?: string }
 */
export function decodeCursor(cursor?: string | null): { id?: string; createdAt?: Date } | null {
  if (!cursor) return null;
  
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    return {
      id: parsed.id,
      createdAt: parsed.createdAt ? new Date(parsed.createdAt) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Encode cursor to base64 string
 */
export function encodeCursor(data: { id: string; createdAt?: Date }): string {
  const payload = {
    id: data.id,
    createdAt: data.createdAt?.toISOString(),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Build cursor-based where clause for Prisma
 * Uses compound cursor (createdAt, id) for stable ordering
 */
export function buildCursorWhere(
  cursor: { id?: string; createdAt?: Date } | null,
  direction: 'forward' | 'backward' = 'forward'
): object | undefined {
  if (!cursor?.id) return undefined;

  if (cursor.createdAt) {
    // Compound cursor for stable pagination
    if (direction === 'forward') {
      return {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          {
            createdAt: cursor.createdAt,
            id: { lt: cursor.id },
          },
        ],
      };
    } else {
      return {
        OR: [
          { createdAt: { gt: cursor.createdAt } },
          {
            createdAt: cursor.createdAt,
            id: { gt: cursor.id },
          },
        ],
      };
    }
  }

  // Simple ID-based cursor
  return direction === 'forward' 
    ? { id: { lt: cursor.id } }
    : { id: { gt: cursor.id } };
}

/**
 * Process fetched results and extract pagination info
 * Fetches limit + 1 to determine if more records exist
 */
export function processCursorResults<T extends { id: string; createdAt?: Date }>(
  results: T[],
  limit: number,
  direction: 'forward' | 'backward' = 'forward'
): CursorPaginationResult<T> {
  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;

  let nextCursor: string | null = null;
  let prevCursor: string | null = null;

  if (data.length > 0) {
    const lastItem = data[data.length - 1];
    if (hasMore) {
      nextCursor = encodeCursor({ 
        id: lastItem.id, 
        createdAt: lastItem.createdAt 
      });
    }

    const firstItem = data[0];
    prevCursor = encodeCursor({ 
      id: firstItem.id, 
      createdAt: firstItem.createdAt 
    });
  }

  return {
    data,
    pagination: {
      nextCursor,
      prevCursor,
      hasMore,
      limit,
    },
  };
}

/**
 * Convert cursor pagination to legacy format for backward compatibility
 * Used during transition period
 */
export function toLegacyPagination<T>(
  cursorResult: CursorPaginationResult<T>,
  estimatedTotal?: number
): LegacyPaginationResult<T> {
  const limit = cursorResult.pagination.limit;
  const total = estimatedTotal ?? (cursorResult.pagination.hasMore ? limit * 2 : cursorResult.data.length);
  
  return {
    data: cursorResult.data,
    pagination: {
      page: 1, // Legacy concept - not meaningful with cursor pagination
      limit,
      total,
      pages: Math.ceil(total / limit),
      nextCursor: cursorResult.pagination.nextCursor,
      hasMore: cursorResult.pagination.hasMore,
    },
  };
}

/**
 * Helper to build orderBy for consistent cursor pagination
 * Always includes id as secondary sort for stability
 */
export function buildCursorOrderBy(
  primaryField: string = 'createdAt',
  direction: 'asc' | 'desc' = 'desc'
): object[] {
  return [
    { [primaryField]: direction },
    { id: direction },
  ];
}

/**
 * Type guard to check if pagination params include cursor
 */
export function hasCursor(params: { cursor?: string | null; page?: number }): boolean {
  return !!params.cursor;
}

/**
 * Migration helper: Support both cursor and offset pagination
 * Allows gradual migration without breaking existing clients
 */
export interface HybridPaginationParams {
  // Cursor-based (preferred)
  cursor?: string | null;
  // Legacy offset-based (deprecated)
  page?: number;
  limit?: number;
}

export function isLegacyPagination(params: HybridPaginationParams): boolean {
  return !params.cursor && typeof params.page === 'number';
}
