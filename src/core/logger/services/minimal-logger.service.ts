import { LoggerService as NestLoggerService } from '@nestjs/common';
import { LogFormatter } from '../utils/log-formatter.util';

/**
 * Minimal logger NestJS internal use uchun
 * Faqat muhim startup loglarni ko'rsatadi
 */
export class MinimalLoggerService implements NestLoggerService {
    private readonly enableDebug: boolean;

    constructor(enableDebug: boolean = false) {
        this.enableDebug = enableDebug;
    }

    log(message: any, context?: string): void {
        if (LogFormatter.shouldLog(message, context)) {
            const timestamp = LogFormatter.formatTimestamp();
            console.log(`[${timestamp}] INFO: ${message}${context ? ` [${context}]` : ''}`);
        }
    }

    error(message: any, trace?: string, context?: string): void {
        const timestamp = LogFormatter.formatTimestamp();
        console.error(`[${timestamp}] ERROR: ${message}${context ? ` [${context}]` : ''}`);
        if (trace) {
            console.error(trace);
        }
    }

    warn(message: any, context?: string): void {
        if (LogFormatter.shouldLog(message, context)) {
            const timestamp = LogFormatter.formatTimestamp();
            console.warn(`[${timestamp}] WARN: ${message}${context ? ` [${context}]` : ''}`);
        }
    }

    debug(message: any, context?: string): void {
        if (this.enableDebug && LogFormatter.shouldLog(message, context)) {
            const timestamp = LogFormatter.formatTimestamp();
            console.debug(`[${timestamp}] DEBUG: ${message}${context ? ` [${context}]` : ''}`);
        }
    }

    verbose(message: any, context?: string): void {
        if (this.enableDebug && LogFormatter.shouldLog(message, context)) {
            const timestamp = LogFormatter.formatTimestamp();
            console.log(`[${timestamp}] VERBOSE: ${message}${context ? ` [${context}]` : ''}`);
        }
    }
}
