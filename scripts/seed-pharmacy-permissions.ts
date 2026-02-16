/**
 * Seed pharmacy permissions into the Permission table
 * and assign them to the ADMIN role for all tenants.
 *
 * Run: npx tsx scripts/seed-pharmacy-permissions.ts
 */

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL required");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const PHARMACY_PERMISSIONS = [
  "PHARMACY_STORE_VIEW",
  "PHARMACY_STORE_CREATE",
  "PHARMACY_STORE_EDIT",
  "PHARMACY_STORE_DELETE",
  "PHARMACY_STORE_IMPORT",
  "PHARMACY_STORE_EXPORT",
  "PHARMACY_MANUFACTURER_VIEW",
  "PHARMACY_MANUFACTURER_CREATE",
  "PHARMACY_MANUFACTURER_EDIT",
  "PHARMACY_MANUFACTURER_DELETE",
  "PHARMACY_MANUFACTURER_IMPORT",
  "PHARMACY_MANUFACTURER_EXPORT",
  "PHARMACY_VENDOR_VIEW",
  "PHARMACY_VENDOR_CREATE",
  "PHARMACY_VENDOR_EDIT",
  "PHARMACY_VENDOR_DELETE",
  "PHARMACY_VENDOR_IMPORT",
  "PHARMACY_VENDOR_EXPORT",
  "PHARMACY_PRODUCT_VIEW",
  "PHARMACY_PRODUCT_CREATE",
  "PHARMACY_PRODUCT_EDIT",
  "PHARMACY_PRODUCT_DELETE",
  "PHARMACY_PRODUCT_IMPORT",
  "PHARMACY_PRODUCT_EXPORT",
  "PHARMACY_INVENTORY_VIEW",
  "PHARMACY_INVENTORY_EDIT",
  "PHARMACY_INVENTORY_EXPORT",
];

async function main() {
  console.log("=== Seeding Pharmacy Permissions ===\n");

  // 1. Upsert all pharmacy permissions into the Permission table
  let created = 0;
  for (const code of PHARMACY_PERMISSIONS) {
    const result = await prisma.permission.upsert({
      where: { code },
      create: {
        code,
        name: code.replace(/_/g, " "),
        module: "PHARMACY",
      },
      update: {},
    });
    const isNew = result.code === code;
    if (isNew) created++;
  }
  console.log(`Permissions upserted: ${PHARMACY_PERMISSIONS.length} (new: ${created})`);

  // 2. Get all pharmacy permission IDs
  const pharmacyPermissions = await prisma.permission.findMany({
    where: { code: { in: PHARMACY_PERMISSIONS } },
    select: { id: true, code: true },
  });
  console.log(`Found ${pharmacyPermissions.length} pharmacy permissions in DB`);

  // 3. Find all ADMIN roles across all tenants
  const adminRoles = await prisma.role.findMany({
    where: { code: "ADMIN" },
    select: { id: true, tenantId: true },
  });
  console.log(`Found ${adminRoles.length} ADMIN role(s) across tenants\n`);

  // 4. For each ADMIN role, assign all pharmacy permissions
  for (const role of adminRoles) {
    let assigned = 0;
    for (const perm of pharmacyPermissions) {
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id,
          },
        },
      });
      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
        assigned++;
      }
    }
    console.log(`Tenant ${role.tenantId}: ADMIN role ${role.id} → ${assigned} new permissions assigned`);
  }

  console.log("\n=== Done! Pharmacy permissions are now active. ===");
  console.log("Log out and log back in to refresh your session token.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
