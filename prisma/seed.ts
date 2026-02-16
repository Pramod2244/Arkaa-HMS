import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PERMISSION_CODES, SYSTEM_ROLE_CODES, SUPER_ADMIN_USERNAME, SUPER_ADMIN_DEFAULT_PASSWORD } from "../lib/constants";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL required");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const saltRounds = 12;
  const superAdminHash = await bcrypt.hash(SUPER_ADMIN_DEFAULT_PASSWORD, saltRounds);

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { username: SUPER_ADMIN_USERNAME, tenantId: null },
  });
  if (!existingSuperAdmin) {
    await prisma.user.create({
      data: {
        email: "superadmin@hms.cloud",
        username: SUPER_ADMIN_USERNAME,
        passwordHash: superAdminHash,
        fullName: "Super Admin",
        isSuperAdmin: true,
        isActive: true,
      },
    });
    console.log("Super admin user created (username: superadmin, password: 224466)");
  }

  for (const code of PERMISSION_CODES) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, name: code.replace(/_/g, " "), module: code.split("_")[0] },
      update: {},
    });
  }
  console.log("Permissions seeded");

  // Optional: create demo tenant with roles
  const demoCode = "DEMO";
  let tenant = await prisma.tenant.findUnique({ where: { code: demoCode } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Demo Hospital",
        code: demoCode,
        type: "HOSPITAL",
        contact: "demo@example.com",
        isActive: true,
      },
    });
    await prisma.tenantLicense.create({
      data: {
        tenantId: tenant.id,
        plan: "PRO",
        maxUsers: 50,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });
    const permissions = await prisma.permission.findMany({ select: { id: true } });
    for (const roleCode of SYSTEM_ROLE_CODES) {
      const role = await prisma.role.create({
        data: {
          tenantId: tenant.id,
          code: roleCode,
          name: roleCode.replace(/_/g, " "),
          isSystem: true,
        },
      });

      // Assign permissions based on role
      let rolePermissions: string[] = [];

      if (roleCode === "ADMIN") {
        rolePermissions = Array.from(PERMISSION_CODES); // All permissions for admin
      } else if (roleCode === "DOCTOR") {
        rolePermissions = [
          "PATIENT_VIEW",
          "APPOINTMENT_VIEW",
          "VISIT_VIEW",
          "VISIT_EDIT",
          "VITAL_CREATE",
          "VITAL_VIEW",
          "VITAL_EDIT",
          "CONSULTATION_CREATE",
          "CONSULTATION_VIEW",
          "CONSULTATION_EDIT",
          "PRESCRIPTION_CREATE",
          "PRESCRIPTION_VIEW",
          "PRESCRIPTION_EDIT",
          "LAB_ORDER_CREATE",
          "LAB_ORDER_VIEW",
          "LAB_RESULT_VIEW",
          "REPORTS_VIEW",
        ];
      } else if (roleCode === "RECEPTIONIST") {
        rolePermissions = [
          "PATIENT_CREATE",
          "PATIENT_VIEW",
          "PATIENT_EDIT",
          "PATIENT_PRINT",
          "PATIENT_DOCUMENT_UPLOAD",
          "APPOINTMENT_CREATE",
          "APPOINTMENT_VIEW",
          "APPOINTMENT_EDIT",
          "VISIT_CREATE",
          "VISIT_VIEW",
          "VISIT_CHECKIN",
          "REPORTS_VIEW",
        ];
      } else if (roleCode === "LAB_TECH") {
        rolePermissions = [
          "PATIENT_VIEW",
          "LAB_ORDER_VIEW",
          "LAB_ORDER_EDIT",
          "LAB_RESULT_CREATE",
          "LAB_RESULT_VIEW",
          "LAB_RESULT_EDIT",
          "REPORTS_VIEW",
        ];
      } else if (roleCode === "BILLING" || roleCode === "ACCOUNTANT") {
        rolePermissions = [
          "PATIENT_VIEW",
          "INVOICE_CREATE",
          "INVOICE_VIEW",
          "INVOICE_EDIT",
          "PAYMENT_CREATE",
          "PAYMENT_VIEW",
          "PAYMENT_EDIT",
          "REPORTS_VIEW",
        ];
      }

      // Create role permissions
      const permissionRecords = await prisma.permission.findMany({
        where: { code: { in: rolePermissions } },
        select: { id: true },
      });

      await prisma.rolePermission.createMany({
        data: permissionRecords.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }
    const adminRole = await prisma.role.findFirst({
      where: { tenantId: tenant.id, code: "ADMIN" },
    });
    if (adminRole) {
      const adminHash = await bcrypt.hash("admin123", saltRounds);
      const tenantAdmin = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: "admin@demo.com",
          username: "admin",
          passwordHash: adminHash,
          fullName: "Tenant Admin",
          isActive: true,
        },
      });
      await prisma.userRole.create({
        data: { userId: tenantAdmin.id, roleId: adminRole.id },
      });
      console.log("Demo tenant created: code DEMO, admin@demo.com / admin123");
    }

    // Seed standard medical departments
    const standardDepartments = [
      "Anatomy",
      "Anesthesiology",
      "Cardiology",
      "Cardiothoracic Surgery",
      "Dermatology",
      "Dentistry",
      "Emergency Medicine",
      "Endocrinology",
      "ENT",
      "Gastroenterology",
      "General Medicine",
      "General Surgery",
      "Gynecology",
      "Hematology",
      "Nephrology",
      "Neurology",
      "Neurosurgery",
      "Oncology",
      "Ophthalmology",
      "Orthopedics",
      "Pediatrics",
      "Plastic Surgery",
      "Psychiatry",
      "Pulmonology",
      "Radiology",
      "Urology",
    ];

    for (let i = 0; i < standardDepartments.length; i++) {
      const name = standardDepartments[i];
      const code = `DEPT-${String(i + 1).padStart(3, "0")}`;
      
      await prisma.department.upsert({
        where: {
          tenantId_code: { tenantId: tenant.id, code },
        },
        create: {
          tenantId: tenant.id,
          code,
          name,
          description: `${name} Department`,
          status: "ACTIVE",
          isDeleted: false,
          version: 1,
        },
        update: {},
      });
    }
    console.log(`${standardDepartments.length} standard departments seeded for DEMO tenant`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
