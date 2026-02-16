import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import type { Prisma } from "@/app/generated/prisma/client";

export interface VendorCreateInput {
  code: string;
  name: string;
  description?: string;
  gstNumber?: string;
  contactPerson?: string;
  contactNumber?: string;
  email?: string;
}

export interface VendorUpdateInput {
  name?: string;
  description?: string;
  gstNumber?: string;
  contactPerson?: string;
  contactNumber?: string;
  email?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export interface VendorQueryOptions {
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "ALL";
  cursor?: string;
  limit?: number;
}

// ============== CREATE VENDOR ==============

export async function createVendor(
  tenantId: string,
  userId: string,
  input: VendorCreateInput
): Promise<any> {
  // Check for duplicate code
  const existing = await prisma.vendor.findFirst({
    where: { tenantId, code: input.code.toUpperCase(), isDeleted: false },
  });

  if (existing) {
    throw new AppError("Vendor code already exists", 400, "DUPLICATE_CODE");
  }

  const vendor = await prisma.vendor.create({
    data: {
      tenantId,
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description || null,
      gstNumber: input.gstNumber || null,
      contactPerson: input.contactPerson || null,
      contactNumber: input.contactNumber || null,
      email: input.email || null,
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
    entityType: "PHARMACY_VENDOR",
    entityId: vendor.id,
    action: "CREATE",
    newValue: vendor,
  });

  return vendor;
}

// ============== GET VENDORS (CURSOR PAGINATION) ==============

export async function getVendors(
  tenantId: string,
  options: VendorQueryOptions = {}
): Promise<{ data: any[]; pagination: { cursor: string | null; hasMore: boolean } }> {
  const { search, status = "ALL", cursor, limit = 10 } = options;

  const where: Prisma.VendorWhereInput = {
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

  const vendors = await prisma.vendor.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      code: true,
      name: true,
      gstNumber: true,
      contactPerson: true,
      contactNumber: true,
      email: true,
      status: true,
      updatedAt: true,
    },
  });

  const hasMore = vendors.length > limit;
  const data = hasMore ? vendors.slice(0, limit) : vendors;
  const nextCursor =
    hasMore && data.length > 0
      ? Buffer.from(data[data.length - 1].id).toString("base64")
      : null;

  return {
    data,
    pagination: { cursor: nextCursor, hasMore },
  };
}

// ============== GET VENDOR BY ID ==============

export async function getVendorById(
  tenantId: string,
  vendorId: string
): Promise<any> {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, tenantId, isDeleted: false },
  });

  if (!vendor) {
    throw new AppError("Vendor not found", 404, "VENDOR_NOT_FOUND");
  }

  return vendor;
}

// ============== UPDATE VENDOR ==============

export async function updateVendor(
  tenantId: string,
  userId: string,
  vendorId: string,
  input: VendorUpdateInput
): Promise<any> {
  const vendor = await getVendorById(tenantId, vendorId);

  const updateData: any = {
    updatedBy: userId,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.gstNumber !== undefined) updateData.gstNumber = input.gstNumber;
  if (input.contactPerson !== undefined) updateData.contactPerson = input.contactPerson;
  if (input.contactNumber !== undefined) updateData.contactNumber = input.contactNumber;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.status !== undefined) updateData.status = input.status;

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: updateData,
  });

  // Audit log
  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "PHARMACY_VENDOR",
    entityId: vendorId,
    action: "UPDATE",
    oldValue: vendor,
    newValue: updated,
  });

  return updated;
}

// ============== SOFT DELETE VENDOR ==============

export async function deleteVendor(
  tenantId: string,
  userId: string,
  vendorId: string
): Promise<void> {
  await prisma.vendor.update({
    where: { id: vendorId },
    data: { isDeleted: true, updatedBy: userId },
  });

  // Audit log
  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "PHARMACY_VENDOR",
    entityId: vendorId,
    action: "DELETE",
    newValue: { isDeleted: true },
  });
}
