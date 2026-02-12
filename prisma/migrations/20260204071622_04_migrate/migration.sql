/*
  Warnings:

  - You are about to drop the column `generalExamination` on the `Consultation` table. All the data in the column will be lost.
  - You are about to drop the column `localExamination` on the `Consultation` table. All the data in the column will be lost.
  - You are about to drop the column `systemicExamination` on the `Consultation` table. All the data in the column will be lost.
  - Made the column `chiefComplaint` on table `Consultation` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Consultation" DROP COLUMN "generalExamination",
DROP COLUMN "localExamination",
DROP COLUMN "systemicExamination",
ADD COLUMN     "physicalExamination" TEXT,
ADD COLUMN     "status" "ConsultationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
ALTER COLUMN "chiefComplaint" SET NOT NULL;
