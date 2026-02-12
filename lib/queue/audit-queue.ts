/**
 * HMS Phase-1 Hardening: Audit Queue
 * 
 * Async audit logging using BullMQ (required dependency).
 * Audit writes are NON-BLOCKING - they MUST NOT slow down clinical workflows.
 * 
 * Features:
 * - Fire-and-forget audit events
 * - Batch inserts for efficiency
 * - Retry with exponential backoff
 * - Graceful degradation when Redis unavailable (in-memory fallback)
 * 
 * Required Dependencies:
 * - bullmq: Job queue for async processing
 * - ioredis: Redis client (peer dependency of bullmq)
 * 
 * Environment:
 * - REDIS_URL: Redis connection URL (required for queue mode)
 * - AUDIT_QUEUE_ENABLED: Enable/disable queue (default: true)
 */

import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const AUDIT_QUEUE_ENABLED = process.env.AUDIT_QUEUE_ENABLED !== 'false';
const QUEUE_NAME = 'hms:audit-logs';
const BATCH_SIZE = 50;
const BATCH_TIMEOUT_MS = 5000; // Flush batch every 5 seconds

// Audit event type
export interface AuditEvent {
  tenantId: string | null;
  performedBy: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  timestamp?: Date;
}

// Queue instance (singleton)
let auditQueue: Queue<AuditEvent> | null = null;
let auditWorker: Worker<AuditEvent> | null = null;
let isInitialized = false;
let pendingBatch: AuditEvent[] = [];
let batchTimer: NodeJS.Timeout | null = null;

// Stats for monitoring
const stats = {
  queued: 0,
  processed: 0,
  failed: 0,
  fallbackSync: 0,
  batchFlushes: 0,
};

/**
 * Initialize the audit queue
 */
async function initializeQueue(): Promise<boolean> {
  if (isInitialized) return true;

  if (!AUDIT_QUEUE_ENABLED) {
    console.log('[AuditQueue] Queue disabled via AUDIT_QUEUE_ENABLED=false');
    return false;
  }

  try {
    const connection = {
      url: REDIS_URL,
      maxRetriesPerRequest: 3,
    };

    // Create queue
    auditQueue = new Queue<AuditEvent>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });

    // Create worker (only in non-serverless environments)
    if (typeof window === 'undefined' && process.env.AUDIT_WORKER_ENABLED !== 'false') {
      auditWorker = new Worker<AuditEvent>(
        QUEUE_NAME,
        async (job: Job<AuditEvent>) => {
          await processAuditJob(job.data);
        },
        {
          connection,
          concurrency: 5,
          limiter: {
            max: 100,
            duration: 1000,
          },
        }
      );

      auditWorker.on('completed', () => {
        stats.processed++;
      });

      auditWorker.on('failed', (job, err) => {
        stats.failed++;
        console.error(`[AuditQueue] Job ${job?.id} failed:`, err.message);
      });

      console.log('[AuditQueue] Worker started');
    }

    isInitialized = true;
    console.log('[AuditQueue] Queue initialized with Redis');
    return true;
  } catch (error) {
    console.error('[AuditQueue] Failed to initialize Redis queue:', error);
    console.log('[AuditQueue] Using in-memory batch fallback');
    return false;
  }
}

/**
 * Process a single audit event (called by worker)
 */
async function processAuditJob(event: AuditEvent): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId: event.tenantId,
      performedBy: event.performedBy,
      entityType: event.entityType,
      entityId: event.entityId ?? undefined,
      action: event.action,
      oldValue: event.oldValue != null ? (event.oldValue as object) : undefined,
      newValue: event.newValue != null ? (event.newValue as object) : undefined,
      performedAt: event.timestamp || new Date(),
    },
  });
}

/**
 * Process batch of audit events (more efficient)
 */
async function processBatch(events: AuditEvent[]): Promise<void> {
  if (events.length === 0) return;

  try {
    await prisma.auditLog.createMany({
      data: events.map(event => ({
        tenantId: event.tenantId,
        performedBy: event.performedBy,
        entityType: event.entityType,
        entityId: event.entityId ?? undefined,
        action: event.action,
        oldValue: event.oldValue != null ? (event.oldValue as object) : undefined,
        newValue: event.newValue != null ? (event.newValue as object) : undefined,
        performedAt: event.timestamp || new Date(),
      })),
      skipDuplicates: true,
    });
    
    stats.processed += events.length;
    stats.batchFlushes++;
  } catch (error) {
    console.error('[AuditQueue] Batch processing failed:', error);
    stats.failed += events.length;
    throw error;
  }
}

/**
 * Flush pending batch
 */
async function flushBatch(): Promise<void> {
  if (pendingBatch.length === 0) return;

  const batch = [...pendingBatch];
  pendingBatch = [];

  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  await processBatch(batch);
}

/**
 * Schedule batch flush
 */
function scheduleBatchFlush(): void {
  if (batchTimer) return;
  
  batchTimer = setTimeout(async () => {
    batchTimer = null;
    try {
      await flushBatch();
    } catch (error) {
      console.error('[AuditQueue] Scheduled flush failed:', error);
    }
  }, BATCH_TIMEOUT_MS);

  // Don't block process exit
  if (batchTimer.unref) {
    batchTimer.unref();
  }
}

// ============== PUBLIC API ==============

/**
 * Queue an audit event (NON-BLOCKING)
 * 
 * This function returns immediately. Audit writes happen asynchronously.
 * If the queue is unavailable, falls back to in-memory batching.
 */
export async function queueAuditEvent(event: AuditEvent): Promise<void> {
  const eventWithTimestamp = {
    ...event,
    timestamp: event.timestamp || new Date(),
  };

  // Try queue first
  if (auditQueue || await initializeQueue()) {
    try {
      if (auditQueue) {
        await auditQueue.add('audit', eventWithTimestamp, {
          priority: event.action === 'DELETE' ? 1 : 2,
        });
        stats.queued++;
        return;
      }
    } catch (error) {
      console.error('[AuditQueue] Failed to queue event:', error);
      // Fall through to batch fallback
    }
  }

  // Fallback: Add to in-memory batch
  pendingBatch.push(eventWithTimestamp);
  stats.fallbackSync++;
  
  if (pendingBatch.length >= BATCH_SIZE) {
    // Flush immediately if batch is full
    flushBatch().catch(err => {
      console.error('[AuditQueue] Fallback batch flush failed:', err);
    });
  } else {
    // Schedule flush
    scheduleBatchFlush();
  }
}

/**
 * Queue multiple audit events at once
 */
export async function queueAuditEvents(events: AuditEvent[]): Promise<void> {
  if (events.length === 0) return;

  if (auditQueue || await initializeQueue()) {
    try {
      if (auditQueue) {
        await auditQueue.addBulk(
          events.map(event => ({
            name: 'audit',
            data: { ...event, timestamp: event.timestamp || new Date() },
          }))
        );
        stats.queued += events.length;
        return;
      }
    } catch (error) {
      console.error('[AuditQueue] Failed to queue events:', error);
    }
  }

  // Fallback: Process via batch
  const eventsWithTimestamp = events.map(e => ({
    ...e,
    timestamp: e.timestamp || new Date(),
  }));
  
  pendingBatch.push(...eventsWithTimestamp);
  stats.fallbackSync += events.length;
  
  if (pendingBatch.length >= BATCH_SIZE) {
    flushBatch().catch(err => {
      console.error('[AuditQueue] Fallback batch flush failed:', err);
    });
  } else {
    scheduleBatchFlush();
  }
}

/**
 * Get queue statistics
 */
export function getAuditQueueStats() {
  return {
    ...stats,
    pendingBatch: pendingBatch.length,
    queueEnabled: AUDIT_QUEUE_ENABLED,
    initialized: isInitialized,
    mode: isInitialized ? 'redis' : 'in-memory-batch',
  };
}

/**
 * Graceful shutdown - flush pending events
 */
export async function closeAuditQueue(): Promise<void> {
  try {
    // Flush any pending batch
    await flushBatch();

    // Close worker
    if (auditWorker) {
      await auditWorker.close();
      auditWorker = null;
    }

    // Close queue
    if (auditQueue) {
      await auditQueue.close();
      auditQueue = null;
    }

    isInitialized = false;
    console.log('[AuditQueue] Queue closed');
  } catch (error) {
    console.error('[AuditQueue] Error closing queue:', error);
  }
}

// Initialize on module load (non-blocking)
initializeQueue().catch(err => {
  console.error('[AuditQueue] Background initialization failed:', err);
});
