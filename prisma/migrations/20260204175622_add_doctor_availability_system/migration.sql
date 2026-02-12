-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppointmentStatus" ADD VALUE 'CHECKED_IN';
ALTER TYPE "AppointmentStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "AppointmentStatus" ADD VALUE 'RESCHEDULED';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "bookingSource" TEXT,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "chiefComplaint" TEXT,
ADD COLUMN     "isWalkIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slotEndTime" TEXT;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "tokenNumber" INTEGER;

-- CreateTable
CREATE TABLE "DoctorAvailability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotDurationMinutes" INTEGER NOT NULL DEFAULT 15,
    "maxPatientsPerSlot" INTEGER NOT NULL DEFAULT 1,
    "maxPatientsPerDay" INTEGER,
    "allowWalkIn" BOOLEAN NOT NULL DEFAULT true,
    "walkInSlotReservation" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "DoctorAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoctorAvailability_tenantId_idx" ON "DoctorAvailability"("tenantId");

-- CreateIndex
CREATE INDEX "DoctorAvailability_doctorId_idx" ON "DoctorAvailability"("doctorId");

-- CreateIndex
CREATE INDEX "DoctorAvailability_departmentId_idx" ON "DoctorAvailability"("departmentId");

-- CreateIndex
CREATE INDEX "DoctorAvailability_tenantId_doctorId_idx" ON "DoctorAvailability"("tenantId", "doctorId");

-- CreateIndex
CREATE INDEX "DoctorAvailability_tenantId_departmentId_idx" ON "DoctorAvailability"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "DoctorAvailability_tenantId_doctorId_departmentId_idx" ON "DoctorAvailability"("tenantId", "doctorId", "departmentId");

-- CreateIndex
CREATE INDEX "DoctorAvailability_tenantId_doctorId_dayOfWeek_status_idx" ON "DoctorAvailability"("tenantId", "doctorId", "dayOfWeek", "status");

-- CreateIndex
CREATE INDEX "DoctorAvailability_status_idx" ON "DoctorAvailability"("status");

-- CreateIndex
CREATE INDEX "DoctorAvailability_effectiveFrom_effectiveTo_idx" ON "DoctorAvailability"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorAvailability_tenantId_doctorId_departmentId_dayOfWeek_key" ON "DoctorAvailability"("tenantId", "doctorId", "departmentId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_doctorMasterId_appointmentDate_idx" ON "Appointment"("tenantId", "doctorMasterId", "appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_doctorMasterId_appointmentDate_appoint_idx" ON "Appointment"("tenantId", "doctorMasterId", "appointmentDate", "appointmentTime");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_departmentId_appointmentDate_idx" ON "Appointment"("tenantId", "departmentId", "appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_isWalkIn_idx" ON "Appointment"("isWalkIn");

-- CreateIndex
CREATE INDEX "Visit_tenantId_doctorMasterId_checkInTime_idx" ON "Visit"("tenantId", "doctorMasterId", "checkInTime");

-- CreateIndex
CREATE INDEX "Visit_tenantId_doctorMasterId_status_idx" ON "Visit"("tenantId", "doctorMasterId", "status");

-- AddForeignKey
ALTER TABLE "DoctorAvailability" ADD CONSTRAINT "DoctorAvailability_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAvailability" ADD CONSTRAINT "DoctorAvailability_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
