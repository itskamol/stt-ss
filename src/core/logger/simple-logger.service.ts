import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as chalk from 'chalk';

@Injectable()
export class SimpleLoggerService implements NestLoggerService {
    private formatTimestamp(): string {
        return new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    log(message: any, context?: string): void {
        const timestamp = chalk.gray(`[${this.formatTimestamp()}]`);
        const level = chalk.blue.bold('INFO');
        const ctx = context ? chalk.green(`[${context}]`) : '';
        console.log(`${timestamp} ${level} ${message} ${ctx}`);
    }

    error(message: any, trace?: string, context?: string): void {
        const timestamp = chalk.gray(`[${this.formatTimestamp()}]`);
        const level = chalk.red.bold('ERROR');
        const ctx = context ? chalk.green(`[${context}]`) : '';
        console.error(`${timestamp} ${level} ${message} ${ctx}`);
        if (trace) {
            console.error(chalk.red(trace));
        }
    }

    warn(message: any, context?: string): void {
        const timestamp = chalk.gray(`[${this.formatTimestamp()}]`);
        const level = chalk.yellow.bold('WARN');
        const ctx = context ? chalk.green(`[${context}]`) : '';
        console.warn(`${timestamp} ${level} ${message} ${ctx}`);
    }

    debug(message: any, context?: string): void {
        const timestamp = chalk.gray(`[${this.formatTimestamp()}]`);
        const level = chalk.magenta.bold('DEBUG');
        const ctx = context ? chalk.green(`[${context}]`) : '';
        console.debug(`${timestamp} ${level} ${message} ${ctx}`);
    }

    verbose(message: any, context?: string): void {
        const timestamp = chalk.gray(`[${this.formatTimestamp()}]`);
        const level = chalk.cyan.bold('VERBOSE');
        const ctx = context ? chalk.green(`[${context}]`) : '';
        console.log(`${timestamp} ${level} ${message} ${ctx}`);
    }
}
