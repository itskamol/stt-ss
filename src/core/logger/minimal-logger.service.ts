import { LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

/**
 * Minimal logger for NestJS internal use
 * Filters out noisy startup logs while keeping important ones
 */
export class MinimalLoggerService implements NestLoggerService {
    constructor(private readonly configService: ConfigService) {}

    log(message: any, context?: string): void {
        if (this.shouldLog(message, context)) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] INFO: ${message}${context ? ` [${context}]` : ''}`);
        }
    }

    error(message: any, trace?: string, context?: string): void {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ERROR: ${message}${context ? ` [${context}]` : ''}`);
        if (trace) {
            console.error(trace);
        }
    }

    warn(message: any, context?: string): void {
        if (this.shouldLog(message, context)) {
            const timestamp = new Date().toISOString();
            console.warn(`[${timestamp}] WARN: ${message}${context ? ` [${context}]` : ''}`);
        }
    }

    debug(message: any, context?: string): void {
        if (this.configService.isDevelopment && this.shouldLog(message, context)) {
            const timestamp = new Date().toISOString();
            console.debug(`[${timestamp}] DEBUG: ${message}${context ? ` [${context}]` : ''}`);
        }
    }

    verbose(message: any, context?: string): void {
        // Suppress verbose logs during startup
    }

    private shouldLog(message: any, context?: string): boolean {
        // If suppression is disabled, log everything
        if (!this.configService.suppressNestLogs) {
            return true;
        }

        const messageStr = typeof message === 'string' ? message : String(message);
        
        // Always log important messages
        const importantPatterns = [
            'Nest application successfully started',
            'Application started successfully',
            'Error',
            'Failed',
            'Exception',
            'Warning',
            'WARN'
        ];

        if (importantPatterns.some(pattern => messageStr.includes(pattern))) {
            return true;
        }

        // Filter out noisy startup logs
        const noisyPatterns = [
            'dependencies initialized',
            'Mapped {',
            'InstanceLoader',
            'RoutesResolver',
            'RouterExplorer',
            'Starting Nest application',
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
            'CacheModule',
            'HikvisionAuthModule',
            'DepartmentModule',
            'EmployeeModule',
            'AttendanceModule',
            'BranchModule',
            'HealthModule',
            'UserModule',
            'OrganizationModule',
            'DeviceModule',
            'AppModule',
            'QueueModule',
            'AuthModule',
            'GuestModule',
            'EventModule',
            'Controller {',
            'Unsupported route path'
        ];

        const contextStr = context || '';
        
        return !noisyPatterns.some(pattern => 
            messageStr.includes(pattern) || contextStr.includes(pattern)
        );
    }
}