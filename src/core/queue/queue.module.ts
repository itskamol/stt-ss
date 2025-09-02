import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { QueueProducer } from './queue.producer';
import { QueueController } from './queue.controller';
import { QueueMonitorProcessor } from './queue.monitor';
import { DeviceEventProcessor } from './processors/device-event.processor';
import { LoggerModule } from '../logger/logger.module';
import { AdapterModule } from '@/modules/integrations/adapters/adapter.module';
import { ConfigService } from '../config/config.service';
import { ConfigModule } from '../config/config.module';
import { EmployeeModule } from '@/modules/employee';
import { AttendanceModule } from '@/modules/attendance/attendance.module';

@Module({
    imports: [
        ConfigModule,
        LoggerModule,
        EmployeeModule,
        AttendanceModule,
        AdapterModule,
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const redisUrl = configService.redisUrl;

                return {
                    connection: {
                        url: redisUrl,
                    },
                    defaultJobOptions: {
                        removeOnComplete: 100,
                        removeOnFail: 50,
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 2000,
                        },
                    },
                };
            },
            inject: [ConfigService],
        }),
        BullModule.registerQueue(
            { name: 'events' },
            { name: 'notifications' },
            { name: 'exports' },
            { name: 'system-health' }
        ),
    ],
    controllers: [QueueController],
    providers: [QueueService, QueueProducer, QueueMonitorProcessor, DeviceEventProcessor],
    exports: [QueueService, QueueProducer, BullModule],
})
export class QueueModule {}
