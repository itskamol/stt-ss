/*
  Warnings:

  - The values [online,offline,error,maintenance] on the enum `DeviceStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [card_reader,biometric,qr_scanner,facial_recognition] on the enum `DeviceType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `lastSeenAt` on the `Device` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."DeviceStatus_new" AS ENUM ('ONLINE', 'OFFLINE', 'DEGRADED', 'ERROR');
ALTER TABLE "public"."Device" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Device" ALTER COLUMN "status" TYPE "public"."DeviceStatus_new" USING ("status"::text::"public"."DeviceStatus_new");
ALTER TYPE "public"."DeviceStatus" RENAME TO "DeviceStatus_old";
ALTER TYPE "public"."DeviceStatus_new" RENAME TO "DeviceStatus";
DROP TYPE "public"."DeviceStatus_old";
ALTER TABLE "public"."Device" ALTER COLUMN "status" SET DEFAULT 'ONLINE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."DeviceType_new" AS ENUM ('CAMERA', 'CARD_READER', 'FINGERPRINT', 'ANPR', 'OTHER');
ALTER TABLE "public"."Device" ALTER COLUMN "type" TYPE "public"."DeviceType_new" USING ("type"::text::"public"."DeviceType_new");
ALTER TYPE "public"."DeviceType" RENAME TO "DeviceType_old";
ALTER TYPE "public"."DeviceType_new" RENAME TO "DeviceType";
DROP TYPE "public"."DeviceType_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."Device" DROP COLUMN "lastSeenAt";
