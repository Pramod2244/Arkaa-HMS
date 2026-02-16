import { z } from "zod";

// =====================================================
// OP SALE SCHEMAS
// =====================================================

export const OPSaleItemInputSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  discount: z.coerce.number().min(0, "Discount cannot be negative").default(0),
});

export const CreateOPSaleSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  storeId: z.string().uuid("Invalid store ID"),
  visitId: z.string().uuid("Invalid visit ID").optional().or(z.literal("")),
  prescriptionId: z.string().uuid("Invalid prescription ID").optional().or(z.literal("")),
  creditAllowed: z.boolean().default(false),
  notes: z.string().max(1000).optional().or(z.literal("")),
  items: z.array(OPSaleItemInputSchema).min(1, "At least one item is required"),
});

export const OPSaleQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "COMPLETED", "CANCELLED", "RETURNED", "ALL"]).default("ALL"),
  storeId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const SaleApproveSchema = z.object({
  version: z.coerce.number().int().positive("Version required"),
});

export const SaleCancelSchema = z.object({
  version: z.coerce.number().int().positive("Version required"),
});

export type CreateOPSaleInput = z.infer<typeof CreateOPSaleSchema>;
export type OPSaleQueryInput = z.infer<typeof OPSaleQuerySchema>;

// =====================================================
// IP SALE SCHEMAS
// =====================================================

export const IPSaleItemInputSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  discount: z.coerce.number().min(0, "Discount cannot be negative").default(0),
});

export const CreateIPSaleSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  storeId: z.string().uuid("Invalid store ID"),
  admissionId: z.string().uuid("Invalid admission ID").optional().or(z.literal("")),
  visitId: z.string().uuid("Invalid visit ID").optional().or(z.literal("")),
  invoiceId: z.string().uuid("Invalid invoice ID").optional().or(z.literal("")),
  prescriptionId: z.string().uuid("Invalid prescription ID").optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  items: z.array(IPSaleItemInputSchema).min(1, "At least one item is required"),
});

export const IPSaleQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "COMPLETED", "CANCELLED", "RETURNED", "ALL"]).default("ALL"),
  storeId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  admissionId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type CreateIPSaleInput = z.infer<typeof CreateIPSaleSchema>;
export type IPSaleQueryInput = z.infer<typeof IPSaleQuerySchema>;

// =====================================================
// CREDIT LEDGER SCHEMAS
// =====================================================

export const CreditLedgerQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  referenceType: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type CreditLedgerQueryInput = z.infer<typeof CreditLedgerQuerySchema>;

// =====================================================
// STOCK CHECK SCHEMA
// =====================================================

export const StockCheckSchema = z.object({
  storeId: z.string().uuid("Invalid store ID"),
  productId: z.string().uuid("Invalid product ID"),
});

export type StockCheckInput = z.infer<typeof StockCheckSchema>;
