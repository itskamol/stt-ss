/*
  Warnings:

  - You are about to drop the column `deviceIdentifier` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `keepAlive` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `retryAttempts` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `timeout` on the `Device` table. All the data in the column will be lost.
  - The `protocolType` column on the `DeviceWebhook` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `parameterFormatType` column on the `DeviceWebhook` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `syncStatus` column on the `EmployeeDeviceSync` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `syncType` column on the `EmployeeDeviceSync` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[serialNumber]` on the table `Device` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."ParameterFormatType" AS ENUM ('JSON', 'XML', 'QUERY_STRING');

-- CreateEnum
CREATE TYPE "public"."EmployeeSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "public"."EmployeeSyncType" AS ENUM ('ADD', 'UPDATE', 'REMOVE');

-- DropIndex
DROP INDEX "public"."Device_deviceIdentifier_key";

-- AlterTable
ALTER TABLE "public"."Device" DROP COLUMN "deviceIdentifier",
DROP COLUMN "keepAlive",
DROP COLUMN "retryAttempts",
DROP COLUMN "timeout",
ADD COLUMN     "serialNumber" TEXT;

-- AlterTable
ALTER TABLE "public"."DeviceWebhook" DROP COLUMN "protocolType",
ADD COLUMN     "protocolType" "public"."DeviceProtocol" NOT NULL DEFAULT 'HTTP',
DROP COLUMN "parameterFormatType",
ADD COLUMN     "parameterFormatType" "public"."ParameterFormatType" NOT NULL DEFAULT 'JSON';

-- AlterTable
ALTER TABLE "public"."EmployeeDeviceSync" DROP COLUMN "syncStatus",
ADD COLUMN     "syncStatus" "public"."EmployeeSyncStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "syncType",
ADD COLUMN     "syncType" "public"."EmployeeSyncType" NOT NULL DEFAULT 'ADD';

-- CreateIndex
CREATE UNIQUE INDEX "Device_serialNumber_key" ON "public"."Device"("serialNumber");

-- CreateIndex
CREATE INDEX "EmployeeDeviceSync_organizationId_syncStatus_idx" ON "public"."EmployeeDeviceSync"("organizationId", "syncStatus");

-- AddForeignKey
ALTER TABLE "public"."GuestVisit" ADD CONSTRAINT "GuestVisit_responsibleEmployeeId_fkey" FOREIGN KEY ("responsibleEmployeeId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
