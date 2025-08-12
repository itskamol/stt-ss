import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import * as fs from 'fs';
import * as path from 'path';

export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context?: any;
    correlationId?: string;
    userId?: string;
    organizationId?: string;
    module?: string;
}

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
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
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

        try {
            const fileName = this.getLogFileName(entry.level);
            const logLine = this.formatLogEntry(entry);
            
            await fs.promises.appendFile(fileName, logLine, 'utf8');
        } catch (error) {
            // Don't throw errors from logging to avoid infinite loops
            console.error('Failed to write log to file:', error);
        }
    }

    async writeErrorLog(entry: LogEntry & { stack?: string; error?: any }): Promise<void> {
        if (!this.enableFileLogging) {
            return;
        }

        try {
            const fileName = this.getLogFileName('error');
            const errorEntry = {
                ...entry,
                level: 'ERROR',
                ...(entry.stack && { stack: entry.stack }),
                ...(entry.error && { error: entry.error })
            };
            
            const logLine = this.formatLogEntry(errorEntry);
            await fs.promises.appendFile(fileName, logLine, 'utf8');
        } catch (error) {
            console.error('Failed to write error log to file:', error);
        }
    }

    // Clean up old log files (older than specified days)
    async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
        if (!this.enableFileLogging) {
            return;
        }

        try {
            const files = await fs.promises.readdir(this.logsDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logsDir, file);
                    const stats = await fs.promises.stat(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        await fs.promises.unlink(filePath);
                        console.log(`Cleaned up old log file: ${file}`);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to cleanup old logs:', error);
        }
    }
}