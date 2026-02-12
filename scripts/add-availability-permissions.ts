import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL required");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function addAvailabilityPermissions() {
  console.log("Adding availability permissions to ADMIN roles...");

  // Get all ADMIN roles
  const adminRoles = await prisma.role.findMany({
    where: { code: "ADMIN" },
    select: { id: true, tenantId: true },
  });

  console.log(`Found ${adminRoles.length} ADMIN roles`);

  // Get availability permissions
  const availabilityPermCodes = [
    "AVAILABILITY_VIEW",
    "AVAILABILITY_CREATE",
    "AVAILABILITY_UPDATE",
    "AVAILABILITY_DELETE",
    "APPOINTMENT_UPDATE",
    "APPOINTMENT_RESCHEDULE",
    "APPOINTMENT_CHECKIN",
    "APPOINTMENT_SLOTS_VIEW",
  ];

  const availabilityPerms = await prisma.permission.findMany({
    where: { code: { in: availabilityPermCodes } },
    select: { id: true, code: true },
  });

  console.log(
    `Found permissions: ${availabilityPerms.map((p) => p.code).join(", ")}`
  );

  for (const role of adminRoles) {
    for (const perm of availabilityPerms) {
      const existing = await prisma.rolePermission.findFirst({
        where: { roleId: role.id, permissionId: perm.id },
      });

      if (!existing) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        });
        console.log(`  Added ${perm.code} to ADMIN role ${role.id}`);
      }
    }
  }

  console.log("Done!");
  await prisma.$disconnect();
}

addAvailabilityPermissions().catch(console.error);
