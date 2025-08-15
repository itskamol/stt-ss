-- CreateTable
CREATE TABLE "DeviceWebhook" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "eventTypes" TEXT[],
    "protocolType" TEXT NOT NULL DEFAULT 'HTTP',
    "parameterFormatType" TEXT NOT NULL DEFAULT 'JSON',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceWebhook_deviceId_idx" ON "DeviceWebhook"("deviceId");
CREATE INDEX "DeviceWebhook_organizationId_idx" ON "DeviceWebhook"("organizationId");
CREATE UNIQUE INDEX "DeviceWebhook_deviceId_hostId_key" ON "DeviceWebhook"("deviceId", "hostId");

-- AddForeignKey
ALTER TABLE "DeviceWebhook" ADD CONSTRAINT "DeviceWebhook_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;