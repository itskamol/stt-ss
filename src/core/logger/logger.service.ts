import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

export interface LogContext {
    correlationId?: string;
    userId?: string;
    organizationId?: string;
    module?: string;
    method?: string;
    [key: string]: any;
}

@Injectable()
export class LoggerService implements NestLoggerService {
    constructor(private readonly configService: ConfigService) {}

    private formatMessage(level: string, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` ${JSON.stringify(context)}` : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
    }

    log(message: any, context?: any): void {
        // Handle NestJS internal logging which might pass different types
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        const contextObj = typeof context === 'string' ? { context } : context;
        
        console.log(this.formatMessage('info', messageStr, contextObj));
    }

    error(message: any, trace?: any, context?: any): void {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        const traceStr = typeof trace === 'string' ? trace : undefined;
        const contextObj = typeof context === 'string' ? { context } : context;
        
        const errorContext = {
            ...(contextObj || {}),
            ...(traceStr && { trace: traceStr }),
        };
        console.error(this.formatMessage('error', messageStr, errorContext));
    }

    warn(message: any, context?: any): void {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        const contextObj = typeof context === 'string' ? { context } : context;
        
        console.warn(this.formatMessage('warn', messageStr, contextObj));
    }

    debug(message: any, context?: any): void {
        if (this.configService.isDevelopment || this.configService.logLevel === 'debug') {
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            const contextObj = typeof context === 'string' ? { context } : context;
            
            console.debug(this.formatMessage('debug', messageStr, contextObj));
        }
    }

    verbose(message: any, context?: any): void {
        if (this.configService.isDevelopment || this.configService.logLevel === 'verbose') {
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            const contextObj = typeof context === 'string' ? { context } : context;
            
            console.log(this.formatMessage('verbose', messageStr, contextObj));
        }
    }

    // Convenience methods for common logging scenarios
    logUserAction(
        userId: string,
        action: string,
        details?: any,
        organizationId?: string,
        correlationId?: string
    ): void {
        this.log(`User action: ${action}`, {
            userId,
            organizationId,
            correlationId,
            action,
            details,
            module: 'user-action',
        });
    }

    logDatabaseOperation(
        operation: string,
        entity: string,
        entityId?: string,
        userId?: string,
        organizationId?: string,
        correlationId?: string
    ): void {
        this.log(`Database operation: ${operation} on ${entity}`, {
            operation,
            entity,
            entityId,
            userId,
            organizationId,
            correlationId,
            module: 'database',
        });
    }

    logSecurityEvent(
        event: string,
        details?: unknown,
        userId?: string,
        organizationId?: string,
        correlationId?: string
    ): void {
        this.warn(`Security event: ${event}`, {
            event,
            details,
            userId,
            organizationId,
            correlationId,
            module: 'security',
        });
    }

    logApiRequest(
        method: string,
        url: string,
        statusCode: number,
        responseTime: number,
        userId?: string,
        organizationId?: string,
        correlationId?: string
    ): void {
        this.log(`API Request: ${method} ${url} - ${statusCode} (${responseTime}ms)`, {
            method,
            url,
            statusCode,
            responseTime,
            userId,
            organizationId,
            correlationId,
            module: 'api',
        });
    }

    logQueueJob(
        jobName: string,
        jobId: string,
        status: 'started' | 'completed' | 'failed',
        duration?: number,
        error?: string,
        correlationId?: string
    ): void {
        const level = status === 'failed' ? 'error' : 'info';
        const message = `Queue job ${jobName} (${jobId}) ${status}`;

        const context = {
            jobName,
            jobId,
            status,
            duration,
            error,
            correlationId,
            module: 'queue',
        };

        if (level === 'error') {
            this.error(message, error, context);
        } else {
            this.log(message, context);
        }
    }
}
