import { z } from "zod";

// ============== STORE SCHEMA ==============

export const StoreCreateSchema = z.object({
  code: z.string().min(2, "Code must be at least 2 characters"),
  name: z.string().min(3, "Store name required"),
  type: z.enum(["CENTRAL", "OP", "IP", "SUB"], {
    message: "Valid types: CENTRAL, OP, IP, SUB",
  }),
  licenseNumber: z.string().optional().or(z.literal("")),
  gstNumber: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  managerName: z.string().optional().or(z.literal("")),
  contactNumber: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const StoreUpdateSchema = StoreCreateSchema.partial();

export const StoreQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).default("ALL"),
  limit: z.coerce.number().min(10).max(100).default(20),
  cursor: z.string().optional(),
});

export type StoreCreateInput = z.infer<typeof StoreCreateSchema>;
export type StoreUpdateInput = z.infer<typeof StoreUpdateSchema>;
export type StoreQueryInput = z.infer<typeof StoreQuerySchema>;

// ============== MANUFACTURER SCHEMA ==============

export const ManufacturerCreateSchema = z.object({
  code: z.string().min(2, "Code must be at least 2 characters"),
  name: z.string().min(3, "Manufacturer name required"),
  licenseNumber: z.string().optional().or(z.literal("")),
  contactNumber: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const ManufacturerUpdateSchema = ManufacturerCreateSchema.partial();

export const ManufacturerQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).default("ALL"),
  limit: z.coerce.number().min(10).max(100).default(20),
  cursor: z.string().optional(),
});

export type ManufacturerCreateInput = z.infer<typeof ManufacturerCreateSchema>;
export type ManufacturerUpdateInput = z.infer<typeof ManufacturerUpdateSchema>;
export type ManufacturerQueryInput = z.infer<typeof ManufacturerQuerySchema>;

// ============== VENDOR SCHEMA ==============

export const VendorCreateSchema = z.object({
  code: z.string().min(2, "Code must be at least 2 characters"),
  name: z.string().min(3, "Vendor name required"),
  gstNumber: z.string().optional().or(z.literal("")),
  contactPerson: z.string().optional().or(z.literal("")),
  contactNumber: z.string().optional().or(z.literal("")),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const VendorUpdateSchema = VendorCreateSchema.partial();

export const VendorQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).default("ALL"),
  limit: z.coerce.number().min(10).max(100).default(20),
  cursor: z.string().optional(),
});

export type VendorCreateInput = z.infer<typeof VendorCreateSchema>;
export type VendorUpdateInput = z.infer<typeof VendorUpdateSchema>;
export type VendorQueryInput = z.infer<typeof VendorQuerySchema>;

// ============== PRODUCT SCHEMA ==============

export const ProductCreateSchema = z.object({
  code: z.string().min(2, "Code must be at least 2 characters"),
  name: z.string().min(3, "Product name required"),
  genericName: z.string().optional().or(z.literal("")),
  brandName: z.string().optional().or(z.literal("")),
  strength: z.string().optional().or(z.literal("")),
  dosageForm: z.string().optional().or(z.literal("")),
  scheduleType: z.enum(["H", "H1", "X", "OTC"], {
    message: "Valid schedules: H, H1, X, OTC",
  }),
  manufacturerId: z.string().uuid("Invalid manufacturer ID"),
  hsnCode: z.string().optional().or(z.literal("")),
  gstPercent: z.coerce
    .number()
    .min(0)
    .max(100)
    .optional(),
  mrp: z.coerce.number().positive("MRP must be positive").optional(),
  purchasePrice: z.coerce
    .number()
    .positive("Purchase price must be positive")
    .optional(),
  minimumStock: z.coerce.number().min(0).optional().default(0),
  reorderLevel: z.coerce.number().min(0).optional().default(0),
  storageCondition: z.string().optional().or(z.literal("")),
  isNarcotic: z.boolean().default(false),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const ProductUpdateSchema = ProductCreateSchema.partial().extend({
  manufacturerId: z.string().uuid().optional(),
});

export const ProductQuerySchema = z.object({
  search: z.string().optional(),
  scheduleType: z
    .enum(["H", "H1", "X", "OTC"])
    .optional(),
  manufacturerId: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).default("ALL"),
  limit: z.coerce.number().min(10).max(100).default(20),
  cursor: z.string().optional(),
});

export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;
export type ProductQueryInput = z.infer<typeof ProductQuerySchema>;

// ============== INVENTORY LEDGER SCHEMA ==============

export const InventoryLedgerCreateSchema = z.object({
  storeId: z.string().uuid("Invalid store ID"),
  productId: z.string().uuid("Invalid product ID"),
  batchNumber: z.string().min(1, "Batch number required"),
  expiryDate: z.string().datetime().optional(),
  transactionType: z.enum(["OPENING", "ADJUSTMENT"], {
    message: "Valid types: OPENING, ADJUSTMENT",
  }),
  quantityChange: z.coerce.number(),
  referenceNumber: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const InventoryLedgerQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  batchNumber: z.string().optional(),
  transactionType: z.enum(["OPENING", "ADJUSTMENT"]).optional(),
  limit: z.coerce.number().min(10).max(100).default(20),
  cursor: z.string().optional(),
});

export type InventoryLedgerCreateInput = z.infer<
  typeof InventoryLedgerCreateSchema
>;
export type InventoryLedgerQueryInput = z.infer<typeof InventoryLedgerQuerySchema>;

// ============== STOCK QUERY SCHEMA ==============

export const StockQuerySchema = z.object({
  storeId: z.string().uuid("Invalid store ID").optional(),
  productId: z.string().uuid("Invalid product ID").optional(),
  limit: z.coerce.number().min(10).max(100).default(20),
  cursor: z.string().optional(),
});

export type StockQueryInput = z.infer<typeof StockQuerySchema>;
