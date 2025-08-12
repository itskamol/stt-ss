import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { FileLoggerService } from './file-logger.service';
import * as chalk from 'chalk';

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
    constructor(
        private readonly configService: ConfigService,
        private readonly fileLogger: FileLoggerService
    ) {}

    private formatMessage(level: string, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        
        if (this.configService.logFormat === 'json') {
            return JSON.stringify({
                timestamp,
                level: level.toUpperCase(),
                message,
                ...context
            });
        }

        // Pretty format for development
        return this.formatPrettyMessage(level, message, context, timestamp);
    }

    private formatPrettyMessage(level: string, message: string, context?: LogContext, timestamp?: string): string {
        const ts = timestamp || new Date().toISOString();
        const time = chalk.gray(`[${ts}]`);
        
        // Color-code log levels
        let levelStr: string;
        switch (level.toLowerCase()) {
            case 'error':
                levelStr = chalk.red.bold('ERROR');
                break;
            case 'warn':
                levelStr = chalk.yellow.bold('WARN');
                break;
            case 'info':
                levelStr = chalk.blue.bold('INFO');
                break;
            case 'debug':
                levelStr = chalk.magenta.bold('DEBUG');
                break;
            case 'verbose':
                levelStr = chalk.cyan.bold('VERBOSE');
                break;
            default:
                levelStr = level.toUpperCase();
        }

        let formattedMessage = `${time} ${levelStr}: ${message}`;

        if (context) {
            const { correlationId, userId, organizationId, module, method, ...rest } = context;
            
            // Add important context inline
            const inlineContext = [];
            if (correlationId) inlineContext.push(chalk.gray(`[${correlationId}]`));
            if (module) inlineContext.push(chalk.green(`[${module}]`));
            if (method) inlineContext.push(chalk.blue(`[${method}]`));
            if (userId) inlineContext.push(chalk.yellow(`[user:${userId}]`));
            if (organizationId) inlineContext.push(chalk.cyan(`[org:${organizationId}]`));
            
            if (inlineContext.length > 0) {
                formattedMessage += ` ${inlineContext.join(' ')}`;
            }

            // Add remaining context as JSON if present
            if (Object.keys(rest).length > 0) {
                formattedMessage += `\n${chalk.gray(JSON.stringify(rest, null, 2))}`;
            }
        }

        return formattedMessage;
    }

    private shouldFilterInternalLog(message: string, context?: LogContext): boolean {
        if (!this.configService.isDevelopment) {
            return false; // Don't filter in production
        }

        const contextStr = typeof context === 'object' && context?.context ? context.context : '';
        
        // Filter out noisy NestJS internal logs
        const noisyPatterns = [
            'InstanceLoader',
            'RoutesResolver', 
            'RouterExplorer',
            'NestFactory',
            'NestApplication',
            'dependencies initialized',
            'Mapped {',
            'PassportModule',
            'ConfigHostModule',
            'DiscoveryModule',
            'ConfigModule',
            'ScheduleModule',
            'BullModule',
            'DatabaseModule',
            'JwtModule',
            'LoggerModule',
            'AdapterModule',
            'CacheModule'
        ];

        return noisyPatterns.some(pattern => 
            message.includes(pattern) || contextStr.includes(pattern)
        );
    }

    private async writeToFile(level: string, message: string, context?: LogContext, stack?: string): Promise<void> {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            correlationId: context?.correlationId,
            userId: context?.userId,
            organizationId: context?.organizationId,
            module: context?.module
        };

        if (level === 'error') {
            await this.fileLogger.writeErrorLog({ ...entry, stack });
        } else {
            await this.fileLogger.writeLog(entry);
        }
    }

    log(message: any, context?: any): void {
        // Handle NestJS internal logging which might pass different types
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        const contextObj = typeof context === 'string' ? { context } : context;

        // Filter out noisy NestJS internal logs in development
        if (this.shouldFilterInternalLog(messageStr, contextObj)) {
            return;
        }

        const formattedMessage = this.formatMessage('info', messageStr, contextObj);
        console.log(formattedMessage);
        
        // Write to file if enabled
        this.writeToFile('info', messageStr, contextObj);
    }

    error(message: any, trace?: any, context?: any): void {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        const traceStr = typeof trace === 'string' ? trace : undefined;
        const contextObj = typeof context === 'string' ? { context } : context;

        const errorContext = {
            ...(contextObj || {}),
            ...(traceStr && { trace: traceStr }),
        };
        
        const formattedMessage = this.formatMessage('error', messageStr, errorContext);
        console.error(formattedMessage);
        
        // Write to file if enabled
        this.writeToFile('error', messageStr, errorContext, traceStr);
    }

    warn(message: any, context?: any): void {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        const contextObj = typeof context === 'string' ? { context } : context;

        const formattedMessage = this.formatMessage('warn', messageStr, contextObj);
        console.warn(formattedMessage);
        
        // Write to file if enabled
        this.writeToFile('warn', messageStr, contextObj);
    }

    debug(message: any, context?: any): void {
        if (this.configService.isDevelopment || this.configService.logLevel === 'debug') {
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            const contextObj = typeof context === 'string' ? { context } : context;

            const formattedMessage = this.formatMessage('debug', messageStr, contextObj);
            console.debug(formattedMessage);
            
            // Write to file if enabled
            this.writeToFile('debug', messageStr, contextObj);
        }
    }

    verbose(message: any, context?: any): void {
        if (this.configService.isDevelopment || this.configService.logLevel === 'verbose') {
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            const contextObj = typeof context === 'string' ? { context } : context;

            const formattedMessage = this.formatMessage('verbose', messageStr, contextObj);
            console.log(formattedMessage);
            
            // Write to file if enabled
            this.writeToFile('verbose', messageStr, contextObj);
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
