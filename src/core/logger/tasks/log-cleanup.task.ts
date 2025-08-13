import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FileLoggerService } from '../services/file-logger.service';
import { LoggerService } from '../services/main-logger.service';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class LogCleanupTask {
    constructor(
        private readonly fileLogger: FileLoggerService,
        private readonly logger: LoggerService,
        private readonly configService: ConfigService
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async handleLogCleanup(): Promise<void> {
        if (!this.configService.enableFileLogging) {
            return;
        }

        try {
            this.logger.log('Starting log cleanup task', { module: 'log-cleanup' });
            
            const daysToKeep = parseInt(process.env.LOG_RETENTION_DAYS || '30');
            await this.fileLogger.cleanupOldLogs(daysToKeep);
            
            this.logger.log(`Log cleanup completed - keeping logs for ${daysToKeep} days`, { 
                module: 'log-cleanup' 
            });
        } catch (error) {
            this.logger.error('Log cleanup failed', error.stack, { module: 'log-cleanup' });
        }
    }

    // Manual cleanup method
    async manualCleanup(daysToKeep: number): Promise<void> {
        if (!this.configService.enableFileLogging) {
            throw new Error('File logging is disabled');
        }

        try {
            this.logger.log(`Starting manual log cleanup - keeping ${daysToKeep} days`, { 
                module: 'log-cleanup' 
            });
            
            await this.fileLogger.cleanupOldLogs(daysToKeep);
            
            this.logger.log('Manual log cleanup completed', { module: 'log-cleanup' });
        } catch (error) {
            this.logger.error('Manual log cleanup failed', error.stack, { module: 'log-cleanup' });
            throw error;
        }
    }
}
