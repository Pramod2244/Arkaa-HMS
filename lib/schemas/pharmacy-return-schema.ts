import { z } from "zod";

// =====================================================
// PHARMACY RETURN SCHEMAS
// =====================================================

export const ReturnItemInputSchema = z.object({
  saleItemId: z.string().uuid("Invalid sale item ID"),
  productId: z.string().uuid("Invalid product ID"),
  batchNumber: z.string().min(1, "Batch number required"),
  expiryDate: z.string().min(1, "Expiry date required"),
  quantityReturned: z.coerce.number().positive("Quantity must be positive"),
});

export const CreateReturnSchema = z.object({
  saleId: z.string().uuid("Invalid sale ID"),
  reason: z.string().min(1, "Reason is required").max(1000, "Reason too long"),
  items: z.array(ReturnItemInputSchema).min(1, "At least one return item is required"),
});

export const ReturnQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["DRAFT", "APPROVED", "CANCELLED", "ALL"]).default("ALL"),
  returnType: z.enum(["OP_RETURN", "IP_RETURN", "ALL"]).default("ALL"),
  saleId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const ReturnApproveSchema = z.object({
  version: z.coerce.number().int().positive("Version required"),
});

export const ReturnCancelSchema = z.object({
  version: z.coerce.number().int().positive("Version required"),
});

export type CreateReturnInput = z.infer<typeof CreateReturnSchema>;
export type ReturnQueryInput = z.infer<typeof ReturnQuerySchema>;
