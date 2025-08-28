-- CreateEnum
CREATE TYPE "public"."GuestStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."AccessCredentialType" AS ENUM ('QR_CODE', 'TEMP_CARD', 'FACE');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "public"."DeviceType" AS ENUM ('CAMERA', 'CARD_READER', 'FINGERPRINT', 'ANPR', 'ACCESS_CONTROL', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "public"."DeviceProtocol" AS ENUM ('HTTP', 'HTTPS', 'TCP', 'UDP', 'SDK');

-- CreateEnum
CREATE TYPE "public"."DeviceAuthType" AS ENUM ('BASIC', 'DIGEST', 'API_KEY', 'CERTIFICATE');

-- CreateEnum
CREATE TYPE "public"."AttendanceEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'GUEST_CHECK_IN', 'GUEST_CHECK_OUT', 'MANUAL_ENTRY');

-- CreateEnum
CREATE TYPE "public"."ReportType" AS ENUM ('DAILY_ATTENDANCE', 'WEEKLY_ATTENDANCE', 'MONTHLY_ATTENDANCE', 'EMPLOYEE_LIST', 'DEVICE_STATUS', 'GUEST_VISITS', 'SECURITY_AUDIT', 'CUSTOM_QUERY');

-- CreateEnum
CREATE TYPE "public"."ReportFormat" AS ENUM ('CSV', 'PDF', 'EXCEL', 'JSON');

-- CreateEnum
CREATE TYPE "public"."EventType" AS ENUM ('CARD_SCAN', 'FINGERPRINT_SCAN', 'FACE_RECOGNITION', 'DOOR_OPEN', 'DOOR_CLOSE', 'ALARM', 'TAMPER', 'NETWORK_ERROR', 'ACCESS_GRANTED', 'ACCESS_DENIED');

-- CreateEnum
CREATE TYPE "public"."ParameterFormatType" AS ENUM ('JSON', 'XML', 'QUERY_STRING');

-- CreateEnum
CREATE TYPE "public"."EmployeeSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "public"."EmployeeSyncType" AS ENUM ('ADD', 'UPDATE', 'REMOVE');

-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."CredentialType" AS ENUM ('FACE', 'FINGERPRINT', 'CARD', 'CAR_NUMBER', 'PASSWORD_HASH', 'QR_CODE');

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

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrganizationUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Branch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ManagedBranch" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagedBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Employee" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "departmentId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "photoKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Device" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "departmentId" TEXT,
    "name" TEXT NOT NULL,
    "type" "public"."DeviceType" NOT NULL,
    "host" TEXT,
    "username" TEXT,
    "password" TEXT,
    "port" INTEGER DEFAULT 80,
    "protocol" "public"."DeviceProtocol" NOT NULL DEFAULT 'HTTP',
    "macAddress" TEXT,
    "manufacturer" TEXT,
    "serialNumber" TEXT,
    "model" TEXT,
    "firmware" TEXT,
    "description" TEXT,
    "status" "public"."DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuestVisit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestContact" TEXT,
    "responsibleEmployeeId" TEXT,
    "scheduledEntryTime" TIMESTAMP(3) NOT NULL,
    "scheduledExitTime" TIMESTAMP(3) NOT NULL,
    "status" "public"."GuestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "accessCredentialType" "public"."AccessCredentialType" NOT NULL,
    "accessCredentialHash" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attendance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT,
    "guestId" TEXT,
    "deviceId" TEXT,
    "eventType" "public"."AttendanceEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeviceEventLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "eventType" "public"."EventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "rawPayloadUrl" TEXT,
    "metadata" JSONB,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "requestData" JSONB,
    "responseData" JSONB,
    "status" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."ReportType" NOT NULL,
    "format" "public"."ReportFormat" NOT NULL DEFAULT 'CSV',
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'PENDING',
    "parameters" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "fileUrl" TEXT,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "recordCount" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

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
    "syncStatus" "public"."EmployeeSyncStatus" NOT NULL DEFAULT 'PENDING',
    "syncType" "public"."EmployeeSyncType" NOT NULL DEFAULT 'ADD',
    "errorMessage" TEXT,
    "syncAttempted" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDeviceSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeviceWebhook" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "eventTypes" TEXT[],
    "protocolType" "public"."DeviceProtocol" NOT NULL DEFAULT 'HTTP',
    "parameterFormatType" "public"."ParameterFormatType" NOT NULL DEFAULT 'JSON',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "lastTriggered" TIMESTAMP(3),
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_DeviceToDeviceTemplate" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DeviceToDeviceTemplate_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "EmployeeCredential_employeeId_idx" ON "public"."EmployeeCredential"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeCredential_type_value_key" ON "public"."EmployeeCredential"("type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "public"."Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "OrganizationUser_organizationId_idx" ON "public"."OrganizationUser"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationUser_userId_idx" ON "public"."OrganizationUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationUser_userId_organizationId_key" ON "public"."OrganizationUser"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Branch_organizationId_idx" ON "public"."Branch"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_organizationId_name_key" ON "public"."Branch"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ManagedBranch_managerId_idx" ON "public"."ManagedBranch"("managerId");

-- CreateIndex
CREATE INDEX "ManagedBranch_branchId_idx" ON "public"."ManagedBranch"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedBranch_managerId_branchId_key" ON "public"."ManagedBranch"("managerId", "branchId");

-- CreateIndex
CREATE INDEX "Department_branchId_idx" ON "public"."Department"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_branchId_name_key" ON "public"."Department"("branchId", "name");

-- CreateIndex
CREATE INDEX "Employee_organizationId_idx" ON "public"."Employee"("organizationId");

-- CreateIndex
CREATE INDEX "Employee_branchId_idx" ON "public"."Employee"("branchId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "public"."Employee"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_employeeCode_key" ON "public"."Employee"("organizationId", "employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_email_key" ON "public"."Employee"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Device_macAddress_key" ON "public"."Device"("macAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Device_serialNumber_key" ON "public"."Device"("serialNumber");

-- CreateIndex
CREATE INDEX "Device_branchId_status_idx" ON "public"."Device"("branchId", "status");

-- CreateIndex
CREATE INDEX "Device_host_idx" ON "public"."Device"("host");

-- CreateIndex
CREATE UNIQUE INDEX "Device_organizationId_name_key" ON "public"."Device"("organizationId", "name");

-- CreateIndex
CREATE INDEX "GuestVisit_branchId_status_idx" ON "public"."GuestVisit"("branchId", "status");

-- CreateIndex
CREATE INDEX "GuestVisit_accessCredentialHash_idx" ON "public"."GuestVisit"("accessCredentialHash");

-- CreateIndex
CREATE INDEX "Attendance_organizationId_employeeId_timestamp_idx" ON "public"."Attendance"("organizationId", "employeeId", "timestamp");

-- CreateIndex
CREATE INDEX "Attendance_organizationId_guestId_timestamp_idx" ON "public"."Attendance"("organizationId", "guestId", "timestamp");

-- CreateIndex
CREATE INDEX "DeviceEventLog_deviceId_timestamp_idx" ON "public"."DeviceEventLog"("deviceId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_userId_timestamp_idx" ON "public"."AuditLog"("organizationId", "userId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "public"."AuditLog"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_status_timestamp_idx" ON "public"."AuditLog"("status", "timestamp");

-- CreateIndex
CREATE INDEX "Report_organizationId_type_status_idx" ON "public"."Report"("organizationId", "type", "status");

-- CreateIndex
CREATE INDEX "Report_createdByUserId_createdAt_idx" ON "public"."Report"("createdByUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceTemplate_organizationId_name_key" ON "public"."DeviceTemplate"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceConfiguration_deviceId_key" ON "public"."DeviceConfiguration"("deviceId");

-- CreateIndex
CREATE INDEX "EmployeeDeviceSync_organizationId_syncStatus_idx" ON "public"."EmployeeDeviceSync"("organizationId", "syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDeviceSync_deviceId_employeeId_key" ON "public"."EmployeeDeviceSync"("deviceId", "employeeId");

-- CreateIndex
CREATE INDEX "DeviceWebhook_organizationId_isActive_idx" ON "public"."DeviceWebhook"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "DeviceWebhook_deviceId_isActive_idx" ON "public"."DeviceWebhook"("deviceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceWebhook_deviceId_hostId_key" ON "public"."DeviceWebhook"("deviceId", "hostId");

-- CreateIndex
CREATE INDEX "_DeviceToDeviceTemplate_B_index" ON "public"."_DeviceToDeviceTemplate"("B");

-- AddForeignKey
ALTER TABLE "public"."EmployeeCredential" ADD CONSTRAINT "EmployeeCredential_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationUser" ADD CONSTRAINT "OrganizationUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationUser" ADD CONSTRAINT "OrganizationUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Branch" ADD CONSTRAINT "Branch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ManagedBranch" ADD CONSTRAINT "ManagedBranch_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."OrganizationUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ManagedBranch" ADD CONSTRAINT "ManagedBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Department" ADD CONSTRAINT "Department_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Device" ADD CONSTRAINT "Device_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Device" ADD CONSTRAINT "Device_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Device" ADD CONSTRAINT "Device_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuestVisit" ADD CONSTRAINT "GuestVisit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuestVisit" ADD CONSTRAINT "GuestVisit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuestVisit" ADD CONSTRAINT "GuestVisit_responsibleEmployeeId_fkey" FOREIGN KEY ("responsibleEmployeeId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "public"."GuestVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceEventLog" ADD CONSTRAINT "DeviceEventLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceTemplate" ADD CONSTRAINT "DeviceTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceConfiguration" ADD CONSTRAINT "DeviceConfiguration_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceWebhook" ADD CONSTRAINT "DeviceWebhook_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_DeviceToDeviceTemplate" ADD CONSTRAINT "_DeviceToDeviceTemplate_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_DeviceToDeviceTemplate" ADD CONSTRAINT "_DeviceToDeviceTemplate_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."DeviceTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
