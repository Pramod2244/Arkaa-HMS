-- CreateTable
CREATE TABLE "UserDepartment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "UserDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDepartment_tenantId_idx" ON "UserDepartment"("tenantId");

-- CreateIndex
CREATE INDEX "UserDepartment_userId_idx" ON "UserDepartment"("userId");

-- CreateIndex
CREATE INDEX "UserDepartment_departmentId_idx" ON "UserDepartment"("departmentId");

-- CreateIndex
CREATE INDEX "UserDepartment_tenantId_userId_idx" ON "UserDepartment"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "UserDepartment_tenantId_departmentId_idx" ON "UserDepartment"("tenantId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDepartment_tenantId_userId_departmentId_key" ON "UserDepartment"("tenantId", "userId", "departmentId");

-- AddForeignKey
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
