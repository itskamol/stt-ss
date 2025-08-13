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

export interface LogContext {
    correlationId?: string;
    userId?: string;
    organizationId?: string;
    module?: string;
    method?: string;
    [key: string]: any;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';