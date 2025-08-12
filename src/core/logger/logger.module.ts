import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerService } from './logger.service';
import { FileLoggerService } from './file-logger.service';
import { LogCleanupTask } from './log-cleanup.task';
import { ConfigModule } from '../config/config.module';

@Global()
@Module({
    imports: [ConfigModule, ScheduleModule.forRoot()],
    providers: [LoggerService, FileLoggerService, LogCleanupTask],
    exports: [LoggerService, FileLoggerService],
})
export class LoggerModule {}
