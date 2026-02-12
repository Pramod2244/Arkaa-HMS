-- Database Seed SQL for OPD Workflow
-- Run after migrations to set up test data

-- This file contains SQL commands to seed the database with:
-- 1. Test users (receptionist, doctors, nurse)
-- 2. Departments (Cardiology, Anatomy, Orthopedics)
-- 3. User-Department mappings
-- 4. OPD permissions
-- 5. Roles with OPD permissions

-- Note: Prisma seed script (prisma/seed.ts) is preferred
-- This SQL is for reference/debugging only

-- ============================================
-- DEPARTMENTS
-- ============================================

INSERT INTO "Department" (id, "tenantId", name, code, "isActive", "createdAt", "updatedAt", "createdBy", "updatedBy")
VALUES 
  (gen_random_uuid()::text, '<TENANT_ID>', 'Cardiology', 'CARDIO', true, now(), now(), '<ADMIN_USER_ID>', '<ADMIN_USER_ID>'),
  (gen_random_uuid()::text, '<TENANT_ID>', 'Anatomy', 'ANATOMY', true, now(), now(), '<ADMIN_USER_ID>', '<ADMIN_USER_ID>'),
  (gen_random_uuid()::text, '<TENANT_ID>', 'Orthopedics', 'ORTHO', true, now(), now(), '<ADMIN_USER_ID>', '<ADMIN_USER_ID>'),
  (gen_random_uuid()::text, '<TENANT_ID>', 'General Medicine', 'GENERAL', true, now(), now(), '<ADMIN_USER_ID>', '<ADMIN_USER_ID>');

-- ============================================
-- OPD PERMISSIONS
-- ============================================

INSERT INTO "Permission" (id, code, name, module, description, "createdAt", "updatedAt", "createdBy", "updatedBy")
VALUES
  (gen_random_uuid()::text, 'OPD_VIEW', 'View OPD Visits', 'OPD', 'View out-patient department visits', now(), now(), NULL, NULL),
  (gen_random_uuid()::text, 'OPD_CREATE', 'Create OPD Visits', 'OPD', 'Create new OPD visits', now(), now(), NULL, NULL),
  (gen_random_uuid()::text, 'OPD_CHECKIN', 'Check-in Patients', 'OPD', 'Check-in OPD patients', now(), now(), NULL, NULL),
  (gen_random_uuid()::text, 'DOCTOR_QUEUE_VIEW', 'View Doctor Queue', 'OPD', 'View personal OPD queue', now(), now(), NULL, NULL),
  (gen_random_uuid()::text, 'OPD_CONSULTATION_CREATE', 'Create Consultation', 'OPD', 'Start OPD consultation', now(), now(), NULL, NULL),
  (gen_random_uuid()::text, 'OPD_VITALS_RECORD', 'Record Vitals', 'OPD', 'Record patient vitals', now(), now(), NULL, NULL),
  (gen_random_uuid()::text, 'OPD_PRESCRIPTION_CREATE', 'Create Prescription', 'OPD', 'Create OPD prescription', now(), now(), NULL, NULL);

-- ============================================
-- RECEPTIONIST ROLE (example)
-- ============================================

INSERT INTO "Role" (id, "tenantId", code, name, description, "isSystem", "createdAt", "updatedAt", "createdBy", "updatedBy")
VALUES 
  (gen_random_uuid()::text, '<TENANT_ID>', 'RECEPTIONIST', 'Receptionist', 'Front desk staff', true, now(), now(), '<ADMIN_USER_ID>', '<ADMIN_USER_ID>')
ON CONFLICT DO NOTHING;

-- ============================================
-- USER-DEPARTMENT MAPPINGS
-- ============================================

-- Example: Assign receptionist to Cardiology and Anatomy
INSERT INTO "UserDepartment" (id, "tenantId", "userId", "departmentId", "isActive", "createdAt", "updatedAt", "createdBy", "updatedBy")
SELECT 
  gen_random_uuid()::text,
  u."tenantId",
  u.id,
  d.id,
  true,
  now(),
  now(),
  '<ADMIN_USER_ID>',
  '<ADMIN_USER_ID>'
FROM "User" u
CROSS JOIN "Department" d
WHERE u.username = 'receptionist' 
  AND u."tenantId" = '<TENANT_ID>'
  AND d."tenantId" = '<TENANT_ID>'
  AND d.code IN ('CARDIO', 'ANATOMY')
ON CONFLICT ("tenantId", "userId", "departmentId") DO NOTHING;

-- Example: Assign doctors to all departments
INSERT INTO "UserDepartment" (id, "tenantId", "userId", "departmentId", "isActive", "createdAt", "updatedAt", "createdBy", "updatedBy")
SELECT 
  gen_random_uuid()::text,
  u."tenantId",
  u.id,
  d.id,
  true,
  now(),
  now(),
  '<ADMIN_USER_ID>',
  '<ADMIN_USER_ID>'
FROM "User" u
CROSS JOIN "Department" d
WHERE u.username LIKE 'doctor%'
  AND u."tenantId" = '<TENANT_ID>'
  AND d."tenantId" = '<TENANT_ID>'
ON CONFLICT ("tenantId", "userId", "departmentId") DO NOTHING;

-- ============================================
-- ASSIGN OPD PERMISSIONS TO RECEPTIONIST ROLE
-- ============================================

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.code = 'RECEPTIONIST'
  AND r."tenantId" = '<TENANT_ID>'
  AND p.code IN (
    'OPD_VIEW',
    'OPD_CREATE',
    'OPD_CHECKIN'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- ============================================
-- ASSIGN OPD PERMISSIONS TO DOCTOR ROLE
-- ============================================

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.code = 'DOCTOR'
  AND r."tenantId" = '<TENANT_ID>'
  AND p.code IN (
    'OPD_VIEW',
    'DOCTOR_QUEUE_VIEW',
    'OPD_CONSULTATION_CREATE',
    'OPD_VITALS_RECORD',
    'OPD_PRESCRIPTION_CREATE'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- ============================================
-- VERIFY SETUP
-- ============================================

-- Count departments
SELECT COUNT(*) as dept_count FROM "Department" WHERE "tenantId" = '<TENANT_ID>';

-- Count user-department mappings
SELECT COUNT(*) as user_dept_count FROM "UserDepartment" WHERE "tenantId" = '<TENANT_ID>';

-- List receptionist's departments
SELECT u.username, d.name 
FROM "User" u
JOIN "UserDepartment" ud ON u.id = ud."userId"
JOIN "Department" d ON ud."departmentId" = d.id
WHERE u.username = 'receptionist' AND u."tenantId" = '<TENANT_ID>';

-- List doctor's departments
SELECT u.username, d.name 
FROM "User" u
JOIN "UserDepartment" ud ON u.id = ud."userId"
JOIN "Department" d ON ud."departmentId" = d.id
WHERE u.username LIKE 'doctor%' AND u."tenantId" = '<TENANT_ID>';

-- List OPD permissions for receptionist
SELECT p.code, p.name
FROM "Role" r
JOIN "RolePermission" rp ON r.id = rp."roleId"
JOIN "Permission" p ON rp."permissionId" = p.id
WHERE r.code = 'RECEPTIONIST' AND r."tenantId" = '<TENANT_ID>';

-- ============================================
-- NOTES
-- ============================================

/*
To use these queries:

1. Replace <TENANT_ID> with actual tenant UUID
   Example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

2. Replace <ADMIN_USER_ID> with admin user UUID
   Example: 'a47ac10b-58cc-4372-a567-0e02b2c3d479'

3. Run in order:
   - Create departments
   - Create permissions
   - Create role
   - Create user-department mappings
   - Assign permissions to roles

4. Verify with SELECT statements at end

5. Better approach: Use Prisma seed.ts instead
   - Type-safe
   - Easier to maintain
   - Can be version controlled
   - Run with: npm run db:seed
*/

-- ============================================
-- PRISMA SEED.TS EQUIVALENT
-- ============================================

/*
File: prisma/seed.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get or create tenant
  const tenant = await prisma.tenant.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: {
      code: 'DEMO',
      name: 'Demo Hospital',
      type: 'HOSPITAL',
      contact: '+91-9876543210',
      isActive: true,
    },
  })

  // Create departments
  const depts = await Promise.all([
    prisma.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Cardiology' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Cardiology',
        code: 'CARDIO',
        isActive: true,
      },
    }),
    prisma.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Anatomy' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Anatomy',
        code: 'ANATOMY',
        isActive: true,
      },
    }),
  ])

  // Get or create receptionist user
  const receptionist = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'reception@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'reception@demo.com',
      username: 'receptionist',
      passwordHash: hashedPassword,
      fullName: 'Reception Staff',
      isActive: true,
    },
  })

  // Assign receptionist to departments
  for (const dept of depts) {
    await prisma.userDepartment.upsert({
      where: {
        tenantId_userId_departmentId: {
          tenantId: tenant.id,
          userId: receptionist.id,
          departmentId: dept.id,
        },
      },
      update: { isActive: true },
      create: {
        tenantId: tenant.id,
        userId: receptionist.id,
        departmentId: dept.id,
        isActive: true,
      },
    })
  }

  console.log('✅ Seed completed')
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
*/
