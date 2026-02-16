import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import type { Prisma } from "@/app/generated/prisma/client";

export interface StoreCreateInput {
  code: string;
  name: string;
  description?: string;
  type?: "CENTRAL" | "OP" | "IP" | "SUB";
  licenseNumber?: string;
  gstNumber?: string;
  address?: string;
  managerName?: string;
  contactNumber?: string;
}

export interface StoreUpdateInput {
  name?: string;
  description?: string;
  type?: "CENTRAL" | "OP" | "IP" | "SUB";
  licenseNumber?: string;
  gstNumber?: string;
  address?: string;
  managerName?: string;
  contactNumber?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export interface StoreQueryOptions {
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "ALL";
  type?: "CENTRAL" | "OP" | "IP" | "SUB";
  cursor?: string;
  limit?: number;
}

// ============== CREATE STORE ==============

export async function createStore(
  tenantId: string,
  userId: string,
  input: StoreCreateInput
): Promise<any> {
  // Check for duplicate code
  const existing = await prisma.store.findFirst({
    where: { tenantId, code: input.code.toUpperCase(), isDeleted: false },
  });

  if (existing) {
    throw new AppError("Store code already exists", 400, "DUPLICATE_CODE");
  }

  const store = await prisma.store.create({
    data: {
      tenantId,
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description || null,
      type: input.type || "CENTRAL",
      licenseNumber: input.licenseNumber || null,
      gstNumber: input.gstNumber || null,
      address: input.address || null,
      managerName: input.managerName || null,
      contactNumber: input.contactNumber || null,
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
    entityType: "PHARMACY_STORE",
    entityId: store.id,
    action: "CREATE",
    newValue: store,
  });

  return store;
}

// ============== GET STORES (CURSOR PAGINATION) ==============

export async function getStores(
  tenantId: string,
  options: StoreQueryOptions = {}
): Promise<{ data: any[]; pagination: { cursor: string | null; hasMore: boolean } }> {
  const { search, status = "ALL", type, cursor, limit = 10 } = options;

  const where: Prisma.StoreWhereInput = {
    tenantId,
    isDeleted: false,
  };

  // Status filter
  if (status && status !== "ALL") {
    where.status = status as any;
  }

  // Type filter
  if (type) {
    where.type = type as any;
  }

  // Search by code or name
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  // Cursor-based pagination
  const decodedCursor = cursor ? Buffer.from(cursor, "base64").toString() : null;
  if (decodedCursor) {
    where.id = { gt: decodedCursor };
  }

  const stores = await prisma.store.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      licenseNumber: true,
      gstNumber: true,
      address: true,
      managerName: true,
      contactNumber: true,
      status: true,
      updatedAt: true,
    },
  });

  const hasMore = stores.length > limit;
  const data = hasMore ? stores.slice(0, limit) : stores;
  const nextCursor =
    hasMore && data.length > 0
      ? Buffer.from(data[data.length - 1].id).toString("base64")
      : null;

  return {
    data,
    pagination: { cursor: nextCursor, hasMore },
  };
}

// ============== GET STORE BY ID ==============

export async function getStoreById(
  tenantId: string,
  storeId: string
): Promise<any> {
  const store = await prisma.store.findFirst({
    where: { id: storeId, tenantId, isDeleted: false },
  });

  if (!store) {
    throw new AppError("Store not found", 404, "STORE_NOT_FOUND");
  }

  return store;
}

// ============== UPDATE STORE ==============

export async function updateStore(
  tenantId: string,
  userId: string,
  storeId: string,
  input: StoreUpdateInput
): Promise<any> {
  const store = await getStoreById(tenantId, storeId);

  const updateData: any = {
    updatedBy: userId,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.licenseNumber !== undefined) updateData.licenseNumber = input.licenseNumber;
  if (input.gstNumber !== undefined) updateData.gstNumber = input.gstNumber;
  if (input.address !== undefined) updateData.address = input.address;
  if (input.managerName !== undefined) updateData.managerName = input.managerName;
  if (input.contactNumber !== undefined) updateData.contactNumber = input.contactNumber;
  if (input.status !== undefined) updateData.status = input.status;

  const updated = await prisma.store.update({
    where: { id: storeId },
    data: updateData,
  });

  // Audit log
  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "PHARMACY_STORE",
    entityId: storeId,
    action: "UPDATE",
    oldValue: store,
    newValue: updated,
  });

  return updated;
}

// ============== DEACTIVATE STORE ==============

export async function deactivateStore(
  tenantId: string,
  userId: string,
  storeId: string
): Promise<any> {
  // Check if store has inventory ledger entries
  const hasEntries = await prisma.inventoryLedger.findFirst({
    where: { tenantId, storeId },
  });

  if (hasEntries) {
    throw new AppError(
      "Cannot deactivate store with inventory entries",
      400,
      "STORE_HAS_INVENTORY"
    );
  }

  return updateStore(tenantId, userId, storeId, { status: "INACTIVE" });
}

// ============== SOFT DELETE STORE ==============

export async function deleteStore(
  tenantId: string,
  userId: string,
  storeId: string
): Promise<void> {
  // Check if store has inventory entries
  const hasEntries = await prisma.inventoryLedger.findFirst({
    where: { tenantId, storeId },
  });

  if (hasEntries) {
    throw new AppError(
      "Cannot delete store with inventory entries",
      400,
      "STORE_HAS_INVENTORY"
    );
  }

  await prisma.store.update({
    where: { id: storeId },
    data: { isDeleted: true, updatedBy: userId },
  });

  // Audit log
  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "PHARMACY_STORE",
    entityId: storeId,
    action: "DELETE",
    newValue: { isDeleted: true },
  });
}
