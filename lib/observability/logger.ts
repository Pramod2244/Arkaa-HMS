/**
 * Phase-1 Hardening: Observability & Structured Logging
 * 
 * Provides structured logging for:
 * - Slow queries (>100ms warning)
 * - Cache hit/miss tracking
 * - Error tracking with context
 * - Performance metrics
 * 
 * Output format: JSON for log aggregation (Datadog, CloudWatch, etc.)
 * 
 * @module lib/observability/logger
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Threshold for slow query warning
const SLOW_QUERY_THRESHOLD_MS = 100;

// Environment check for log level
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL as LogLevel];
}

function formatLogEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'development') {
    // Human-readable format for development
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const duration = entry.duration ? ` (${entry.duration}ms)` : '';
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const error = entry.error ? `\n  Error: ${entry.error.message}` : '';
    return `${prefix} ${entry.message}${duration}${context}${error}`;
  }
  // JSON format for production log aggregation
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, context?: LogContext, extra?: Partial<LogEntry>) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    ...extra,
  };

  const formatted = formatLogEntry(entry);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'debug':
      console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }
}

/**
 * Structured logger with context support
 */
export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, error?: Error, context?: LogContext) => {
    log('error', message, context, {
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  },
};

/**
 * Track database query performance
 * Logs warning if query exceeds threshold
 */
export async function trackQuery<T>(
  name: string,
  queryFn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = performance.now();
  try {
    const result = await queryFn();
    const duration = Math.round(performance.now() - start);

    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(`[SLOW_QUERY] ${name}`, { ...context, duration, threshold: SLOW_QUERY_THRESHOLD_MS });
    } else {
      logger.debug(`[QUERY] ${name}`, { ...context, duration });
    }

    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);
    logger.error(`[QUERY_ERROR] ${name}`, error as Error, { ...context, duration });
    throw error;
  }
}

/**
 * Track cache operations
 */
export function trackCacheHit(cacheName: string, key: string, hit: boolean, context?: LogContext) {
  const status = hit ? 'HIT' : 'MISS';
  logger.debug(`[CACHE_${status}] ${cacheName}`, { ...context, key });
}

/**
 * Track API request performance
 */
export function trackApiRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  context?: LogContext
) {
  const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  log(level, `[API] ${method} ${path} ${statusCode}`, context, { duration: durationMs });
}

/**
 * Create a request-scoped logger with context
 */
export function createRequestLogger(requestId: string, tenantId?: string, userId?: string) {
  const baseContext: LogContext = { requestId, tenantId, userId };

  return {
    debug: (message: string, extra?: LogContext) => 
      logger.debug(message, { ...baseContext, ...extra }),
    info: (message: string, extra?: LogContext) => 
      logger.info(message, { ...baseContext, ...extra }),
    warn: (message: string, extra?: LogContext) => 
      logger.warn(message, { ...baseContext, ...extra }),
    error: (message: string, error?: Error, extra?: LogContext) => 
      logger.error(message, error, { ...baseContext, ...extra }),
  };
}

/**
 * Performance timer utility
 */
export function createTimer(name: string, context?: LogContext) {
  const start = performance.now();

  return {
    end: (additionalContext?: LogContext) => {
      const duration = Math.round(performance.now() - start);
      logger.debug(`[TIMER] ${name}`, { ...context, ...additionalContext, duration });
      return duration;
    },
    warn: (threshold: number, additionalContext?: LogContext) => {
      const duration = Math.round(performance.now() - start);
      if (duration > threshold) {
        logger.warn(`[SLOW] ${name}`, { ...context, ...additionalContext, duration, threshold });
      }
      return duration;
    },
  };
}

/**
 * Metrics collector for aggregation
 */
class MetricsCollector {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  increment(name: string, value = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  record(name: string, value: number) {
    const existing = this.histograms.get(name) || [];
    existing.push(value);
    // Keep last 1000 values
    if (existing.length > 1000) {
      existing.shift();
    }
    this.histograms.set(name, existing);
  }

  getStats(name: string): { count: number; avg: number; p50: number; p95: number; p99: number } | null {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const avg = sorted.reduce((a, b) => a + b, 0) / count;
    const p50 = sorted[Math.floor(count * 0.5)];
    const p95 = sorted[Math.floor(count * 0.95)];
    const p99 = sorted[Math.floor(count * 0.99)];

    return { count, avg: Math.round(avg), p50, p95, p99 };
  }

  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  getAllStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = {
      counters: Object.fromEntries(this.counters),
      histograms: {},
    };

    for (const name of this.histograms.keys()) {
      (stats.histograms as Record<string, unknown>)[name] = this.getStats(name);
    }

    return stats;
  }

  reset() {
    this.counters.clear();
    this.histograms.clear();
  }
}

export const metrics = new MetricsCollector();

// Convenience functions for common metrics
export function recordQueryTime(queryName: string, durationMs: number) {
  metrics.record(`query.${queryName}`, durationMs);
  if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
    metrics.increment('query.slow');
  }
}

export function recordCacheMetric(cacheName: string, hit: boolean) {
  metrics.increment(`cache.${cacheName}.${hit ? 'hit' : 'miss'}`);
}

export function recordApiMetric(method: string, statusCode: number, durationMs: number) {
  metrics.increment(`api.${method}.${statusCode}`);
  metrics.record(`api.${method}.duration`, durationMs);
}
