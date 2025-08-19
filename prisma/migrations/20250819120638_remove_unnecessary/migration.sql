/*
  Warnings:

  - You are about to drop the column `organizationId` on the `DeviceEventLog` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[organizationId,email]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."DeviceEventLog_organizationId_deviceId_timestamp_idx";

-- DropIndex
DROP INDEX "public"."Employee_email_key";

-- AlterTable
ALTER TABLE "public"."DeviceEventLog" DROP COLUMN "organizationId";

-- CreateIndex
CREATE INDEX "DeviceEventLog_deviceId_timestamp_idx" ON "public"."DeviceEventLog"("deviceId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_email_key" ON "public"."Employee"("organizationId", "email");
