import { transports, format } from 'winston';
import { WinstonModuleOptions } from 'nest-winston';

const { combine, timestamp, json, colorize, label, printf } = format;

const isProduction = process.env.NODE_ENV === 'production';

// Custom format for development console logs
const prettyFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

export const winstonConfig: WinstonModuleOptions = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
  },
  transports: [
    // Console transport
    new transports.Console({
      level: isProduction ? 'info' : 'debug',
      format: isProduction
        ? combine(timestamp(), json())
        : combine(
            colorize(),
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            label({ label: 'Main' }),
            prettyFormat,
          ),
    }),
    // File transport for all logs
    new transports.File({
      filename: 'logs/combined.log',
      level: 'info',
      format: combine(timestamp(), json()),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for error logs
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp(), json()),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exitOnError: false, // Do not exit on handled exceptions
};
