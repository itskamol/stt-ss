import { Module } from '@nestjs/common';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { DeviceRepository } from './device.repository';
import { DeviceConfigurationService } from './device-configuration.service';
import { EmployeeSyncService } from './employee-sync.service';
import { DeviceAdapterStrategy } from './device-adapter.strategy';
import { DatabaseModule } from '@/core/database/database.module';
import { LoggerModule } from '@/core/logger/logger.module';
import { AdapterModule } from '@/shared/adapters/adapter.module';
import { DeviceAdapterFactory } from '@/shared/adapters/device-adapter.factory';
import { HikvisionApiAdapter } from '@/shared/adapters/implementations/hikvision-api.adapter';
import { StubDeviceAdapter } from '@/shared/adapters/implementations/stub-device.adapter';
import { HttpModule } from '@nestjs/axios';
import { EncryptionService } from '@/shared/services/encryption.service';
import { HikvisionAdapterModule } from '@/shared/adapters/hikvision-adapter.module';
import { HikvisionSessionService } from '@/shared/services/hikvision-session.service';
import { HikvisionUserManagementService } from '@/shared/services/hikvision-user-management.service';
import { HikvisionDeviceControlService } from '@/shared/services/hikvision-device-control.service';
import { HikvisionDiscoveryService } from '@/shared/services/hikvision-discovery.service';
import { HikvisionEventMonitoringService } from '@/shared/services/hikvision-event-monitoring.service';
import { HikvisionMaintenanceService } from '@/shared/services/hikvision-maintenance.service';

@Module({
    imports: [DatabaseModule, LoggerModule, AdapterModule, HttpModule, AdapterModule],
    controllers: [DeviceController],
    providers: [
        DeviceAdapterFactory,
        HikvisionApiAdapter,
        StubDeviceAdapter,
        EncryptionService,
        HikvisionSessionService,
        HikvisionUserManagementService,
        HikvisionDeviceControlService,
        HikvisionDiscoveryService,
        HikvisionEventMonitoringService,
        HikvisionMaintenanceService,
        DeviceService, 
        DeviceRepository,
        DeviceConfigurationService, 
        EmployeeSyncService,
        DeviceAdapterStrategy
    ],
    exports: [
        DeviceService, 
        DeviceRepository, 
        DeviceConfigurationService, 
        EmployeeSyncService,
        DeviceAdapterStrategy
    ],
})
export class DeviceModule {}
