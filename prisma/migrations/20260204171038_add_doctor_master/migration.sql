-- CreateEnum
CREATE TYPE "DoctorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "doctorMasterId" TEXT;

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "doctorMasterId" TEXT;

-- AlterTable
ALTER TABLE "LabOrder" ADD COLUMN     "doctorMasterId" TEXT;

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "doctorMasterId" TEXT;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "doctorMasterId" TEXT;

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "doctorCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "registrationAuthority" TEXT,
    "registrationDate" TIMESTAMP(3),
    "fullName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "qualifications" TEXT[],
    "specializations" TEXT[],
    "yearsOfExperience" INTEGER,
    "consultationFee" DECIMAL(10,2),
    "followUpFee" DECIMAL(10,2),
    "primaryDepartmentId" TEXT NOT NULL,
    "status" "DoctorStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSchedulable" BOOLEAN NOT NULL DEFAULT true,
    "allowWalkIn" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorDepartment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

-- CreateIndex
CREATE INDEX "Doctor_tenantId_idx" ON "Doctor"("tenantId");

-- CreateIndex
CREATE INDEX "Doctor_tenantId_status_idx" ON "Doctor"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Doctor_tenantId_isDeleted_idx" ON "Doctor"("tenantId", "isDeleted");

-- CreateIndex
CREATE INDEX "Doctor_tenantId_primaryDepartmentId_idx" ON "Doctor"("tenantId", "primaryDepartmentId");

-- CreateIndex
CREATE INDEX "Doctor_tenantId_status_isDeleted_idx" ON "Doctor"("tenantId", "status", "isDeleted");

-- CreateIndex
CREATE INDEX "Doctor_userId_idx" ON "Doctor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_tenantId_doctorCode_key" ON "Doctor"("tenantId", "doctorCode");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_tenantId_userId_key" ON "Doctor"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "DoctorDepartment_tenantId_idx" ON "DoctorDepartment"("tenantId");

-- CreateIndex
CREATE INDEX "DoctorDepartment_doctorId_idx" ON "DoctorDepartment"("doctorId");

-- CreateIndex
CREATE INDEX "DoctorDepartment_departmentId_idx" ON "DoctorDepartment"("departmentId");

-- CreateIndex
CREATE INDEX "DoctorDepartment_tenantId_departmentId_idx" ON "DoctorDepartment"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "DoctorDepartment_tenantId_departmentId_isActive_idx" ON "DoctorDepartment"("tenantId", "departmentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorDepartment_doctorId_departmentId_key" ON "DoctorDepartment"("doctorId", "departmentId");

-- CreateIndex
CREATE INDEX "Appointment_doctorMasterId_idx" ON "Appointment"("doctorMasterId");

-- CreateIndex
CREATE INDEX "LabOrder_doctorMasterId_idx" ON "LabOrder"("doctorMasterId");

-- CreateIndex
CREATE INDEX "Prescription_doctorMasterId_idx" ON "Prescription"("doctorMasterId");

-- CreateIndex
CREATE INDEX "Visit_doctorMasterId_idx" ON "Visit"("doctorMasterId");

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_primaryDepartmentId_fkey" FOREIGN KEY ("primaryDepartmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorDepartment" ADD CONSTRAINT "DoctorDepartment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorDepartment" ADD CONSTRAINT "DoctorDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorMasterId_fkey" FOREIGN KEY ("doctorMasterId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_doctorMasterId_fkey" FOREIGN KEY ("doctorMasterId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_doctorMasterId_fkey" FOREIGN KEY ("doctorMasterId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorMasterId_fkey" FOREIGN KEY ("doctorMasterId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_doctorMasterId_fkey" FOREIGN KEY ("doctorMasterId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
