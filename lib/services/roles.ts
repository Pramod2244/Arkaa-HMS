import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

export const RoleSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isSystem: z.boolean().default(false),
  permissionIds: z.array(z.string()).optional(),
});

export type RoleInput = z.infer<typeof RoleSchema>;

export async function getRoles(tenantId: string) {
  return prisma.role.findMany({
    where: { tenantId },
    include: {
      _count: {
        select: { userRoles: true },
      },
      rolePermissions: {
        include: { permission: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getRoleById(id: string, tenantId: string) {
  return prisma.role.findFirst({
    where: { id, tenantId },
    include: {
      rolePermissions: {
        include: { permission: true },
      },
    },
  });
}

export async function createRole(
  data: RoleInput,
  tenantId: string,
  userId: string
) {
  const { permissionIds, ...roleData } = data;

  const role = await prisma.role.create({
    data: {
      ...roleData,
      tenantId,
      createdBy: userId,
    },
  });

  // Create role-permission relationships
  if (permissionIds && permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId: role.id,
        permissionId,
      })),
      skipDuplicates: true,
    });
  }

  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "Role",
    entityId: role.id,
    action: "CREATE",
    newValue: { ...role, permissionIds },
  });

  return role;
}

export async function updateRole(
  id: string,
  data: Partial<RoleInput>,
  tenantId: string,
  userId: string
) {
  const oldRole = await prisma.role.findUnique({
    where: { id },
    include: {
      rolePermissions: {
        include: { permission: true },
      },
    },
  });

  const { permissionIds, ...roleData } = data;

  const role = await prisma.role.update({
    where: { id },
    data: {
      ...roleData,
      updatedBy: userId,
    },
  });

  // Update permissions if provided
  if (permissionIds !== undefined) {
    // Delete existing role permissions
    await prisma.rolePermission.deleteMany({
      where: { roleId: id },
    });

    // Create new role permissions
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
      });
    }
  }

  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "Role",
    entityId: role.id,
    action: "UPDATE",
    oldValue: oldRole,
    newValue: { ...role, permissionIds },
  });

  return role;
}

export async function deleteRole(id: string, tenantId: string, userId: string) {
  const oldRole = await prisma.role.findUnique({
    where: { id },
  });

  await prisma.role.delete({
    where: { id },
  });

  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "Role",
    entityId: id,
    action: "DELETE",
    oldValue: oldRole,
  });
}

export async function assignPermissionsToRole(
  roleId: string,
  permissionIds: string[],
  tenantId: string,
  userId: string
) {
  const oldPermissions = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });

  await prisma.rolePermission.deleteMany({
    where: { roleId },
  });

  const newPermissions = await prisma.rolePermission.createMany({
    data: permissionIds.map((pid) => ({ roleId, permissionId: pid })),
  });

  const newPerms = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });

  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "Role",
    entityId: roleId,
    action: "UPDATE",
    oldValue: { permissions: oldPermissions },
    newValue: { permissions: newPerms },
  });

  return newPerms;
}