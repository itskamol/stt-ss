import { format, transports } from 'winston';
import { WinstonModuleOptions } from 'nest-winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, json, colorize, printf, errors } = format;

// Environment variables
const nodeEnv = process.env.NODE_ENV || 'development';
const logLevel = process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'warn' : 'debug');
const enableFileLogging = process.env.ENABLE_FILE_LOGGING !== 'false';

const isProduction = nodeEnv === 'production';

// Development console format
const devFormat = combine(
    colorize({ all: true }),
    timestamp({ format: 'HH:mm:ss' }),
    printf(({ level, message, timestamp, context }) => {
        const ctx = context as any;
        const contextStr = ctx?.module ? ` [${ctx.module}]` : '';
        const correlationId = ctx?.correlationId ? ` (${ctx.correlationId.slice(0, 8)})` : '';
        return `${timestamp}${contextStr} ${level}:${correlationId} ${message}`;
    })
);

// Production JSON format with sensitive data filtering
const prodFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json({
        replacer: (key, value) => {
            if (typeof key === 'string' && /password|token|secret|key/i.test(key)) {
                return '[REDACTED]';
            }
            return value;
        }
    })
);

// Common DailyRotateFile configuration
const rotateFileConfig = {
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    format: prodFormat,
};

// Create transports
const createTransports = (): transports.ConsoleTransportInstance[] => {
    const transportsList: any[] = [
        // Console (always enabled)
        new transports.Console({
            level: logLevel,
            format: isProduction ? prodFormat : devFormat,
            handleExceptions: !enableFileLogging, // Only handle in console if no file logging
            handleRejections: !enableFileLogging,
        }),
    ];

    if (enableFileLogging) {
        // Combined logs
        transportsList.push(
            new (DailyRotateFile as any)({
                ...rotateFileConfig,
                filename: 'logs/combined-%DATE%.log',
                level: 'info',
                maxSize: '50m',
                maxFiles: '30d',
                auditFile: 'logs/.audit-combined.json',
            })
        );

        // Error logs only
        transportsList.push(
            new (DailyRotateFile as any)({
                ...rotateFileConfig,
                filename: 'logs/error-%DATE%.log',
                level: 'error',
                maxSize: '20m',
                maxFiles: '30d',
                auditFile: 'logs/.audit-error.json',
                handleExceptions: true,
                handleRejections: true,
            })
        );
    }

    return transportsList;
};

export const winstonConfig: WinstonModuleOptions = {
    level: logLevel,
    transports: createTransports(),
    exitOnError: false,
    defaultMeta: {
        service: 'sector-staff-v2',
        environment: nodeEnv,
    },
    
    // Only add exception/rejection handlers if file logging is enabled
    ...(enableFileLogging && {
        exceptionHandlers: [
            new (DailyRotateFile as any)({
                ...rotateFileConfig,
                filename: 'logs/exceptions-%DATE%.log',
                maxSize: '20m',
                maxFiles: '14d',
            }),
        ],
        rejectionHandlers: [
            new (DailyRotateFile as any)({
                ...rotateFileConfig,
                filename: 'logs/rejections-%DATE%.log',
                maxSize: '20m',
                maxFiles: '14d',
            }),
        ],
    }),
};
