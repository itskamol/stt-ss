/*
  Warnings:

  - You are about to drop the column `ipAddress` on the `Device` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Device_ipAddress_idx";

-- AlterTable
ALTER TABLE "public"."Device" DROP COLUMN "ipAddress",
ADD COLUMN     "host" TEXT;

-- CreateIndex
CREATE INDEX "Device_host_idx" ON "public"."Device"("host");
