import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { QueueProducer } from './queue.producer';
import { QueueController } from './queue.controller';
import { QueueMonitorProcessor } from './queue.monitor';
import { DeviceEventProcessor } from './processors/device-event.processor';
import { LoggerModule } from '../logger/logger.module';
import { EmployeeModule } from '../../modules/employee/employee.module';
import { AttendanceModule } from '../../modules/attendance/attendance.module';
import { AdapterModule } from '../../shared/adapters/adapter.module';

@Module({
    imports: [
        ConfigModule,
        LoggerModule,
        EmployeeModule,
        AttendanceModule,
        AdapterModule,
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                connection: {
                    host: configService.get('REDIS_HOST', 'localhost'),
                    port: configService.get('REDIS_PORT', 6379),
                    password: configService.get('REDIS_PASSWORD'),
                    db: configService.get('REDIS_DB', 0),
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
            }),
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
