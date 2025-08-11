import { Module } from '@nestjs/common';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { DeviceRepository } from './device.repository';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggerModule } from '../../core/logger/logger.module';
import { AdapterModule } from '../../shared/adapters/adapter.module';

@Module({
    imports: [DatabaseModule, LoggerModule, AdapterModule],
    controllers: [DeviceController],
    providers: [DeviceService, DeviceRepository],
    exports: [DeviceService, DeviceRepository],
})
export class DeviceModule {}
