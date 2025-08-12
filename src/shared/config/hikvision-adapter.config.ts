import crypto from 'crypto'
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsPositive, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class HikvisionEncryptionConfig {
    @IsString()
    @IsOptional()
    secretEncryptionKey?: string;

    @IsString()
    @IsOptional()
    secretEncryptionIv?: string;
}

export class HikvisionHttpConfig {
    @IsNumber()
    @IsPositive()
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    timeout?: number = 10000;

    @IsNumber()
    @IsPositive()
    @Min(1)
    @Max(10)
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    maxRetries?: number = 3;

    @IsNumber()
    @IsPositive()
    @Min(100)
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    retryDelay?: number = 1000;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    enableKeepAlive?: boolean = true;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    maxSockets?: number = 100;
}

export class HikvisionCacheConfig {
    @IsNumber()
    @IsPositive()
    @Min(60)
    @Max(3600)
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    sessionTtl?: number = 600; // 10 minutes

    @IsNumber()
    @IsPositive()
    @Min(10)
    @Max(10000)
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    maxSessions?: number = 1000;

    @IsNumber()
    @IsPositive()
    @Min(60)
    @Max(86400)
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    deviceInfoTtl?: number = 3600; // 1 hour

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    enableCompression?: boolean = false;
}

export class HikvisionDiscoveryConfig {
    @IsNumber()
    @IsPositive()
    @Min(1000)
    @Max(30000)
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    discoveryTimeout?: number = 10000;

    @IsNumber()
    @IsPositive()
    @Min(1)
    @Max(100)
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    maxConcurrentScans?: number = 20;

    @IsString()
    @IsOptional()
    defaultNetworkRange?: string = '192.168.1.0/24';

    @IsString()
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map((p: string) => parseInt(p.trim(), 10)) : [80, 8000, 8080])
    defaultPorts?: number[] = [80, 8000, 8080];

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    enableUpnpDiscovery?: boolean = true;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    enableBroadcastDiscovery?: boolean = true;
}

export class HikvisionEventConfig {
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    useWebSocket?: boolean = true;

    @IsNumber()
    @IsPositive()
    @Min(1000)
    @Max(60000)
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    pollingInterval?: number = 5000;

    @IsNumber()
    @IsPositive()
    @Min(1)
    @Max(10)
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    maxReconnectAttempts?: number = 5;

    @IsNumber()
    @IsPositive()
    @Min(1000)
    @Max(30000)
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    reconnectDelay?: number = 2000;

    @IsString()
    @IsOptional()
    @Transform(({ value }) => value ? value.split(',').map((t: string) => t.trim()) : ['access_granted', 'access_denied', 'door_opened', 'door_closed'])
    defaultEventTypes?: string[] = ['access_granted', 'access_denied', 'door_opened', 'door_closed'];
}

export class HikvisionMaintenanceConfig {
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    enableAutomaticBackup?: boolean = true;

    @IsNumber()
    @IsPositive()
    @Min(1)
    @Max(365)
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    logRetentionDays?: number = 30;

    @IsNumber()
    @IsPositive()
    @Min(1)
    @Max(24)
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    healthCheckIntervalHours?: number = 6;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    enableFirmwareUpdateNotifications?: boolean = true;

    @IsString()
    @IsOptional()
    maintenanceWindow?: string = '02:00-04:00'; // 2 AM to 4 AM
}

export class HikvisionAdapterConfig {
    @IsEnum(['hikvision', 'stub', 'auto'])
    @IsOptional()
    deviceAdapterType?: 'hikvision' | 'stub' | 'auto' = 'auto';

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    useStubAdapter?: boolean = false;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    enableHealthChecks?: boolean = true;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    enableMetrics?: boolean = true;

    @IsString()
    @IsOptional()
    logLevel?: string = 'info';

    @ValidateNested()
    @Type(() => HikvisionEncryptionConfig)
    @IsOptional()
    encryption?: HikvisionEncryptionConfig = new HikvisionEncryptionConfig();

    @ValidateNested()
    @Type(() => HikvisionHttpConfig)
    @IsOptional()
    http?: HikvisionHttpConfig = new HikvisionHttpConfig();

    @ValidateNested()
    @Type(() => HikvisionCacheConfig)
    @IsOptional()
    cache?: HikvisionCacheConfig = new HikvisionCacheConfig();

    @ValidateNested()
    @Type(() => HikvisionDiscoveryConfig)
    @IsOptional()
    discovery?: HikvisionDiscoveryConfig = new HikvisionDiscoveryConfig();

    @ValidateNested()
    @Type(() => HikvisionEventConfig)
    @IsOptional()
    events?: HikvisionEventConfig = new HikvisionEventConfig();

    @ValidateNested()
    @Type(() => HikvisionMaintenanceConfig)
    @IsOptional()
    maintenance?: HikvisionMaintenanceConfig = new HikvisionMaintenanceConfig();
}

/**
 * Environment variable mappings for Hikvision adapter configuration
 */
export const HIKVISION_ENV_MAPPINGS = {
    // Adapter settings
    DEVICE_ADAPTER_TYPE: 'deviceAdapterType',
    USE_STUB_ADAPTER: 'useStubAdapter',
    ENABLE_HEALTH_CHECKS: 'enableHealthChecks',
    ENABLE_METRICS: 'enableMetrics',
    LOG_LEVEL: 'logLevel',

    // Encryption settings
    SECRET_ENCRYPTION_KEY: 'encryption.secretEncryptionKey',
    SECRET_ENCRYPTION_IV: 'encryption.secretEncryptionIv',

    // HTTP settings
    HIKVISION_HTTP_TIMEOUT: 'http.timeout',
    HIKVISION_MAX_RETRIES: 'http.maxRetries',
    HIKVISION_RETRY_DELAY: 'http.retryDelay',
    HIKVISION_ENABLE_KEEP_ALIVE: 'http.enableKeepAlive',
    HIKVISION_MAX_SOCKETS: 'http.maxSockets',

    // Cache settings
    HIKVISION_SESSION_TTL: 'cache.sessionTtl',
    HIKVISION_MAX_SESSIONS: 'cache.maxSessions',
    HIKVISION_DEVICE_INFO_TTL: 'cache.deviceInfoTtl',
    HIKVISION_ENABLE_COMPRESSION: 'cache.enableCompression',

    // Discovery settings
    HIKVISION_DISCOVERY_TIMEOUT: 'discovery.discoveryTimeout',
    HIKVISION_MAX_CONCURRENT_SCANS: 'discovery.maxConcurrentScans',
    HIKVISION_DEFAULT_NETWORK_RANGE: 'discovery.defaultNetworkRange',
    HIKVISION_DEFAULT_PORTS: 'discovery.defaultPorts',
    HIKVISION_ENABLE_UPNP_DISCOVERY: 'discovery.enableUpnpDiscovery',
    HIKVISION_ENABLE_BROADCAST_DISCOVERY: 'discovery.enableBroadcastDiscovery',

    // Event settings
    HIKVISION_USE_WEBSOCKET: 'events.useWebSocket',
    HIKVISION_POLLING_INTERVAL: 'events.pollingInterval',
    HIKVISION_MAX_RECONNECT_ATTEMPTS: 'events.maxReconnectAttempts',
    HIKVISION_RECONNECT_DELAY: 'events.reconnectDelay',
    HIKVISION_DEFAULT_EVENT_TYPES: 'events.defaultEventTypes',

    // Maintenance settings
    HIKVISION_ENABLE_AUTOMATIC_BACKUP: 'maintenance.enableAutomaticBackup',
    HIKVISION_LOG_RETENTION_DAYS: 'maintenance.logRetentionDays',
    HIKVISION_HEALTH_CHECK_INTERVAL_HOURS: 'maintenance.healthCheckIntervalHours',
    HIKVISION_ENABLE_FIRMWARE_UPDATE_NOTIFICATIONS: 'maintenance.enableFirmwareUpdateNotifications',
    HIKVISION_MAINTENANCE_WINDOW: 'maintenance.maintenanceWindow',
} as const;

/**
 * Default configuration values
 */
export const HIKVISION_DEFAULT_CONFIG: HikvisionAdapterConfig = {
    deviceAdapterType: 'auto',
    useStubAdapter: false,
    enableHealthChecks: true,
    enableMetrics: true,
    logLevel: 'info',
    encryption: {
        secretEncryptionKey: undefined,
        secretEncryptionIv: undefined,
    },
    http: {
        timeout: 10000,
        maxRetries: 3,
        retryDelay: 1000,
        enableKeepAlive: true,
        maxSockets: 100,
    },
    cache: {
        sessionTtl: 600,
        maxSessions: 1000,
        deviceInfoTtl: 3600,
        enableCompression: false,
    },
    discovery: {
        discoveryTimeout: 10000,
        maxConcurrentScans: 20,
        defaultNetworkRange: '192.168.1.0/24',
        defaultPorts: [80, 8000, 8080],
        enableUpnpDiscovery: true,
        enableBroadcastDiscovery: true,
    },
    events: {
        useWebSocket: true,
        pollingInterval: 5000,
        maxReconnectAttempts: 5,
        reconnectDelay: 2000,
        defaultEventTypes: ['access_granted', 'access_denied', 'door_opened', 'door_closed'],
    },
    maintenance: {
        enableAutomaticBackup: true,
        logRetentionDays: 30,
        healthCheckIntervalHours: 6,
        enableFirmwareUpdateNotifications: true,
        maintenanceWindow: '02:00-04:00',
    },
};

/**
 * Required environment variables for production
 */
export const REQUIRED_ENV_VARS = [
    'SECRET_ENCRYPTION_KEY',
    'SECRET_ENCRYPTION_IV',
] as const;

/**
 * Validate required environment variables
 */
export function validateRequiredEnvVars(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    for (const envVar of REQUIRED_ENV_VARS) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    }

    return {
        valid: missing.length === 0,
        missing,
    };
}

/**
 * Generate encryption keys for development
 */
export function generateEncryptionKeys(): { key: string; iv: string } {
    return {
        key: crypto.randomBytes(32).toString('hex'),
        iv: crypto.randomBytes(16).toString('hex'),
    };
}

/**
 * Get configuration from environment variables
 */
export function getConfigFromEnv(): Partial<HikvisionAdapterConfig> {
    const config: any = {};

    for (const [envVar, configPath] of Object.entries(HIKVISION_ENV_MAPPINGS)) {
        const value = process.env[envVar];
        if (value !== undefined) {
            setNestedProperty(config, configPath, value);
        }
    }

    return config;
}

/**
 * Set nested property in object using dot notation
 */
function setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current)) {
            current[key] = {};
        }
        current = current[key];
    }

    current[keys[keys.length - 1]] = value;
}