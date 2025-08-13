import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { LogEntry } from '../interfaces/log-entry.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileLoggerService {
    private readonly logsDir: string;
    private readonly enableFileLogging: boolean;

    constructor(private readonly configService: ConfigService) {
        this.logsDir = path.join(process.cwd(), 'logs');
        this.enableFileLogging = this.configService.enableFileLogging;
        
        if (this.enableFileLogging) {
            this.ensureLogsDirectory();
        }
    }

    private ensureLogsDirectory(): void {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    private getLogFileName(level: string): string {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.logsDir, `${level}-${date}.log`);
    }

    private formatLogEntry(entry: LogEntry): string {
        const { timestamp, level, message, context, correlationId, userId, organizationId, module } = entry;
        
        const logObject = {
            timestamp,
            level: level.toUpperCase(),
            message,
            ...(correlationId && { correlationId }),
            ...(userId && { userId }),
            ...(organizationId && { organizationId }),
            ...(module && { module }),
            ...(context && { context })
        };

        return JSON.stringify(logObject) + '\n';
    }

    async writeLog(entry: LogEntry): Promise<void> {
        if (!this.enableFileLogging) {
            return;
        }

        const fileName = this.getLogFileName(entry.level);
        const formattedEntry = this.formatLogEntry(entry);

        try {
            await fs.promises.appendFile(fileName, formattedEntry, 'utf8');
        } catch (error) {
            console.error('Failed to write log to file:', error);
        }
    }

    async cleanupOldLogs(daysToKeep: number): Promise<void> {
        if (!this.enableFileLogging) {
            return;
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        try {
            const files = await fs.promises.readdir(this.logsDir);
            
            for (const file of files) {
                const filePath = path.join(this.logsDir, file);
                const stats = await fs.promises.stat(filePath);
                
                if (stats.mtime < cutoffDate) {
                    await fs.promises.unlink(filePath);
                }
            }
        } catch (error) {
            console.error('Failed to cleanup old logs:', error);
        }
    }
}
