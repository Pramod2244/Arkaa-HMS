-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DECEASED');

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "entityType" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "Permission" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uhid" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "gender" "Gender" NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "bloodGroup" "BloodGroup",
    "allergies" TEXT,
    "medicalHistory" TEXT,
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Patient_tenantId_idx" ON "Patient"("tenantId");

-- CreateIndex
CREATE INDEX "Patient_tenantId_phoneNumber_idx" ON "Patient"("tenantId", "phoneNumber");

-- CreateIndex
CREATE INDEX "Patient_tenantId_firstName_lastName_idx" ON "Patient"("tenantId", "firstName", "lastName");

-- CreateIndex
CREATE INDEX "Patient_tenantId_uhid_idx" ON "Patient"("tenantId", "uhid");

-- CreateIndex
CREATE INDEX "Patient_tenantId_status_idx" ON "Patient"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_tenantId_uhid_key" ON "Patient"("tenantId", "uhid");

-- CreateIndex
CREATE INDEX "Department_tenantId_isActive_idx" ON "Department"("tenantId", "isActive");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
