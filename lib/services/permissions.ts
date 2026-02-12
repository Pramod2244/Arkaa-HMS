import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

export const PermissionSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  module: z.string().optional(),
  description: z.string().optional(),
});

export type PermissionInput = z.infer<typeof PermissionSchema>;

export async function getPermissions() {
  return prisma.permission.findMany({
    orderBy: { module: "asc" },
  });
}

export async function getPermissionById(id: string) {
  return prisma.permission.findUnique({
    where: { id },
  });
}

export async function createPermission(data: PermissionInput, userId: string) {
  const permission = await prisma.permission.create({
    data: {
      ...data,
      createdBy: userId,
    },
  });

  await createAuditLog({
    tenantId: null, // global
    performedBy: userId,
    entityType: "Permission",
    entityId: permission.id,
    action: "CREATE",
    newValue: permission,
  });

  return permission;
}

export async function updatePermission(
  id: string,
  data: Partial<PermissionInput>,
  userId: string
) {
  const oldPermission = await prisma.permission.findUnique({
    where: { id },
  });

  const permission = await prisma.permission.update({
    where: { id },
    data: {
      ...data,
      updatedBy: userId,
    },
  });

  await createAuditLog({
    tenantId: null,
    performedBy: userId,
    entityType: "Permission",
    entityId: permission.id,
    action: "UPDATE",
    oldValue: oldPermission,
    newValue: permission,
  });

  return permission;
}

export async function deletePermission(id: string, userId: string) {
  const oldPermission = await prisma.permission.findUnique({
    where: { id },
  });

  await prisma.permission.delete({
    where: { id },
  });

  await createAuditLog({
    tenantId: null,
    performedBy: userId,
    entityType: "Permission",
    entityId: id,
    action: "DELETE",
    oldValue: oldPermission,
  });
}