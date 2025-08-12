import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FileLoggerService } from './file-logger.service';
import { LoggerService } from './logger.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class LogCleanupTask {
    constructor(
        private readonly fileLogger: FileLoggerService,
        private readonly logger: LoggerService,
        private readonly configService: ConfigService
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async handleLogCleanup() {
        if (!this.configService.enableFileLogging) {
            return;
        }

        try {
            this.logger.log('Starting log cleanup task', { module: 'log-cleanup' });
            
            // Keep logs for 30 days by default
            const daysToKeep = parseInt(process.env.LOG_RETENTION_DAYS || '30');
            await this.fileLogger.cleanupOldLogs(daysToKeep);
            
            this.logger.log(`Log cleanup completed - keeping logs for ${daysToKeep} days`, { 
                module: 'log-cleanup' 
            });
        } catch (error) {
            this.logger.error('Log cleanup failed', error.stack, { 
                module: 'log-cleanup',
                error: error.message 
            });
        }
    }
}