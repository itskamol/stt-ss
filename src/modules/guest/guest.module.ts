import { Module } from '@nestjs/common';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';
import { GuestRepository } from './guest.repository';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggerModule } from '../../core/logger/logger.module';
import { QueueModule } from '../../core/queue/queue.module';

@Module({
    imports: [DatabaseModule, LoggerModule, QueueModule],
    controllers: [GuestController],
    providers: [GuestService, GuestRepository],
    exports: [GuestService, GuestRepository],
})
export class GuestModule {}
