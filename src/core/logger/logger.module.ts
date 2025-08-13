import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

// Services
import { LoggerService } from './services/main-logger.service';
import { FileLoggerService } from './services/file-logger.service';
import { MinimalLoggerService } from './services/minimal-logger.service';

// Tasks
import { LogCleanupTask } from './tasks/log-cleanup.task';

// Config
import { ConfigModule } from '../config/config.module';

@Global()
@Module({
    imports: [
        ConfigModule,
        ScheduleModule.forRoot()
    ],
    providers: [
        LoggerService,
        FileLoggerService,
        MinimalLoggerService,
        LogCleanupTask
    ],
    exports: [
        LoggerService,
        FileLoggerService,
        MinimalLoggerService
    ],
})
export class LoggerModule {}
