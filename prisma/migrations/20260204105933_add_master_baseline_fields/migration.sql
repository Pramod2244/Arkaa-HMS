/*
  Warnings:

  - You are about to drop the column `isActive` on the `Department` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenantId,code]` on the table `Department` will be added. If there are existing duplicate values, this will fail.
  - Made the column `code` on table `Department` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "MasterStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- DropIndex
DROP INDEX "Department_tenantId_isActive_idx";

-- AlterTable
ALTER TABLE "Department" DROP COLUMN "isActive",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Department_tenantId_status_idx" ON "Department"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Department_tenantId_isDeleted_idx" ON "Department"("tenantId", "isDeleted");

-- CreateIndex
CREATE INDEX "Department_tenantId_status_isDeleted_idx" ON "Department"("tenantId", "status", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_code_key" ON "Department"("tenantId", "code");
