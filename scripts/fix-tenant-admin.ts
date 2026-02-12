/**
 * Fix existing tenants that were created without admin users
 * 
 * Usage: npx tsx --env-file=.env scripts/fix-tenant-admin.ts
 */

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL required");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function fixTenantAdmins() {
  // Find tenants without admin users (excluding DEMO which has it from seed)
  const tenants = await prisma.tenant.findMany({
    where: { code: { not: "DEMO" } },
    include: { users: true, roles: true },
  });

  console.log(
    "Found tenants:",
    tenants.map((t) => ({ code: t.code, users: t.users.length, roles: t.roles.length }))
  );

  for (const tenant of tenants) {
    // Skip if admin already exists
    if (tenant.users.some((u) => u.username === "admin")) {
      console.log(`Tenant ${tenant.code} already has admin user, skipping`);
      continue;
    }

    // Create ADMIN role if missing
    let adminRole = tenant.roles.find((r) => r.code === "ADMIN");
    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: {
          tenantId: tenant.id,
          code: "ADMIN",
          name: "Administrator",
          isSystem: true,
        },
      });

      // Assign all permissions
      const allPerms = await prisma.permission.findMany({ select: { id: true } });
      await prisma.rolePermission.createMany({
        data: allPerms.map((p) => ({ roleId: adminRole!.id, permissionId: p.id })),
      });
      console.log(`Created ADMIN role for ${tenant.code}`);
    }

    // Create admin user
    const hash = await bcrypt.hash("admin123", 12);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        username: "admin",
        email: `admin@${tenant.code.toLowerCase()}.local`,
        passwordHash: hash,
        fullName: "Tenant Admin",
        isActive: true,
      },
    });

    await prisma.userRole.create({
      data: { userId: user.id, roleId: adminRole.id },
    });

    console.log(`Created admin user for tenant ${tenant.code}: admin / admin123`);
  }

  await prisma.$disconnect();
  console.log("\nDone! You can now login with: admin / admin123");
}

fixTenantAdmins().catch((e) => {
  console.error(e);
  process.exit(1);
});
