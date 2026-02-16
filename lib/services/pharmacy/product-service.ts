import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { Prisma } from "@/app/generated/prisma/client";

export interface ProductCreateInput {
  code: string;
  name: string;
  description?: string;
  genericName?: string;
  brandName?: string;
  strength?: string;
  dosageForm?: string;
  scheduleType?: "H" | "H1" | "X" | "OTC";
  manufacturerId: string;
  hsnCode?: string;
  gstPercent?: number;
  mrp?: number;
  purchasePrice?: number;
  minimumStock?: number;
  reorderLevel?: number;
  storageCondition?: string;
  isNarcotic?: boolean;
}

export interface ProductUpdateInput {
  name?: string;
  description?: string;
  genericName?: string;
  brandName?: string;
  strength?: string;
  dosageForm?: string;
  scheduleType?: "H" | "H1" | "X" | "OTC";
  hsnCode?: string;
  gstPercent?: number;
  mrp?: number;
  purchasePrice?: number;
  minimumStock?: number;
  reorderLevel?: number;
  storageCondition?: string;
  isNarcotic?: boolean;
  status?: "ACTIVE" | "INACTIVE";
}

export interface ProductQueryOptions {
  search?: string;
  genericName?: string;
  brandName?: string;
  manufacturerId?: string;
  scheduleType?: string;
  status?: "ACTIVE" | "INACTIVE" | "ALL";
  cursor?: string;
  limit?: number;
}

// ============== CREATE PRODUCT ==============

export async function createProduct(
  tenantId: string,
  userId: string,
  input: ProductCreateInput
): Promise<any> {
  // Check for duplicate code
  const existing = await prisma.product.findFirst({
    where: { tenantId, code: input.code.toUpperCase(), isDeleted: false },
  });

  if (existing) {
    throw new AppError("Product code already exists", 400, "DUPLICATE_CODE");
  }

  // Verify manufacturer exists
  const manufacturer = await prisma.manufacturer.findFirst({
    where: { id: input.manufacturerId, tenantId, isDeleted: false },
  });

  if (!manufacturer) {
    throw new AppError("Manufacturer not found", 404, "MANUFACTURER_NOT_FOUND");
  }

  const product = await prisma.product.create({
    data: {
      tenantId,
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description || null,
      genericName: input.genericName || input.name,
      brandName: input.brandName || input.name,
      strength: input.strength || null,
      dosageForm: input.dosageForm || null,
      scheduleType: input.scheduleType || "OTC",
      manufacturerId: input.manufacturerId,
      hsnCode: input.hsnCode || null,
      gstPercent: input.gstPercent ? new Prisma.Decimal(input.gstPercent) : null,
      mrp: input.mrp ? new Prisma.Decimal(input.mrp) : null,
      purchasePrice: input.purchasePrice ? new Prisma.Decimal(input.purchasePrice) : null,
      minimumStock: input.minimumStock || 0,
      reorderLevel: input.reorderLevel || 0,
      storageCondition: input.storageCondition || null,
      isNarcotic: input.isNarcotic || false,
      status: "ACTIVE",
      isDeleted: false,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  // Audit log
  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "PHARMACY_PRODUCT",
    entityId: product.id,
    action: "CREATE",
    newValue: product,
  });

  return product;
}

// ============== GET PRODUCTS (CURSOR PAGINATION) ==============

export async function getProducts(
  tenantId: string,
  options: ProductQueryOptions = {}
): Promise<{ data: any[]; pagination: { cursor: string | null; hasMore: boolean } }> {
  const { search, genericName, brandName, manufacturerId, scheduleType, status = "ALL", cursor, limit = 10 } = options;

  const where: Prisma.ProductWhereInput = {
    tenantId,
    isDeleted: false,
  };

  if (status && status !== "ALL") {
    where.status = status as any;
  }

  if (genericName) {
    where.genericName = { contains: genericName, mode: "insensitive" };
  }

  if (brandName) {
    where.brandName = { contains: brandName, mode: "insensitive" };
  }

  if (manufacturerId) {
    where.manufacturerId = manufacturerId;
  }

  if (scheduleType) {
    where.scheduleType = scheduleType as any;
  }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { genericName: { contains: search, mode: "insensitive" } },
      { brandName: { contains: search, mode: "insensitive" } },
    ];
  }

  const decodedCursor = cursor ? Buffer.from(cursor, "base64").toString() : null;
  if (decodedCursor) {
    where.id = { gt: decodedCursor };
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      code: true,
      name: true,
      genericName: true,
      brandName: true,
      strength: true,
      dosageForm: true,
      scheduleType: true,
      manufacturerId: true,
      hsnCode: true,
      gstPercent: true,
      mrp: true,
      purchasePrice: true,
      minimumStock: true,
      reorderLevel: true,
      storageCondition: true,
      isNarcotic: true,
      status: true,
      updatedAt: true,
      manufacturer: {
        select: { id: true, name: true },
      },
    },
  });

  const hasMore = products.length > limit;
  const data = hasMore ? products.slice(0, limit) : products;
  const nextCursor =
    hasMore && data.length > 0
      ? Buffer.from(data[data.length - 1].id).toString("base64")
      : null;

  return {
    data,
    pagination: { cursor: nextCursor, hasMore },
  };
}

// ============== GET PRODUCT BY ID ==============

export async function getProductById(
  tenantId: string,
  productId: string
): Promise<any> {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId, isDeleted: false },
    include: {
      manufacturer: { select: { id: true, name: true, code: true } },
    },
  });

  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  return product;
}

// ============== UPDATE PRODUCT ==============

export async function updateProduct(
  tenantId: string,
  userId: string,
  productId: string,
  input: ProductUpdateInput
): Promise<any> {
  const product = await getProductById(tenantId, productId);

  const updateData: any = {
    updatedBy: userId,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.genericName !== undefined) updateData.genericName = input.genericName;
  if (input.brandName !== undefined) updateData.brandName = input.brandName;
  if (input.strength !== undefined) updateData.strength = input.strength;
  if (input.dosageForm !== undefined) updateData.dosageForm = input.dosageForm;
  if (input.scheduleType !== undefined) updateData.scheduleType = input.scheduleType;
  if (input.hsnCode !== undefined) updateData.hsnCode = input.hsnCode;
  if (input.gstPercent !== undefined) updateData.gstPercent = input.gstPercent ? new Prisma.Decimal(input.gstPercent) : null;
  if (input.mrp !== undefined) updateData.mrp = input.mrp ? new Prisma.Decimal(input.mrp) : null;
  if (input.purchasePrice !== undefined) updateData.purchasePrice = input.purchasePrice ? new Prisma.Decimal(input.purchasePrice) : null;
  if (input.minimumStock !== undefined) updateData.minimumStock = input.minimumStock;
  if (input.reorderLevel !== undefined) updateData.reorderLevel = input.reorderLevel;
  if (input.storageCondition !== undefined) updateData.storageCondition = input.storageCondition;
  if (input.isNarcotic !== undefined) updateData.isNarcotic = input.isNarcotic;
  if (input.status !== undefined) updateData.status = input.status;

  const updated = await prisma.product.update({
    where: { id: productId },
    data: updateData,
  });

  // Audit log
  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "PHARMACY_PRODUCT",
    entityId: productId,
    action: "UPDATE",
    oldValue: product,
    newValue: updated,
  });

  return updated;
}

// ============== SOFT DELETE PRODUCT ==============

export async function deleteProduct(
  tenantId: string,
  userId: string,
  productId: string
): Promise<void> {
  // Check if product has inventory ledger entries
  const hasEntries = await prisma.inventoryLedger.findFirst({
    where: { tenantId, productId },
  });

  if (hasEntries) {
    throw new AppError(
      "Cannot delete product with inventory entries",
      400,
      "PRODUCT_HAS_INVENTORY"
    );
  }

  await prisma.product.update({
    where: { id: productId },
    data: { isDeleted: true, updatedBy: userId },
  });

  // Audit log
  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "PHARMACY_PRODUCT",
    entityId: productId,
    action: "DELETE",
    newValue: { isDeleted: true },
  });
}
