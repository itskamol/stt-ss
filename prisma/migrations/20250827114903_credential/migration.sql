-- CreateEnum
CREATE TYPE "public"."CredentialType" AS ENUM ('FACE', 'FINGERPRINT', 'CARD', 'PASSWORD_HASH', 'QR_CODE');

-- CreateTable
CREATE TABLE "public"."EmployeeCredential" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "public"."CredentialType" NOT NULL,
    "value" TEXT NOT NULL,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeCredential_employeeId_idx" ON "public"."EmployeeCredential"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeCredential_type_value_key" ON "public"."EmployeeCredential"("type", "value");

-- AddForeignKey
ALTER TABLE "public"."EmployeeCredential" ADD CONSTRAINT "EmployeeCredential_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
