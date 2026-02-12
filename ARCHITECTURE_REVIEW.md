# HMS Architecture Review - Principal Software Architect Assessment

**Review Date**: January 2025  
**Target Scale**: Lakhs to Crores of records  
**Use Case**: Multi-tenant Hospital Management System (24x7 Operations)

---

## Executive Summary

The current HMS architecture provides a solid foundation for a multi-tenant healthcare application but requires **significant enhancements** to handle production-scale traffic (lakhs to crores of records) with zero performance degradation. This document identifies critical gaps and provides a roadmap for scalability.

### Overall Assessment: ⚠️ **Needs Architectural Investment**

| Category | Current State | Production Readiness |
|----------|--------------|---------------------|
| Database Schema | Good indexes, multi-tenant ready | 🟡 70% |
| Pagination | Offset-based (non-scalable) | 🔴 30% |
| Caching | None implemented | 🔴 0% |
| Async Operations | None (synchronous audit) | 🔴 10% |
| Connection Pooling | Basic Prisma pooling | 🟡 50% |
| Rate Limiting | Not implemented | 🔴 0% |
| CQRS | Not implemented | 🔴 0% |
| Background Jobs | Not implemented | 🔴 0% |
| Data Partitioning | Not implemented | 🔴 0% |

---

## 1. DATABASE & QUERY PATTERNS

### 1.1 Current Strengths ✅

```plaintext
GOOD: Comprehensive indexing strategy
- @@index([tenantId]) on ALL tenant-scoped tables
- Composite indexes for hot queries:
  - @@index([tenantId, appointmentDate])
  - @@index([tenantId, doctorMasterId, appointmentDate])
  - @@index([tenantId, doctorMasterId, appointmentDate, appointmentTime])
  - @@index([tenantId, status])
  - @@index([entityType, entityId]) on AuditLog

GOOD: UUID primary keys (scalable distribution)
GOOD: Soft delete pattern on critical entities
GOOD: Proper foreign key relationships with cascading
```

### 1.2 Critical Issues 🔴

#### Issue 1: Offset Pagination (CRITICAL)

**Current Pattern** (found in ALL services):
```typescript
// lib/services/patients.ts, visits.ts, appointments.ts, etc.
skip: (page - 1) * limit,
take: limit,
```

**Problem**: Offset pagination becomes exponentially slower with scale:
- Page 1 (10 records): ~5ms
- Page 1000 (10 records): ~500ms  
- Page 100000 (10 records): ~50s+ (unacceptable)

PostgreSQL must scan ALL rows up to the offset, then discard them.

**Solution**: Implement cursor-based pagination:

```typescript
// Recommended pattern
interface CursorPagination {
  cursor?: string; // Last seen ID
  limit: number;
  direction: 'forward' | 'backward';
}

// Example implementation
async function getPatientsCursor(
  tenantId: string,
  { cursor, limit = 20 }: CursorPagination
) {
  const where: Prisma.PatientWhereInput = { tenantId };
  
  if (cursor) {
    where.id = { gt: cursor }; // UUID comparison works!
  }
  
  const patients = await prisma.patient.findMany({
    where,
    take: limit + 1, // Fetch one extra to detect "hasMore"
    orderBy: { id: 'asc' },
  });
  
  const hasMore = patients.length > limit;
  const data = hasMore ? patients.slice(0, -1) : patients;
  
  return {
    data,
    nextCursor: hasMore ? data[data.length - 1].id : null,
    hasMore,
  };
}
```

#### Issue 2: N+1 Query Patterns (HIGH RISK)

**Current Pattern**:
```typescript
// lib/services/consultations.ts - Heavy includes
include: {
  visit: {
    include: {
      patient: { select: {...} },
      appointment: {
        select: {
          department: { select: {...} }
        }
      },
      vitals: [...],
      prescriptions: { include: { items: [...] } }
    }
  }
}
```

**Problem**: Deep nested includes can explode into 10+ queries per request.

**Solution**: Use `relationLoadStrategy: 'join'` for critical queries:

```typescript
// Prisma 5.9+ feature
const result = await prisma.consultation.findMany({
  relationLoadStrategy: 'join', // Single SQL query with JOINs
  where: { tenantId },
  include: { visit: { include: { patient: true } } },
});
```

#### Issue 3: Unoptimized Search Queries (MEDIUM)

**Current Pattern**:
```typescript
// lib/services/patients.ts
where: {
  OR: [
    { firstName: { contains: search, mode: 'insensitive' } },
    { lastName: { contains: search, mode: 'insensitive' } },
    { uhid: { contains: search, mode: 'insensitive' } },
    { phoneNumber: { contains: search, mode: 'insensitive' } },
  ]
}
```

**Problem**: `ILIKE` with `%search%` cannot use B-tree indexes.

**Solution**: Add PostgreSQL trigram indexes for text search:

```sql
-- Migration: Add trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN indexes for text search
CREATE INDEX idx_patient_firstname_trgm ON "Patient" 
  USING GIN ("firstName" gin_trgm_ops);
CREATE INDEX idx_patient_phone_trgm ON "Patient" 
  USING GIN ("phoneNumber" gin_trgm_ops);
CREATE INDEX idx_patient_uhid_trgm ON "Patient" 
  USING GIN ("uhid" gin_trgm_ops);
```

Or implement a search table with materialized views for dashboards.

---

## 2. CACHING STRATEGY (NOT IMPLEMENTED)

### 2.1 Current State: No Caching 🔴

Every request hits the database directly:
- Permission checks query DB on EVERY request
- Master data (departments, doctors) queried repeatedly
- Same patient data fetched multiple times in a session

### 2.2 Recommended Caching Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CACHING LAYERS                           │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: In-Memory (Node.js Process)                           │
│  ├─ TTL: 60s                                                    │
│  ├─ Items: User permissions, active session data                │
│  └─ Library: lru-cache (already in deps)                       │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Redis (Distributed)                                   │
│  ├─ TTL: 5-30 minutes                                          │
│  ├─ Items: Master data, dashboard aggregates, RBAC             │
│  └─ Pattern: Cache-aside with write-through invalidation       │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: CDN/Edge (Static Assets)                              │
│  └─ Items: UI assets, API responses for public data            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Priority Caching Targets

| Data | TTL | Invalidation Trigger |
|------|-----|---------------------|
| User Permissions | 5 min | Role/Permission change |
| Department List | 30 min | Department CRUD |
| Doctor List | 15 min | Doctor CRUD |
| Today's Queue Count | 30 sec | Visit status change |
| Dashboard Stats | 1 min | Any transaction |

### 2.4 Implementation Example

```typescript
// lib/cache/permission-cache.ts
import { LRUCache } from 'lru-cache';

const permissionCache = new LRUCache<string, string[]>({
  max: 1000, // Max 1000 users cached
  ttl: 1000 * 60 * 5, // 5 minutes
});

export async function getCachedPermissions(
  userId: string,
  tenantId: string
): Promise<string[]> {
  const key = `${tenantId}:${userId}:perms`;
  
  let permissions = permissionCache.get(key);
  if (!permissions) {
    permissions = await getUserPermissionCodes(userId, tenantId);
    permissionCache.set(key, permissions);
  }
  
  return permissions;
}

export function invalidateUserPermissions(userId: string, tenantId: string) {
  permissionCache.delete(`${tenantId}:${userId}:perms`);
}
```

---

## 3. RBAC SYSTEM (CRITICAL PERFORMANCE ISSUE)

### 3.1 Current Implementation Problems

**File**: `lib/rbac.ts`

```typescript
// PROBLEM: Queries DB on EVERY permission check
export async function getUserPermissionCodes(userId, tenantId) {
  // This runs on EVERY API request!
  const userWithRoles = await prisma.user.findUnique({...});
  
  // For ADMIN: Fetches ALL permissions from DB every time
  if (hasAdminRole) {
    const allPermissions = await prisma.permission.findMany({...});
    return allPermissions.map(p => p.code);
  }
  // ...
}
```

**Impact**: At 100 RPS, this generates 100+ DB queries/second just for permission checks.

### 3.2 Recommended Solution

1. **Cache permissions in JWT token** (for non-ADMIN users):
```typescript
// lib/auth.ts - Enhanced token creation
export async function createTenantToken(user, tenantId) {
  const permissions = await getUserPermissionCodes(user.id, tenantId);
  
  return new SignJWT({
    userId: user.id,
    tenantId,
    permissions, // ← Embed in token
    permissionsVersion: Date.now(), // For cache busting
  })
  .setExpirationTime('7d')
  .sign(secret);
}
```

2. **For ADMIN users**: Cache in Redis with short TTL (1 min)

3. **Permission version tracking**: Store a `permissionVersion` in TenantSetting. Compare with token version to force refresh.

---

## 4. AUDIT LOGGING (CRITICAL FOR COMPLIANCE)

### 4.1 Current Implementation: Synchronous Blocking

```typescript
// lib/audit.ts
export async function createAuditLog(params) {
  try {
    await prisma.auditLog.create({ data: {...} }); // ← BLOCKING!
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}
```

**Problems**:
1. **Latency**: Every operation waits for audit log write (~5-15ms)
2. **Failure Impact**: If audit DB is slow, all operations are slow
3. **Scale**: At 10K ops/day = 10K audit writes (table grows rapidly)

### 4.2 Recommended: Async Event-Driven Audit

```
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   API Route   │ ──▶  │  Event Queue  │ ──▶  │ Audit Worker  │
│ (Non-blocking)│      │ (Redis/BullMQ)│      │ (Background)  │
└───────────────┘      └───────────────┘      └───────────────┘
                                                      │
                                              ┌───────▼───────┐
                                              │   AuditLog    │
                                              │   (Batch      │
                                              │    Inserts)   │
                                              └───────────────┘
```

**Implementation**:

```typescript
// lib/audit-queue.ts
import { Queue } from 'bullmq';

const auditQueue = new Queue('audit-logs', {
  connection: { host: 'localhost', port: 6379 },
  defaultJobOptions: {
    removeOnComplete: true,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

export async function queueAuditLog(params: AuditParams) {
  await auditQueue.add('audit', params);
}

// Worker process (separate file)
const worker = new Worker('audit-logs', async (job) => {
  await prisma.auditLog.create({ data: job.data });
}, { connection: {...} });
```

### 4.3 AuditLog Table Partitioning

For crores of records, partition by month:

```sql
-- Convert to partitioned table
CREATE TABLE "AuditLog_new" (
  id UUID DEFAULT gen_random_uuid(),
  "tenantId" UUID,
  "performedBy" UUID,
  "performedAt" TIMESTAMP DEFAULT NOW(),
  "entityType" TEXT,
  "entityId" UUID,
  action TEXT,
  "oldValue" JSONB,
  "newValue" JSONB,
  PRIMARY KEY (id, "performedAt")
) PARTITION BY RANGE ("performedAt");

-- Create monthly partitions
CREATE TABLE "AuditLog_2025_01" PARTITION OF "AuditLog_new"
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE "AuditLog_2025_02" PARTITION OF "AuditLog_new"
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- ... automate via cron job
```

---

## 5. CONNECTION POOLING

### 5.1 Current State

```typescript
// lib/prisma.ts - Basic singleton pattern
const adapter = new PrismaPg({ connectionString });
return new PrismaClient({ adapter, log: [...] });
```

**Issues**:
- No explicit pool size configuration
- No connection health checks
- Relies on Prisma defaults (which may not be optimal)

### 5.2 Recommended Configuration

```typescript
// lib/prisma.ts - Production configuration
import { Pool } from 'pg';

function createPrisma() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Match expected concurrent connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // For serverless:
    // maxUses: 7500, // Close connection after N queries
  });
  
  // Health check
  pool.on('error', (err) => {
    console.error('Unexpected pool error', err);
  });
  
  const adapter = new PrismaPg({ pool });
  return new PrismaClient({ adapter });
}
```

For **Vercel/Serverless**: Use `@prisma/extension-accelerate` or PgBouncer.

---

## 6. API SECURITY & RATE LIMITING

### 6.1 Current State: No Rate Limiting 🔴

```typescript
// middleware.ts - Only JWT verification
export async function middleware(request) {
  // No rate limiting
  // No request size limits
  // No IP-based blocking
}
```

**Risk**: Vulnerable to DDoS, brute force, and API abuse.

### 6.2 Recommended Implementation

```typescript
// middleware.ts - Enhanced with rate limiting
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '60 s'), // 100 req/min
  analytics: true,
});

export async function middleware(request) {
  // Rate limit by tenant + user
  const identifier = `${tenantId}:${userId}`;
  const { success, remaining, reset } = await ratelimit.limit(identifier);
  
  if (!success) {
    return new Response('Rate limit exceeded', {
      status: 429,
      headers: {
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
      },
    });
  }
  // ... continue with auth
}
```

### 6.3 Rate Limit Tiers

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Login attempts | 5 | 15 min |
| Patient search | 30 | 1 min |
| Appointment booking | 10 | 1 min |
| Dashboard queries | 60 | 1 min |
| Bulk operations | 5 | 5 min |

---

## 7. CQRS PATTERN (RECOMMENDED FOR DASHBOARDS)

### 7.1 Problem: Dashboard Performance

Current dashboards query operational tables directly:
- OPD Queue: Joins Visit + Patient + Doctor + Appointment
- Statistics: Count queries on large tables
- Reports: Aggregations across date ranges

### 7.2 Solution: Read Models with Materialized Views

```
WRITE PATH                          READ PATH
─────────────                       ──────────
┌──────────┐    Events    ┌──────────────────────┐
│ API      │ ───────────▶ │ Event Store          │
│ (Create/ │              │ (Kafka/Redis Streams)│
│  Update) │              └──────────┬───────────┘
└──────────┘                         │
                                     ▼
                        ┌────────────────────────┐
                        │  Projection Workers    │
                        │  - OPD Queue View      │
                        │  - Dashboard Stats     │
                        │  - Doctor Schedule     │
                        └────────────┬───────────┘
                                     │
                                     ▼
                        ┌────────────────────────┐
                        │  Read-Optimized Store  │
                        │  (Redis / Read Replica)│
                        └────────────────────────┘
```

### 7.3 Quick Win: PostgreSQL Materialized Views

```sql
-- Dashboard stats materialized view
CREATE MATERIALIZED VIEW mv_dashboard_stats AS
SELECT 
  "tenantId",
  DATE("createdAt") as date,
  COUNT(*) FILTER (WHERE "entityType" = 'PATIENT') as new_patients,
  COUNT(*) FILTER (WHERE "entityType" = 'VISIT') as total_visits,
  COUNT(*) FILTER (WHERE "entityType" = 'APPOINTMENT') as appointments
FROM "AuditLog"
WHERE "performedAt" > NOW() - INTERVAL '90 days'
GROUP BY "tenantId", DATE("createdAt");

-- Refresh periodically
CREATE INDEX ON mv_dashboard_stats("tenantId", date);

-- Refresh via cron (every 5 min)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_stats;
```

---

## 8. BACKGROUND JOB PROCESSING

### 8.1 Use Cases Requiring Background Jobs

| Task | Current | Should Be |
|------|---------|-----------|
| Audit logging | Sync | Async queue |
| Email notifications | Not implemented | BullMQ |
| Report generation | Not implemented | BullMQ |
| Data cleanup | Not implemented | Scheduled job |
| Analytics aggregation | Not implemented | Scheduled job |

### 8.2 Recommended Stack

```typescript
// package.json additions
{
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.0"
  }
}

// lib/queue/index.ts
import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL);

export const auditQueue = new Queue('audit', { connection });
export const emailQueue = new Queue('email', { connection });
export const reportQueue = new Queue('reports', { connection });

// Worker registration (run in separate process)
// workers/audit-worker.ts
import { Worker } from 'bullmq';

new Worker('audit', async (job) => {
  await prisma.auditLog.createMany({ data: job.data });
}, { connection, concurrency: 10 });
```

---

## 9. MULTI-TENANT DATA ISOLATION

### 9.1 Current Implementation: Row-Level Filtering ✅

```typescript
// Good: Every query includes tenantId
where: { tenantId, ...filters }
```

### 9.2 Enhancement: Row-Level Security (RLS)

Add PostgreSQL RLS as defense-in-depth:

```sql
-- Enable RLS on sensitive tables
ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY tenant_isolation ON "Patient"
  USING ("tenantId" = current_setting('app.tenant_id')::uuid);

-- Set tenant context per request
SET app.tenant_id = 'tenant-uuid-here';
```

**Implementation in Prisma**:
```typescript
// lib/prisma.ts
export async function withTenant<T>(
  tenantId: string,
  operation: () => Promise<T>
): Promise<T> {
  await prisma.$executeRaw`SET app.tenant_id = ${tenantId}`;
  try {
    return await operation();
  } finally {
    await prisma.$executeRaw`RESET app.tenant_id`;
  }
}
```

---

## 10. INFRASTRUCTURE RECOMMENDATIONS

### 10.1 Database Scaling Path

```
Phase 1 (Current - 10K records)
├─ Single PostgreSQL instance
└─ Basic indexes

Phase 2 (100K - 1M records)
├─ Read replicas (2-3)
├─ Connection pooling (PgBouncer)
├─ Query optimization
└─ Caching layer (Redis)

Phase 3 (1M - 1Cr records)  
├─ Table partitioning (by tenant or date)
├─ Materialized views for dashboards
├─ CQRS for heavy read paths
└─ Consider sharding hot tables

Phase 4 (1Cr+ records)
├─ Multi-region deployment
├─ Database sharding by tenant
├─ Dedicated infrastructure per large tenant
└─ Event sourcing for audit trail
```

### 10.2 Recommended Architecture Diagram

```
                                    ┌──────────────────┐
                                    │   CloudFlare/    │
                                    │   WAF + CDN      │
                                    └────────┬─────────┘
                                             │
                                    ┌────────▼─────────┐
                                    │  Load Balancer   │
                                    │  (Rate Limiting) │
                                    └────────┬─────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
    ┌─────────▼─────────┐      ┌─────────────▼───────────┐     ┌──────────▼──────────┐
    │   Next.js App     │      │      Next.js App        │     │    Next.js App      │
    │   (Instance 1)    │      │      (Instance 2)       │     │    (Instance 3)     │
    └─────────┬─────────┘      └─────────────┬───────────┘     └──────────┬──────────┘
              │                              │                             │
              └──────────────────────────────┼─────────────────────────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
    ┌─────────▼─────────┐      ┌─────────────▼───────────┐     ┌──────────▼──────────┐
    │   Redis Cluster   │      │     PostgreSQL          │     │   BullMQ Workers    │
    │   (Cache + Queue) │      │   Primary + Replicas    │     │   (Background Jobs) │
    └───────────────────┘      └─────────────────────────┘     └─────────────────────┘
```

---

## 11. IMPLEMENTATION PRIORITY MATRIX

### 11.1 High Impact, Low Effort (Do First)

| Task | Impact | Effort | Timeline |
|------|--------|--------|----------|
| Add permission caching | 🔥 High | 2 days | Week 1 |
| Convert to cursor pagination | 🔥 High | 3 days | Week 1-2 |
| Add rate limiting | 🔥 High | 1 day | Week 1 |
| Configure connection pool | Medium | 1 day | Week 1 |

### 11.2 High Impact, Medium Effort (Sprint 2)

| Task | Impact | Effort | Timeline |
|------|--------|--------|----------|
| Async audit logging | 🔥 High | 1 week | Week 2-3 |
| Redis caching layer | 🔥 High | 1 week | Week 2-3 |
| Trigram search indexes | Medium | 2 days | Week 2 |
| Dashboard materialized views | Medium | 3 days | Week 3 |

### 11.3 High Impact, High Effort (Phase 2)

| Task | Impact | Effort | Timeline |
|------|--------|--------|----------|
| CQRS implementation | 🔥 High | 2-3 weeks | Month 2 |
| Table partitioning | 🔥 High | 1 week | Month 2 |
| Background job system | Medium | 1 week | Month 2 |
| Read replicas setup | High | 1 week | Month 2 |

---

## 12. IMMEDIATE ACTION ITEMS

### Week 1 Checklist

- [ ] Add `lru-cache` for in-memory permission caching
- [ ] Implement cursor pagination in `getPatients`, `getAppointments`
- [ ] Add rate limiting middleware with Upstash or in-memory
- [ ] Configure explicit connection pool limits in `lib/prisma.ts`
- [ ] Add indexes for text search (trigram or full-text)

### Week 2 Checklist

- [ ] Set up Redis for distributed caching
- [ ] Implement master data caching (departments, doctors)
- [ ] Create async audit queue with BullMQ
- [ ] Add dashboard materialized views
- [ ] Set up monitoring (query times, cache hit rates)

---

## 13. MONITORING & OBSERVABILITY (MISSING)

### 13.1 Required Additions

```typescript
// Recommended: Add query timing
const startTime = Date.now();
const result = await prisma.patient.findMany({...});
console.log(`Query took ${Date.now() - startTime}ms`);

// Better: Use Prisma metrics
const prisma = new PrismaClient({
  log: [{ emit: 'event', level: 'query' }],
});

prisma.$on('query', (e) => {
  if (e.duration > 100) {
    console.warn(`Slow query (${e.duration}ms): ${e.query}`);
  }
});
```

### 13.2 Key Metrics to Track

- P95 query latency by endpoint
- Cache hit ratio
- Queue depth and processing time
- Database connection pool utilization
- Error rates by tenant

---

## CONCLUSION

The HMS application has a well-structured codebase with proper multi-tenant isolation and comprehensive indexing. However, to handle lakhs to crores of records with 24x7 operation, the following critical investments are required:

1. **Immediate**: Caching (permissions, master data) + Cursor pagination
2. **Short-term**: Async audit logging + Rate limiting
3. **Medium-term**: CQRS for dashboards + Table partitioning
4. **Long-term**: Event-driven architecture + Database sharding

Estimated effort for production-ready scale: **6-8 weeks** of dedicated architecture work.

---

*Document prepared by: Principal Software Architect Review*  
*Next Review: After Phase 1 implementation*
