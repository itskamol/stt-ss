import * as chalk from 'chalk';
import { LogLevel, LogFormatterOptions, LogContext } from '../interfaces/log-entry.interface';

export class LogFormatter {
    static formatTimestamp(date?: Date): string {
        const timestamp = date || new Date();
        return timestamp.toISOString();
    }

    static formatToJson(level: LogLevel, message: string, context?: LogContext): string {
        return JSON.stringify({
            timestamp: this.formatTimestamp(),
            level: level.toUpperCase(),
            message,
            ...context
        });
    }

    static formatPretty(level: LogLevel, message: string, context?: LogContext, options?: LogFormatterOptions): string {
        const timestamp = this.formatTimestamp();
        const time = options?.colorize ? chalk.gray(`[${timestamp}]`) : `[${timestamp}]`;
        
        let levelStr = level.toUpperCase();
        
        if (options?.colorize) {
            switch (level.toLowerCase()) {
                case 'error':
                    levelStr = chalk.red.bold('ERROR');
                    break;
                case 'warn':
                    levelStr = chalk.yellow.bold('WARN');
                    break;
                case 'info':
                    levelStr = chalk.green('INFO');
                    break;
                case 'debug':
                    levelStr = chalk.blue('DEBUG');
                    break;
                case 'verbose':
                    levelStr = chalk.magenta('VERBOSE');
                    break;
            }
        }

        let formattedMessage = `${time} [${levelStr}] ${message}`;

        if (options?.includeContext && context) {
            const contextStr = Object.entries(context)
                .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
                .join(' ');
            formattedMessage += ` ${chalk.cyan(`[${contextStr}]`)}`;
        }

        return formattedMessage;
    }

    static shouldLog(message: any, context?: string): boolean {
        const messageStr = typeof message === 'string' ? message : String(message);

        // Muhim loglarni aniqlash
        const importantPatterns = [
            'Starting Nest application',
            'Nest application successfully started',
            'Environment configuration validated',
            'Application started successfully',
            'Database connected successfully',
            'Redis connected successfully',
            'Application is running',
            'ERROR',
            'error'
        ];

        return importantPatterns.some(pattern => 
            messageStr.toLowerCase().includes(pattern.toLowerCase())
        );
    }
}
