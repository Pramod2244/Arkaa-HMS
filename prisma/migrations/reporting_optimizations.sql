-- HMS Reporting Module: Additive Optimizations
-- These indexes and views are non-invasive and improve read performance for 500+ hospitals.

-- 1. Optimized Indices for Billing Reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_reporting 
ON "Invoice" ("tenantId", "invoiceDate" DESC, "status", "outstanding");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_reporting 
ON "Payment" ("tenantId", "paymentDate" DESC, "amount");

-- 2. Optimized Indices for Clinical Reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultation_reporting 
ON "Consultation" ("tenantId", "doctorMasterId", "status", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vital_reporting 
ON "Vital" ("tenantId", "recordedAt" DESC);

-- 3. Optimized Indices for Inventory & Pharmacy
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_ledger_reporting 
ON "InventoryLedger" ("tenantId", "productId", "storeId", "expiryDate");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pharmacy_sale_reporting 
ON "PharmacySale" ("tenantId", "createdAt" DESC, "status", "isDeleted");

-- 4. Materialized View for Daily Departmental Revenue
-- This offloads heavy aggregation from the primary 'Invoice' table.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dept_revenue_daily AS
SELECT 
    i."tenantId",
    v."departmentId",
    d."name" as "departmentName",
    DATE(i."invoiceDate") as "reportDate",
    SUM(i."total") as "revenue",
    COUNT(i."id") as "invoiceCount"
FROM "Invoice" i
JOIN "Visit" v ON i."visitId" = v.id
JOIN "Department" d ON v."departmentId" = d.id
WHERE i."status" IN ('PAID', 'PARTIAL', 'FINAL')
GROUP BY i."tenantId", v."departmentId", d."name", DATE(i."invoiceDate");

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dept_revenue_pk 
ON mv_dept_revenue_daily ("tenantId", "departmentId", "reportDate");

-- 5. Materialized View for Current Product Stock (Per Store)
-- This eliminates the need to scan millions of rows in 'InventoryLedger' for every stock check.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_current_stock AS
SELECT 
    "tenantId",
    "storeId",
    "productId",
    "batchNumber",
    "expiryDate",
    SUM("quantityChange") as "availableQty"
FROM "InventoryLedger"
GROUP BY "tenantId", "storeId", "productId", "batchNumber", "expiryDate"
HAVING SUM("quantityChange") > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_current_stock_pk 
ON mv_current_stock ("tenantId", "storeId", "productId", "batchNumber");
