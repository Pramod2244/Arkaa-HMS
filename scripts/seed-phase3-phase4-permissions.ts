/**
 * Phase 3 + Phase 4 Permission Seeder
 * 
 * Creates missing Permission rows and assigns them to ALL ADMIN roles
 * so that admin users can see the pharmacy dispensing, returns &amp; credit screens.
 *
 * Usage: npx tsx scripts/seed-phase3-phase4-permissions.ts
 */

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL required");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const PHASE3_PERMISSIONS = [
  { code: "PHARMACY_SALE_VIEW", name: "View Pharmacy Sales", module: "PHARMACY" },
  { code: "PHARMACY_SALE_CREATE", name: "Create Pharmacy Sales", module: "PHARMACY" },
  { code: "PHARMACY_SALE_EDIT", name: "Edit Pharmacy Sales", module: "PHARMACY" },
  { code: "PHARMACY_PRICE_OVERRIDE", name: "Override Pharmacy Price", module: "PHARMACY" },
  { code: "PHARMACY_DISCOUNT_APPROVE", name: "Approve Pharmacy Discounts", module: "PHARMACY" },
  { code: "PHARMACY_CREDIT_VIEW", name: "View Credit Ledger", module: "PHARMACY" },
  { code: "PHARMACY_IP_SALE_CREATE", name: "Create IP Pharmacy Sales", module: "PHARMACY" },
];

const PHASE4_PERMISSIONS = [
  { code: "PHARMACY_RETURN_VIEW", name: "View Pharmacy Returns", module: "PHARMACY" },
  { code: "PHARMACY_RETURN_CREATE", name: "Create Pharmacy Returns", module: "PHARMACY" },
  { code: "PHARMACY_RETURN_APPROVE", name: "Approve Pharmacy Returns", module: "PHARMACY" },
  { code: "PHARMACY_RETURN_CANCEL", name: "Cancel Pharmacy Returns", module: "PHARMACY" },
];

const ALL_PERMISSIONS = [...PHASE3_PERMISSIONS, ...PHASE4_PERMISSIONS];

async function main() {
  console.log("=== Phase 3 + Phase 4 Permission Seeder ===\n");

  // 1. Upsert Permission rows
  let created = 0;
  let existed = 0;
  const permissionIds: Record<string, string> = {};

  for (const perm of ALL_PERMISSIONS) {
    const existing = await prisma.permission.findUnique({ where: { code: perm.code } });
    if (existing) {
      existed++;
      permissionIds[perm.code] = existing.id;
      console.log(`  ✓ ${perm.code} already exists`);
    } else {
      const newPerm = await prisma.permission.create({
        data: {
          code: perm.code,
          name: perm.name,
          module: perm.module,
          description: perm.name,
        },
      });
      created++;
      permissionIds[perm.code] = newPerm.id;
      console.log(`  + ${perm.code} CREATED`);
    }
  }

  console.log(`\nPermissions: ${created} created, ${existed} already existed\n`);

  // 2. Find all ADMIN roles across all tenants
  const adminRoles = await prisma.role.findMany({
    where: { code: "ADMIN" },
    select: { id: true, code: true, tenantId: true },
  });

  console.log(`Found ${adminRoles.length} ADMIN role(s)\n`);

  // 3. Assign all new permissions to each ADMIN role
  let linked = 0;
  let alreadyLinked = 0;

  for (const role of adminRoles) {
    for (const perm of ALL_PERMISSIONS) {
      const permId = permissionIds[perm.code];
      try {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: permId },
        });
        linked++;
      } catch {
        // Already linked (unique constraint)
        alreadyLinked++;
      }
    }
    console.log(`  Role ADMIN (tenant: ${role.tenantId}) — permissions synced`);
  }

  console.log(`\nRole-Permission links: ${linked} created, ${alreadyLinked} already existed`);
  console.log("\n=== Done! Restart the app or re-login to see the new screens. ===");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
