import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { FileLoggerService } from './file-logger.service';
import { LogFormatter } from '../utils/log-formatter.util';
import { LogContext, LogLevel, LogEntry } from '../interfaces/log-entry.interface';

@Injectable()
export class LoggerService implements NestLoggerService {
    constructor(
        private readonly configService: ConfigService,
        private readonly fileLogger: FileLoggerService
    ) {}

    private async writeToFile(level: LogLevel, message: string, context?: LogContext): Promise<void> {
        const logEntry: LogEntry = {
            timestamp: LogFormatter.formatTimestamp(),
            level,
            message,
            context,
            correlationId: context?.correlationId,
            userId: context?.userId,
            organizationId: context?.organizationId,
            module: context?.module
        };

        await this.fileLogger.writeLog(logEntry);
    }

    private formatConsoleMessage(level: LogLevel, message: string, context?: LogContext): string {
        if (this.configService.logFormat === 'json') {
            return LogFormatter.formatToJson(level, message, context);
        }

        return LogFormatter.formatPretty(level, message, context, {
            colorize: process.env.NODE_ENV !== 'production',
            includeContext: true
        });
    }

    log(message: any, context?: string | LogContext): void {
        const logContext = typeof context === 'string' ? { module: context } : context;
        const formattedMessage = this.formatConsoleMessage('info', message, logContext);
        
        console.log(formattedMessage);
        this.writeToFile('info', message, logContext);
    }

    error(message: any, trace?: string, context?: string | LogContext): void {
        const logContext = typeof context === 'string' ? { module: context } : context;
        const errorContext = { ...logContext, trace };
        
        const formattedMessage = this.formatConsoleMessage('error', message, errorContext);
        
        console.error(formattedMessage);
        if (trace) {
            console.error(trace);
        }
        
        this.writeToFile('error', message, errorContext);
    }

    warn(message: any, context?: string | LogContext): void {
        const logContext = typeof context === 'string' ? { module: context } : context;
        const formattedMessage = this.formatConsoleMessage('warn', message, logContext);
        
        console.warn(formattedMessage);
        this.writeToFile('warn', message, logContext);
    }

    debug(message: any, context?: string | LogContext): void {
        if (this.configService.logLevel === 'debug' || this.configService.logLevel === 'verbose') {
            const logContext = typeof context === 'string' ? { module: context } : context;
            const formattedMessage = this.formatConsoleMessage('debug', message, logContext);
            
            console.debug(formattedMessage);
            this.writeToFile('debug', message, logContext);
        }
    }

    verbose(message: any, context?: string | LogContext): void {
        if (this.configService.logLevel === 'verbose') {
            const logContext = typeof context === 'string' ? { module: context } : context;
            const formattedMessage = this.formatConsoleMessage('verbose', message, logContext);
            
            console.log(formattedMessage);
            this.writeToFile('verbose', message, logContext);
        }
    }

    // Additional utility methods
    logWithCorrelationId(correlationId: string, level: LogLevel, message: string, context?: Omit<LogContext, 'correlationId'>): void {
        const logContext: LogContext = { ...context, correlationId };
        
        switch (level) {
            case 'error':
                this.error(message, undefined, logContext);
                break;
            case 'warn':
                this.warn(message, logContext);
                break;
            case 'debug':
                this.debug(message, logContext);
                break;
            case 'verbose':
                this.verbose(message, logContext);
                break;
            default:
                this.log(message, logContext);
        }
    }

    logUserAction(userId: string, action: string, details?: any): void {
        this.log(`User action: ${action}`, {
            userId,
            module: 'user-action',
            ...details
        });
    }

    logApiRequest(method: string, url: string, userId?: string, responseTime?: number): void {
        this.log(`${method} ${url}`, {
            module: 'api',
            userId,
            responseTime
        });
    }
}
