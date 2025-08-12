import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

import {
    HikvisionAdapterConfig,
    HIKVISION_DEFAULT_CONFIG,
    REQUIRED_ENV_VARS,
    validateRequiredEnvVars,
    getConfigFromEnv,
    generateEncryptionKeys,
} from '../config/hikvision-adapter.config';

export interface ConfigValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    config: HikvisionAdapterConfig;
    missingRequired: string[];
    suggestions: string[];
}

export interface ConfigHealthCheck {
    encryption: {
        configured: boolean;
        keysGenerated: boolean;
        keyLength: number;
        ivLength: number;
    };
    http: {
        timeoutReasonable: boolean;
        retriesReasonable: boolean;
    };
    cache: {
        ttlReasonable: boolean;
        maxSessionsReasonable: boolean;
    };
    discovery: {
        timeoutReasonable: boolean;
        concurrencyReasonable: boolean;
        networkRangeValid: boolean;
    };
    events: {
        intervalReasonable: boolean;
        reconnectAttemptsReasonable: boolean;
    };
    maintenance: {
        retentionReasonable: boolean;
        healthCheckIntervalReasonable: boolean;
        maintenanceWindowValid: boolean;
    };
}

@Injectable()
export class HikvisionConfigValidationService {
    private readonly logger = new Logger(HikvisionConfigValidationService.name);

    constructor(private readonly configService: ConfigService) {}

    /**
     * Validate complete Hikvision adapter configuration
     */
    async validateConfiguration(): Promise<ConfigValidationResult> {
        this.logger.log('Validating Hikvision adapter configuration');

        const result: ConfigValidationResult = {
            valid: true,
            errors: [],
            warnings: [],
            config: HIKVISION_DEFAULT_CONFIG,
            missingRequired: [],
            suggestions: [],
        };

        try {
            // Check required environment variables
            const requiredCheck = validateRequiredEnvVars();
            result.missingRequired = requiredCheck.missing;

            if (!requiredCheck.valid) {
                result.valid = false;
                result.errors.push(`Missing required environment variables: ${requiredCheck.missing.join(', ')}`);
            }

            // Get configuration from environment
            const envConfig = getConfigFromEnv();
            const mergedConfig = this.mergeConfigs(HIKVISION_DEFAULT_CONFIG, envConfig);

            // Validate configuration object
            const configInstance = plainToClass(HikvisionAdapterConfig, mergedConfig);
            const validationErrors = await validate(configInstance);

            if (validationErrors.length > 0) {
                result.valid = false;
                result.errors.push(...this.formatValidationErrors(validationErrors));
            }

            result.config = configInstance;

            // Perform health checks
            const healthCheck = this.performConfigHealthCheck(configInstance);
            this.addHealthCheckWarnings(healthCheck, result);

            // Generate suggestions
            result.suggestions = this.generateConfigSuggestions(configInstance, healthCheck);

            this.logger.log('Configuration validation completed', {
                valid: result.valid,
                errorCount: result.errors.length,
                warningCount: result.warnings.length,
            });

        } catch (error) {
            result.valid = false;
            result.errors.push(`Configuration validation failed: ${error.message}`);
            this.logger.error('Configuration validation error', { error: error.message });
        }

        return result;
    }

    /**
     * Generate development configuration with encryption keys
     */
    generateDevelopmentConfig(): { config: HikvisionAdapterConfig; envVars: Record<string, string> } {
        this.logger.log('Generating development configuration');

        const encryptionKeys = generateEncryptionKeys();
        
        const config: HikvisionAdapterConfig = {
            ...HIKVISION_DEFAULT_CONFIG,
            deviceAdapterType: 'stub',
            useStubAdapter: true,
            enableHealthChecks: true,
            enableMetrics: false,
            logLevel: 'debug',
            encryption: {
                secretEncryptionKey: encryptionKeys.key,
                secretEncryptionIv: encryptionKeys.iv,
            },
            http: {
                ...HIKVISION_DEFAULT_CONFIG.http,
                timeout: 5000, // Shorter timeout for development
            },
            cache: {
                ...HIKVISION_DEFAULT_CONFIG.cache,
                sessionTtl: 300, // Shorter TTL for development
                maxSessions: 100,
            },
            discovery: {
                ...HIKVISION_DEFAULT_CONFIG.discovery,
                discoveryTimeout: 5000,
                maxConcurrentScans: 5,
            },
        };

        const envVars = {
            DEVICE_ADAPTER_TYPE: 'stub',
            USE_STUB_ADAPTER: 'true',
            SECRET_ENCRYPTION_KEY: encryptionKeys.key,
            SECRET_ENCRYPTION_IV: encryptionKeys.iv,
            LOG_LEVEL: 'debug',
            HIKVISION_HTTP_TIMEOUT: '5000',
            HIKVISION_SESSION_TTL: '300',
            HIKVISION_MAX_SESSIONS: '100',
            HIKVISION_DISCOVERY_TIMEOUT: '5000',
            HIKVISION_MAX_CONCURRENT_SCANS: '5',
        };

        return { config, envVars };
    }

    /**
     * Generate production configuration template
     */
    generateProductionConfigTemplate(): Record<string, string> {
        const encryptionKeys = generateEncryptionKeys();

        return {
            // Required
            SECRET_ENCRYPTION_KEY: encryptionKeys.key,
            SECRET_ENCRYPTION_IV: encryptionKeys.iv,

            // Adapter settings
            DEVICE_ADAPTER_TYPE: 'hikvision',
            USE_STUB_ADAPTER: 'false',
            ENABLE_HEALTH_CHECKS: 'true',
            ENABLE_METRICS: 'true',
            LOG_LEVEL: 'info',

            // HTTP settings
            HIKVISION_HTTP_TIMEOUT: '10000',
            HIKVISION_MAX_RETRIES: '3',
            HIKVISION_RETRY_DELAY: '1000',

            // Cache settings
            HIKVISION_SESSION_TTL: '600',
            HIKVISION_MAX_SESSIONS: '1000',
            HIKVISION_DEVICE_INFO_TTL: '3600',

            // Discovery settings
            HIKVISION_DISCOVERY_TIMEOUT: '10000',
            HIKVISION_MAX_CONCURRENT_SCANS: '20',
            HIKVISION_DEFAULT_NETWORK_RANGE: '192.168.1.0/24',

            // Event settings
            HIKVISION_USE_WEBSOCKET: 'true',
            HIKVISION_POLLING_INTERVAL: '5000',
            HIKVISION_MAX_RECONNECT_ATTEMPTS: '5',

            // Maintenance settings
            HIKVISION_ENABLE_AUTOMATIC_BACKUP: 'true',
            HIKVISION_LOG_RETENTION_DAYS: '30',
            HIKVISION_HEALTH_CHECK_INTERVAL_HOURS: '6',
        };
    }

    /**
     * Check if current configuration is suitable for production
     */
    isProductionReady(): { ready: boolean; issues: string[] } {
        const issues: string[] = [];

        // Check required environment variables
        const requiredCheck = validateRequiredEnvVars();
        if (!requiredCheck.valid) {
            issues.push(`Missing required environment variables: ${requiredCheck.missing.join(', ')}`);
        }

        // Check adapter type
        const adapterType = this.configService.get<string>('DEVICE_ADAPTER_TYPE', 'auto');
        if (adapterType === 'stub') {
            issues.push('Using stub adapter in production is not recommended');
        }

        // Check encryption keys
        const encryptionKey = this.configService.get<string>('SECRET_ENCRYPTION_KEY');
        const encryptionIv = this.configService.get<string>('SECRET_ENCRYPTION_IV');

        if (!encryptionKey || encryptionKey.length < 64) {
            issues.push('Encryption key is missing or too short (should be 64 hex characters)');
        }

        if (!encryptionIv || encryptionIv.length < 32) {
            issues.push('Encryption IV is missing or too short (should be 32 hex characters)');
        }

        // Check log level
        const logLevel = this.configService.get<string>('LOG_LEVEL', 'info');
        if (logLevel === 'debug') {
            issues.push('Debug log level should not be used in production');
        }

        return {
            ready: issues.length === 0,
            issues,
        };
    }

    // ==================== Private Methods ====================

    private mergeConfigs(defaultConfig: HikvisionAdapterConfig, envConfig: any): HikvisionAdapterConfig {
        return this.deepMerge(defaultConfig, envConfig);
    }

    private deepMerge(target: any, source: any): any {
        const result = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    private formatValidationErrors(errors: ValidationError[]): string[] {
        const formatted: string[] = [];

        for (const error of errors) {
            if (error.constraints) {
                for (const constraint of Object.values(error.constraints)) {
                    formatted.push(`${error.property}: ${constraint}`);
                }
            }

            if (error.children && error.children.length > 0) {
                formatted.push(...this.formatValidationErrors(error.children));
            }
        }

        return formatted;
    }

    private performConfigHealthCheck(config: HikvisionAdapterConfig): ConfigHealthCheck {
        return {
            encryption: {
                configured: !!(config.encryption?.secretEncryptionKey && config.encryption?.secretEncryptionIv),
                keysGenerated: !!(config.encryption?.secretEncryptionKey && config.encryption?.secretEncryptionIv),
                keyLength: config.encryption?.secretEncryptionKey?.length || 0,
                ivLength: config.encryption?.secretEncryptionIv?.length || 0,
            },
            http: {
                timeoutReasonable: (config.http?.timeout || 0) >= 5000 && (config.http?.timeout || 0) <= 30000,
                retriesReasonable: (config.http?.maxRetries || 0) >= 1 && (config.http?.maxRetries || 0) <= 5,
            },
            cache: {
                ttlReasonable: (config.cache?.sessionTtl || 0) >= 300 && (config.cache?.sessionTtl || 0) <= 1800,
                maxSessionsReasonable: (config.cache?.maxSessions || 0) >= 100 && (config.cache?.maxSessions || 0) <= 5000,
            },
            discovery: {
                timeoutReasonable: (config.discovery?.discoveryTimeout || 0) >= 5000 && (config.discovery?.discoveryTimeout || 0) <= 30000,
                concurrencyReasonable: (config.discovery?.maxConcurrentScans || 0) >= 5 && (config.discovery?.maxConcurrentScans || 0) <= 50,
                networkRangeValid: this.isValidNetworkRange(config.discovery?.defaultNetworkRange || ''),
            },
            events: {
                intervalReasonable: (config.events?.pollingInterval || 0) >= 1000 && (config.events?.pollingInterval || 0) <= 30000,
                reconnectAttemptsReasonable: (config.events?.maxReconnectAttempts || 0) >= 3 && (config.events?.maxReconnectAttempts || 0) <= 10,
            },
            maintenance: {
                retentionReasonable: (config.maintenance?.logRetentionDays || 0) >= 7 && (config.maintenance?.logRetentionDays || 0) <= 90,
                healthCheckIntervalReasonable: (config.maintenance?.healthCheckIntervalHours || 0) >= 1 && (config.maintenance?.healthCheckIntervalHours || 0) <= 24,
                maintenanceWindowValid: this.isValidMaintenanceWindow(config.maintenance?.maintenanceWindow || ''),
            },
        };
    }

    private addHealthCheckWarnings(healthCheck: ConfigHealthCheck, result: ConfigValidationResult): void {
        if (!healthCheck.encryption.configured) {
            result.warnings.push('Encryption keys are not configured');
        }

        if (healthCheck.encryption.keyLength > 0 && healthCheck.encryption.keyLength !== 64) {
            result.warnings.push('Encryption key should be 64 hex characters (32 bytes)');
        }

        if (healthCheck.encryption.ivLength > 0 && healthCheck.encryption.ivLength !== 32) {
            result.warnings.push('Encryption IV should be 32 hex characters (16 bytes)');
        }

        if (!healthCheck.http.timeoutReasonable) {
            result.warnings.push('HTTP timeout should be between 5-30 seconds');
        }

        if (!healthCheck.cache.ttlReasonable) {
            result.warnings.push('Session TTL should be between 5-30 minutes');
        }

        if (!healthCheck.discovery.networkRangeValid) {
            result.warnings.push('Invalid network range format');
        }

        if (!healthCheck.maintenance.maintenanceWindowValid) {
            result.warnings.push('Invalid maintenance window format (should be HH:mm-HH:mm)');
        }
    }

    private generateConfigSuggestions(config: HikvisionAdapterConfig, healthCheck: ConfigHealthCheck): string[] {
        const suggestions: string[] = [];

        if (config.deviceAdapterType === 'auto') {
            suggestions.push('Consider setting explicit adapter type for production');
        }

        if (config.http?.timeout && config.http.timeout < 10000) {
            suggestions.push('Consider increasing HTTP timeout for production environments');
        }

        if (config.cache?.sessionTtl && config.cache.sessionTtl < 600) {
            suggestions.push('Consider increasing session TTL to reduce authentication overhead');
        }

        if (config.events?.useWebSocket === false) {
            suggestions.push('WebSocket events provide better real-time performance than polling');
        }

        if (!config.maintenance?.enableAutomaticBackup) {
            suggestions.push('Enable automatic backup for better device configuration management');
        }

        return suggestions;
    }

    private isValidNetworkRange(range: string): boolean {
        const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
        return cidrRegex.test(range);
    }

    private isValidMaintenanceWindow(window: string): boolean {
        const windowRegex = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
        return windowRegex.test(window);
    }
}