import { z } from "zod";

// =====================================================
// PURCHASE ORDER SCHEMAS
// =====================================================

export const PurchaseOrderItemInputSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  quantityOrdered: z.coerce.number().int().positive("Quantity must be positive"),
  unitCost: z.coerce.number().positive("Unit cost must be positive"),
  tax: z.coerce.number().min(0, "Tax cannot be negative").default(0),
});

export const CreatePurchaseOrderSchema = z.object({
  vendorId: z.string().uuid("Invalid vendor ID"),
  orderDate: z.string().min(1, "Order date is required"),
  expectedDate: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  items: z.array(PurchaseOrderItemInputSchema).min(1, "At least one item is required"),
});

export const UpdatePurchaseOrderSchema = z.object({
  vendorId: z.string().uuid("Invalid vendor ID").optional(),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  items: z.array(PurchaseOrderItemInputSchema).min(1, "At least one item is required").optional(),
  version: z.coerce.number().int().positive("Version required for optimistic locking"),
});

export const PurchaseOrderQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["DRAFT", "APPROVED", "SENT", "PARTIAL", "RECEIVED", "CANCELLED", "ALL"]).default("ALL"),
  vendorId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const PurchaseOrderStatusChangeSchema = z.object({
  version: z.coerce.number().int().positive("Version required"),
});

export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof UpdatePurchaseOrderSchema>;
export type PurchaseOrderQueryInput = z.infer<typeof PurchaseOrderQuerySchema>;

// =====================================================
// GOODS RECEIPT SCHEMAS
// =====================================================

export const GoodsReceiptItemInputSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  batchNumber: z.string().min(1, "Batch number is required").max(100),
  manufacturingDate: z.string().optional().or(z.literal("")),
  expiryDate: z.string().min(1, "Expiry date is required"),
  quantityReceived: z.coerce.number().int().positive("Quantity must be positive"),
  quantityRejected: z.coerce.number().int().min(0, "Rejected quantity cannot be negative").default(0),
  unitCost: z.coerce.number().positive("Unit cost must be positive"),
});

export const CreateGoodsReceiptSchema = z.object({
  purchaseOrderId: z.string().uuid("Invalid purchase order ID"),
  storeId: z.string().uuid("Invalid store ID"),
  vendorInvoiceNumber: z.string().max(100).optional().or(z.literal("")),
  receivedDate: z.string().min(1, "Received date is required"),
  items: z.array(GoodsReceiptItemInputSchema).min(1, "At least one item is required"),
});

export const GoodsReceiptQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["RECEIVED", "PARTIAL", "REJECTED", "ALL"]).default("ALL"),
  purchaseOrderId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type CreateGoodsReceiptInput = z.infer<typeof CreateGoodsReceiptSchema>;
export type GoodsReceiptQueryInput = z.infer<typeof GoodsReceiptQuerySchema>;
