import { Module } from '@nestjs/common';
import { DeviceService } from './services/device.service';
import { DeviceRepository } from './device.repository';
import { DeviceConfigurationService } from './services/device-configuration.service';
import { EmployeeSyncService } from './services/employee-sync.service';
import { DeviceAdapterStrategy } from './device-adapter.strategy';
import { DeviceDiscoveryService } from './services/device-discovery.service';
import { DeviceTemplateService } from './services/device-template.service';
import { DeviceWebhookService } from './services/device-webhook.service';
import { DatabaseModule } from '@/core/database/database.module';
import { LoggerModule } from '@/core/logger/logger.module';
import { AdapterModule } from '@/modules/integrations/adapters/adapter.module';
import { HttpModule } from '@nestjs/axios';
import { EncryptionService } from '@/shared/services/encryption.service';
import { XmlJsonService } from '@/shared/services/xml-json.service';
import { DeviceAdapterFactory } from '@/modules/integrations/adapters/factories/device-adapter.factory';
import { HikvisionAdapter } from '@/modules/integrations/adapters';
import { DeviceController } from './controllers/device.controller';
import { PaginationService } from '@/shared/services/pagination.service';
import { ConfigModule } from '@/core/config/config.module';

@Module({
    imports: [DatabaseModule, LoggerModule, HttpModule, AdapterModule, ConfigModule],
    controllers: [DeviceController],
    providers: [
        DeviceService,
        DeviceRepository,
        DeviceConfigurationService,
        EmployeeSyncService,
        DeviceAdapterStrategy,
        DeviceDiscoveryService,
        DeviceTemplateService,
        DeviceWebhookService,
        DeviceAdapterFactory,
        EncryptionService,
        XmlJsonService,
        HikvisionAdapter,
        PaginationService
    ],
    exports: [
        DeviceService,
        DeviceRepository,
        DeviceConfigurationService,
        EmployeeSyncService,
        DeviceDiscoveryService,
        DeviceTemplateService,
        DeviceWebhookService,
    ],
})
export class DeviceModule {}
