/**
 * HMS Phase-1 Hardening: Audit Logging
 * 
 * ASYNC, NON-BLOCKING audit logging.
 * 
 * Audit events are queued and processed asynchronously.
 * Clinical workflows MUST NOT be blocked by audit writes.
 * 
 * Fallback behavior:
 * - If queue unavailable: batch in memory, flush periodically
 * - If both fail: log error but DON'T block the operation
 */

import { queueAuditEvent, type AuditEvent } from "@/lib/queue/audit-queue";

type AuditParams = {
  tenantId: string | null;
  performedBy: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
};

/**
 * Create audit log entry (ASYNC, NON-BLOCKING)
 * 
 * This function returns immediately. Audit writes happen in background.
 * Failures are logged but DO NOT propagate to the caller.
 */
export async function createAuditLog(params: AuditParams): Promise<void> {
  try {
    // Queue the audit event (non-blocking)
    await queueAuditEvent({
      tenantId: params.tenantId,
      performedBy: params.performedBy,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      oldValue: params.oldValue,
      newValue: params.newValue,
    });
  } catch (e) {
    // CRITICAL: Never let audit failures block operations
    console.error("[Audit] Failed to queue audit log:", e);
  }
}

/**
 * Create multiple audit logs at once (batch operation)
 * More efficient for bulk operations
 */
export async function createAuditLogs(params: AuditParams[]): Promise<void> {
  try {
    const { queueAuditEvents } = await import("@/lib/queue/audit-queue");
    await queueAuditEvents(params.map(p => ({
      tenantId: p.tenantId,
      performedBy: p.performedBy,
      entityType: p.entityType,
      entityId: p.entityId,
      action: p.action,
      oldValue: p.oldValue,
      newValue: p.newValue,
    })));
  } catch (e) {
    console.error("[Audit] Failed to queue batch audit logs:", e);
  }
}

// Re-export types and utilities for convenience
export type { AuditEvent } from "@/lib/queue/audit-queue";
export { getAuditQueueStats } from "@/lib/queue/audit-queue";
