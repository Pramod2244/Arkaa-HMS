/**
 * Phase-2 Pharmacy Procurement permissions seeder.
 * Run: npx tsx scripts/seed-phase2-permissions.ts
 *
 * Adds PO_*, GRN_*, PHARMACY_EXPIRY_VIEW permissions and assigns them to every ADMIN role.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const PHASE2_PERMISSIONS = [
  { code: "PO_VIEW", name: "View Purchase Orders", description: "View purchase orders", module: "PHARMACY" },
  { code: "PO_CREATE", name: "Create Purchase Orders", description: "Create purchase orders", module: "PHARMACY" },
  { code: "PO_EDIT", name: "Edit Purchase Orders", description: "Edit purchase orders", module: "PHARMACY" },
  { code: "PO_APPROVE", name: "Approve Purchase Orders", description: "Approve purchase orders", module: "PHARMACY" },
  { code: "PO_DELETE", name: "Delete Purchase Orders", description: "Delete purchase orders", module: "PHARMACY" },
  { code: "GRN_VIEW", name: "View Goods Receipts", description: "View goods receipt notes", module: "PHARMACY" },
  { code: "GRN_CREATE", name: "Create Goods Receipts", description: "Create goods receipt notes", module: "PHARMACY" },
  { code: "PHARMACY_EXPIRY_VIEW", name: "View Expiry Dashboard", description: "View expiry dashboard", module: "PHARMACY" },
];

async function main() {
  console.log("Seeding Phase-2 Pharmacy Procurement permissions...\n");

  // Upsert permissions
  for (const perm of PHASE2_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description, module: perm.module },
      create: { code: perm.code, name: perm.name, description: perm.description, module: perm.module },
    });
    console.log(`  ✓ Permission: ${perm.code}`);
  }

  // Find all ADMIN roles across tenants
  const adminRoles = await prisma.role.findMany({
    where: { code: "ADMIN" },
    select: { id: true, tenantId: true },
  });

  console.log(`\nFound ${adminRoles.length} ADMIN role(s). Assigning permissions...\n`);

  const permissionRecords = await prisma.permission.findMany({
    where: { code: { in: PHASE2_PERMISSIONS.map((p) => p.code) } },
    select: { id: true, code: true },
  });

  for (const role of adminRoles) {
    for (const perm of permissionRecords) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
    console.log(`  ✓ ADMIN role (tenant: ${role.tenantId}) → ${permissionRecords.length} permissions assigned`);
  }

  console.log("\n✅ Phase-2 permissions seeded successfully!");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
