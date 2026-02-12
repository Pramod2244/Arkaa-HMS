import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL required");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function updateAdminRole() {
  // Get all ADMIN roles
  const adminRoles = await prisma.role.findMany({ where: { code: "ADMIN" } });
  
  // Get all permissions
  const allPermissions = await prisma.permission.findMany({ select: { id: true } });
  const permissionIds = allPermissions.map(p => p.id);
  
  console.log(`Found ${adminRoles.length} ADMIN roles to update`);
  console.log(`Total permissions available: ${permissionIds.length}`);
  
  for (const role of adminRoles) {
    // Delete existing role permissions
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    
    // Add all permissions to ADMIN role
    await prisma.rolePermission.createMany({
      data: permissionIds.map(pId => ({ roleId: role.id, permissionId: pId })),
      skipDuplicates: true,
    });
    
    console.log(`✓ Updated ADMIN role: ${role.id} with ${permissionIds.length} permissions`);
  }
  
  await prisma.$disconnect();
  console.log("Done!");
}

updateAdminRole().catch(console.error);
