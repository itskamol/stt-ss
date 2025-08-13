import { Injectable, Inject, LoggerService as NestLoggerService } from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { LogContext, LogLevel } from '../interfaces/log-entry.interface';

@Injectable()
export class LoggerService implements NestLoggerService {
    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    private getContext(context?: string | LogContext): LogContext {
        if (typeof context === 'string') {
            return { module: context };
        }
        return context;
    }

    log(message: any, context?: string | LogContext): void {
        this.logger.info(message, { context: this.getContext(context) });
    }

    error(message: any, trace?: string, context?: string | LogContext): void {
        const logContext = this.getContext(context);
        const errorContext = { ...logContext, trace };
        this.logger.error(message, { context: errorContext });
    }

    warn(message: any, context?: string | LogContext): void {
        this.logger.warn(message, { context: this.getContext(context) });
    }

    debug(message: any, context?: string | LogContext): void {
        this.logger.debug(message, { context: this.getContext(context) });
    }

    verbose(message: any, context?: string | LogContext): void {
        this.logger.verbose(message, { context: this.getContext(context) });
    }

    // Additional utility methods
    logWithCorrelationId(correlationId: string, level: LogLevel, message: string, context?: Omit<LogContext, 'correlationId'>): void {
        const logContext: LogContext = { ...context, correlationId };
        this.logger[level](message, { context: logContext });
    }

    logUserAction(userId: string, action: string, details?: any): void {
        this.log(`User action: ${action}`, {
            userId,
            module: 'user-action',
            ...details,
        });
    }

    logApiRequest(method: string, url: string, userId?: string, responseTime?: number): void {
        this.log(`${method} ${url}`, {
            module: 'api',
            userId,
            responseTime,
        });
    }
}
