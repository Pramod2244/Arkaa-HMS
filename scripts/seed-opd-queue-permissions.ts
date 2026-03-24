/**
 * Seed OPD Queue permissions and assign to ADMIN roles
 * Run: npx tsx scripts/seed-opd-queue-permissions.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const PERMISSIONS = [
  { code: "OPD_QUEUE_VIEW", name: "View OPD Queue", description: "Access OPD Queue UI", module: "CLINICAL" },
  { code: "OPD_QUEUE_MANAGE", name: "Manage OPD Queue", description: "Manage OPD Queue (check-ins, start, complete)", module: "CLINICAL" },
];

async function main() {
  console.log("Seeding OPD Queue permissions...");

  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { description: p.description, module: p.module },
      create: { code: p.code, name: p.name, description: p.description, module: p.module },
    });
    console.log(`  ✓ ${p.code}`);
  }

  const adminRoles = await prisma.role.findMany({ where: { code: "ADMIN" }, select: { id: true } });
  const permissionRecords = await prisma.permission.findMany({ where: { code: { in: PERMISSIONS.map((x) => x.code) } }, select: { id: true } });

  for (const role of adminRoles) {
    for (const perm of permissionRecords) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
    console.log(`  ✓ ADMIN role assigned OPD permissions (roleId: ${role.id})`);
  }

  console.log("✅ OPD Queue permissions seeded.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
