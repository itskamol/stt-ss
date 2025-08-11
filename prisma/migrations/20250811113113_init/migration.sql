/*
  Warnings:

  - The values [DEGRADED] on the enum `DeviceStatus` will be removed. If these variants are still used in the database, this will fail.
  - Changed the type of `eventType` on the `DeviceEventLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."DeviceProtocol" AS ENUM ('HTTP', 'HTTPS', 'TCP', 'UDP', 'SDK');

-- CreateEnum
CREATE TYPE "public"."DeviceAuthType" AS ENUM ('BASIC', 'DIGEST', 'API_KEY', 'CERTIFICATE');

-- CreateEnum
CREATE TYPE "public"."EventType" AS ENUM ('CARD_SCAN', 'FINGERPRINT_SCAN', 'FACE_RECOGNITION', 'DOOR_OPEN', 'DOOR_CLOSE', 'ALARM', 'TAMPER', 'NETWORK_ERROR', 'ACCESS_GRANTED', 'ACCESS_DENIED');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."DeviceStatus_new" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE');
ALTER TABLE "public"."Device" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Device" ALTER COLUMN "status" TYPE "public"."DeviceStatus_new" USING ("status"::text::"public"."DeviceStatus_new");
ALTER TYPE "public"."DeviceStatus" RENAME TO "DeviceStatus_old";
ALTER TYPE "public"."DeviceStatus_new" RENAME TO "DeviceStatus";
DROP TYPE "public"."DeviceStatus_old";
ALTER TABLE "public"."Device" ALTER COLUMN "status" SET DEFAULT 'OFFLINE';
COMMIT;

-- AlterEnum
ALTER TYPE "public"."DeviceType" ADD VALUE 'ACCESS_CONTROL';

-- AlterTable
ALTER TABLE "public"."Device" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "firmware" TEXT,
ADD COLUMN     "keepAlive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "port" INTEGER DEFAULT 80,
ADD COLUMN     "protocol" "public"."DeviceProtocol" NOT NULL DEFAULT 'HTTP',
ADD COLUMN     "retryAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "timeout" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "username" TEXT,
ALTER COLUMN "status" SET DEFAULT 'OFFLINE';

-- AlterTable
ALTER TABLE "public"."DeviceEventLog" DROP COLUMN "eventType",
ADD COLUMN     "eventType" "public"."EventType" NOT NULL;

-- CreateTable
CREATE TABLE "public"."DeviceTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "defaultSettings" JSONB,
    "endpoints" JSONB,
    "capabilities" JSONB,
    "protocol" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeviceConfiguration" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "networkDhcp" BOOLEAN NOT NULL DEFAULT true,
    "networkStaticIp" TEXT,
    "networkSubnet" TEXT,
    "networkGateway" TEXT,
    "networkDns" TEXT[],
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "ntpServer" TEXT,
    "syncInterval" INTEGER NOT NULL DEFAULT 60,
    "defaultAccessLevel" INTEGER NOT NULL DEFAULT 1,
    "allowUnknownCards" BOOLEAN NOT NULL DEFAULT false,
    "offlineMode" BOOLEAN NOT NULL DEFAULT true,
    "maxUsers" INTEGER NOT NULL DEFAULT 1000,
    "biometricThreshold" INTEGER DEFAULT 5,
    "duressFingerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "antiPassbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eventBufferSize" INTEGER NOT NULL DEFAULT 1000,
    "uploadInterval" INTEGER NOT NULL DEFAULT 30,
    "retryAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmployeeDeviceSync" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "syncType" TEXT NOT NULL DEFAULT 'ADD',
    "errorMessage" TEXT,
    "syncAttempted" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDeviceSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_DeviceToDeviceTemplate" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DeviceToDeviceTemplate_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceTemplate_organizationId_name_key" ON "public"."DeviceTemplate"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceConfiguration_deviceId_key" ON "public"."DeviceConfiguration"("deviceId");

-- CreateIndex
CREATE INDEX "EmployeeDeviceSync_organizationId_syncStatus_idx" ON "public"."EmployeeDeviceSync"("organizationId", "syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDeviceSync_deviceId_employeeId_key" ON "public"."EmployeeDeviceSync"("deviceId", "employeeId");

-- CreateIndex
CREATE INDEX "_DeviceToDeviceTemplate_B_index" ON "public"."_DeviceToDeviceTemplate"("B");

-- CreateIndex
CREATE INDEX "Device_ipAddress_idx" ON "public"."Device"("ipAddress");

-- AddForeignKey
ALTER TABLE "public"."Device" ADD CONSTRAINT "Device_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceTemplate" ADD CONSTRAINT "DeviceTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceConfiguration" ADD CONSTRAINT "DeviceConfiguration_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_DeviceToDeviceTemplate" ADD CONSTRAINT "_DeviceToDeviceTemplate_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_DeviceToDeviceTemplate" ADD CONSTRAINT "_DeviceToDeviceTemplate_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."DeviceTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
