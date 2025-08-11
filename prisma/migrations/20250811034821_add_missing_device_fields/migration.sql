/*
  Warnings:

  - You are about to drop the column `entity` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `entityId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `newValue` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `oldValue` on the `AuditLog` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[deviceIdentifier]` on the table `Device` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `duration` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `method` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resource` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timestamp` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `AuditLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."DeviceStatus" ADD VALUE 'online';
ALTER TYPE "public"."DeviceStatus" ADD VALUE 'offline';
ALTER TYPE "public"."DeviceStatus" ADD VALUE 'error';
ALTER TYPE "public"."DeviceStatus" ADD VALUE 'maintenance';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."DeviceType" ADD VALUE 'card_reader';
ALTER TYPE "public"."DeviceType" ADD VALUE 'biometric';
ALTER TYPE "public"."DeviceType" ADD VALUE 'qr_scanner';
ALTER TYPE "public"."DeviceType" ADD VALUE 'facial_recognition';

-- DropForeignKey
ALTER TABLE "public"."AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropIndex
DROP INDEX "public"."AuditLog_organizationId_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "public"."AuditLog" DROP COLUMN "entity",
DROP COLUMN "entityId",
DROP COLUMN "newValue",
DROP COLUMN "oldValue",
ADD COLUMN     "duration" INTEGER NOT NULL,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "errorStack" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "method" TEXT NOT NULL,
ADD COLUMN     "newValues" JSONB,
ADD COLUMN     "oldValues" JSONB,
ADD COLUMN     "requestData" JSONB,
ADD COLUMN     "resource" TEXT NOT NULL,
ADD COLUMN     "resourceId" TEXT,
ADD COLUMN     "responseData" JSONB,
ADD COLUMN     "status" TEXT NOT NULL,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "url" TEXT NOT NULL,
ADD COLUMN     "userAgent" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Device" ADD COLUMN     "description" TEXT,
ADD COLUMN     "deviceIdentifier" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastSeen" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_userId_timestamp_idx" ON "public"."AuditLog"("organizationId", "userId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "public"."AuditLog"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_status_timestamp_idx" ON "public"."AuditLog"("status", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceIdentifier_key" ON "public"."Device"("deviceIdentifier");

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
