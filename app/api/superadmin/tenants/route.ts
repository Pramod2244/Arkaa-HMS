import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedDepartmentsForTenant } from "@/lib/services/masters/department-seed";
import bcrypt from "bcryptjs";
import { PERMISSION_CODES } from "@/lib/constants";

export async function GET() {
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      licenses: { where: { isActive: true }, orderBy: { endDate: "desc" }, take: 1 },
      _count: { select: { users: true } },
    },
  });
  return Response.json(tenants);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const name = (body.name ?? "").toString().trim();
    const code = (body.code ?? "").toString().trim().toUpperCase();
    const type = body.type === "CLINIC" ? "CLINIC" : "HOSPITAL";
    const contact = body.contact?.toString().trim() ?? null;
    const plan = (body.plan ?? "BASIC").toString().trim();
    const maxUsers = Math.max(1, Number(body.maxUsers) || 10);
    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    const endDate = body.endDate ? new Date(body.endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // Admin credentials (can be customized via body or use defaults)
    const adminUsername = (body.adminUsername ?? "admin").toString().trim();
    const adminPassword = (body.adminPassword ?? "admin123").toString();
    const adminEmail = (body.adminEmail ?? `admin@${code.toLowerCase()}.local`).toString().trim();

    if (!name || !code) {
      return Response.json({ error: "Name and code are required" }, { status: 400 });
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: { name, code, type, contact, isActive: true },
    });

    // Create license
    await prisma.tenantLicense.create({
      data: { tenantId: tenant.id, plan, maxUsers, startDate, endDate, isActive: true },
    });

    // Create ADMIN role with all permissions
    const adminRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        code: "ADMIN",
        name: "Administrator",
        description: "Full system access",
        isSystem: true,
      },
    });

    // Get all permission IDs and assign to ADMIN role
    const allPermissions = await prisma.permission.findMany({
      where: { code: { in: Array.from(PERMISSION_CODES) } },
      select: { id: true },
    });

    if (allPermissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: allPermissions.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
      });
    }

    // Create admin user
    const saltRounds = 12;
    const adminHash = await bcrypt.hash(adminPassword, saltRounds);
    const adminUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail,
        username: adminUsername,
        passwordHash: adminHash,
        fullName: "Tenant Admin",
        isActive: true,
      },
    });

    // Assign ADMIN role to admin user
    await prisma.userRole.create({
      data: { userId: adminUser.id, roleId: adminRole.id },
    });

    // Seed predefined departments for the new tenant
    const seedResult = await seedDepartmentsForTenant(tenant.id, adminUser.id);
    console.log(`Tenant ${code} created with admin user (${adminUsername}/${adminPassword}), seeded ${seedResult.created} departments`);

    const withLicense = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      include: { licenses: { where: { isActive: true }, take: 1 } },
    });
    return Response.json({ 
      ...withLicense, 
      adminCredentials: { username: adminUsername, password: adminPassword, email: adminEmail }
    }, { status: 201 });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return Response.json({ error: "Tenant code already exists" }, { status: 409 });
    }
    console.error(e);
    return Response.json({ error: "Failed to create tenant" }, { status: 500 });
  }
}

