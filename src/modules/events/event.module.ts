import { Module } from '@nestjs/common';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventRepository } from './event.repository';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggerModule } from '../../core/logger/logger.module';
import { CacheModule } from '../../core/cache/cache.module';
import { QueueModule } from '../../core/queue/queue.module';
import { DeviceModule } from '../device/device.module';

@Module({
    imports: [DatabaseModule, LoggerModule, CacheModule, QueueModule, DeviceModule],
    controllers: [EventController],
    providers: [EventService, EventRepository],
    exports: [EventService, EventRepository],
})
export class EventModule {}
