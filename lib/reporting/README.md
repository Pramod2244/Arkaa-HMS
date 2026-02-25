# HMS Non-Invasive Reporting Module

## 🏗️ Architecture Summary

This module implements an enterprise-grade reporting system for a multi-tenant Hospital Management System (HMS), scaling to 500+ hospitals and 5000+ concurrent users.

### 🛑 Core Mandates
- **Non-Invasive:** Existing domain models and transactional logic are untouched.
- **Strict Isolation:** `tenantId` enforcement is mandatory in all reporting queries.
- **Scalable:** Heavy aggregations are offloaded to Materialized Views (MV) and background workers.
- **Pagination:** Exclusively uses cursor-based pagination (no offset `skip`).

## 📁 Folder Structure

- `lib/reporting/`: Contains specialized reporting services (Billing, Clinical, Pharmacy, Inventory, Audit).
- `workers/reportingWorker.ts`: A BullMQ-powered background worker for Materialized View refreshes.
- `prisma/migrations/reporting_optimizations.sql`: Additive indexing and Materialized View definitions.

## 📈 Reporting Services

| Service | Focus | Primary Table(s) |
| --- | --- | --- |
| `billingReports.ts` | Revenue, Collections, Dues | `Invoice`, `Payment` |
| `clinicalReports.ts` | Doctor Performance, Patient Trends | `Consultation`, `Visit` |
| `pharmacyReports.ts` | Sales Trends, Top Products | `PharmacySale`, `Product` |
| `inventoryReports.ts` | Stock Summary, Expiry, Reorder Alerts | `InventoryLedger`, `Product` |
| `auditReports.ts` | User Activity, Security Audits | `AuditLog` |

## 🚀 Performance Optimizations

### 1. Materialized Views
Heavy cross-table joins (e.g., Departmental Revenue, Stock Summary) are offloaded to `mv_dept_revenue_daily` and `mv_current_stock`. These are refreshed asynchronously by the `reportingWorker`.

### 2. Additive Indexing
Indices are designed to be "CONCURRENTLY" applied to existing large tables (`Invoice`, `InventoryLedger`, `AuditLog`) to ensure zero-downtime and minimal write impact.

### 3. Cursor-based Pagination
Uses `(createdAt, id)` or `(performedAt, id)` compound cursors to maintain O(1) performance even for hospitals with millions of records.

## 🛠️ Usage Example

```typescript
import { getRevenueByDepartment } from "@/lib/reporting/billingReports";

const revenue = await getRevenueByDepartment({
  tenantId: "hospital-a-uuid",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-31"),
});
```

## ⚠️ Known Risks
- **Data Freshness:** Materialized Views are refreshed periodically (asynchronously). Real-time reports should still hit the primary table for single-record lookups.
- **Index Storage:** Additive indices increase storage overhead on the database.
