import { Module } from '@nestjs/common';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { DeviceRepository } from './device.repository';
import { DeviceConfigurationService } from './device-configuration.service';
import { EmployeeSyncService } from './employee-sync.service';
import { DeviceAdapterStrategy } from './device-adapter.strategy';
import { DatabaseModule } from '@/core/database/database.module';
import { LoggerModule } from '@/core/logger/logger.module';
import { AdapterModule } from '@/modules/integrations/adapters/adapter.module';
import { HttpModule } from '@nestjs/axios';
import { EncryptionService } from '@/shared/services/encryption.service';
import { XmlJsonService } from '@/shared/services/xml-json.service';
import { DeviceAdapterFactory } from '@/modules/integrations/adapters/factories/device-adapter.factory';
import { StubDeviceAdapter } from '@/modules/integrations/adapters/implementations/device/stub-device.adapter';
import { HikvisionAdapter } from '@/modules/integrations/adapters';

@Module({
    imports: [DatabaseModule, LoggerModule, HttpModule, AdapterModule],
    controllers: [DeviceController],
    providers: [
        DeviceService,
        DeviceRepository,
        DeviceConfigurationService,
        EmployeeSyncService,
        DeviceAdapterStrategy,
        DeviceAdapterFactory,
        StubDeviceAdapter,
        EncryptionService,
        XmlJsonService,
        HikvisionAdapter,
    ],
    exports: [DeviceService, DeviceRepository, DeviceConfigurationService, EmployeeSyncService],
})
export class DeviceModule {}
