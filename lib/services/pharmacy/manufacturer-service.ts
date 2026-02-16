import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import type { Prisma } from "@/app/generated/prisma/client";

export interface ManufacturerCreateInput {
  code: string;
  name: string;
  description?: string;
  licenseNumber?: string;
  contactNumber?: string;
  address?: string;
}

export interface ManufacturerUpdateInput {
  name?: string;
  description?: string;
  licenseNumber?: string;
  contactNumber?: string;
  address?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export interface ManufacturerQueryOptions {
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "ALL";
  cursor?: string;
  limit?: number;
}

// ============== CREATE MANUFACTURER ==============

export async function createManufacturer(
  tenantId: string,
  userId: string,
  input: ManufacturerCreateInput
): Promise<any> {
  // Check for duplicate code
  const existing = await prisma.manufacturer.findFirst({
    where: { tenantId, code: input.code.toUpperCase(), isDeleted: false },
  });

  if (existing) {
    throw new AppError("Manufacturer code already exists", 400, "DUPLICATE_CODE");
  }

  const manufacturer = await prisma.manufacturer.create({
    data: {
      tenantId,
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description || null,
      licenseNumber: input.licenseNumber || null,
      contactNumber: input.contactNumber || null,
      address: input.address || null,
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
    entityType: "PHARMACY_MANUFACTURER",
    entityId: manufacturer.id,
    action: "CREATE",
    newValue: manufacturer,
  });

  return manufacturer;
}

// ============== GET MANUFACTURERS (CURSOR PAGINATION) ==============

export async function getManufacturers(
  tenantId: string,
  options: ManufacturerQueryOptions = {}
): Promise<{ data: any[]; pagination: { cursor: string | null; hasMore: boolean } }> {
  const { search, status = "ALL", cursor, limit = 10 } = options;

  const where: Prisma.ManufacturerWhereInput = {
    tenantId,
    isDeleted: false,
  };

  if (status && status !== "ALL") {
    where.status = status as any;
  }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const decodedCursor = cursor ? Buffer.from(cursor, "base64").toString() : null;
  if (decodedCursor) {
    where.id = { gt: decodedCursor };
  }

  const manufacturers = await prisma.manufacturer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      code: true,
      name: true,
      licenseNumber: true,
      contactNumber: true,
      address: true,
      status: true,
      updatedAt: true,
    },
  });

  const hasMore = manufacturers.length > limit;
  const data = hasMore ? manufacturers.slice(0, limit) : manufacturers;
  const nextCursor =
    hasMore && data.length > 0
      ? Buffer.from(data[data.length - 1].id).toString("base64")
      : null;

  return {
    data,
    pagination: { cursor: nextCursor, hasMore },
  };
}

// ============== GET MANUFACTURER BY ID ==============

export async function getManufacturerById(
  tenantId: string,
  manufacturerId: string
): Promise<any> {
  const manufacturer = await prisma.manufacturer.findFirst({
    where: { id: manufacturerId, tenantId, isDeleted: false },
  });

  if (!manufacturer) {
    throw new AppError("Manufacturer not found", 404, "MANUFACTURER_NOT_FOUND");
  }

  return manufacturer;
}

// ============== UPDATE MANUFACTURER ==============

export async function updateManufacturer(
  tenantId: string,
  userId: string,
  manufacturerId: string,
  input: ManufacturerUpdateInput
): Promise<any> {
  const manufacturer = await getManufacturerById(tenantId, manufacturerId);

  const updateData: any = {
    updatedBy: userId,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.licenseNumber !== undefined) updateData.licenseNumber = input.licenseNumber;
  if (input.contactNumber !== undefined) updateData.contactNumber = input.contactNumber;
  if (input.address !== undefined) updateData.address = input.address;
  if (input.status !== undefined) updateData.status = input.status;

  const updated = await prisma.manufacturer.update({
    where: { id: manufacturerId },
    data: updateData,
  });

  // Audit log
  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "PHARMACY_MANUFACTURER",
    entityId: manufacturerId,
    action: "UPDATE",
    oldValue: manufacturer,
    newValue: updated,
  });

  return updated;
}

// ============== SOFT DELETE MANUFACTURER ==============

export async function deleteManufacturer(
  tenantId: string,
  userId: string,
  manufacturerId: string
): Promise<void> {
  // Check if manufacturer has products
  const hasProducts = await prisma.product.findFirst({
    where: { tenantId, manufacturerId, isDeleted: false },
  });

  if (hasProducts) {
    throw new AppError(
      "Cannot delete manufacturer with products",
      400,
      "MANUFACTURER_HAS_PRODUCTS"
    );
  }

  await prisma.manufacturer.update({
    where: { id: manufacturerId },
    data: { isDeleted: true, updatedBy: userId },
  });

  // Audit log
  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "PHARMACY_MANUFACTURER",
    entityId: manufacturerId,
    action: "DELETE",
    newValue: { isDeleted: true },
  });
}
