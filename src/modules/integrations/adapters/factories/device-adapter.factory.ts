import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IDeviceAdapter } from '../interfaces';
import { HikvisionAdapter, StubDeviceAdapter } from '../implementations';
import { LoggerService } from '@/core/logger';

export type AdapterType = 'hikvision' | 'stub' | 'zkteco' | 'dahua';

export interface AdapterHealthStatus {
    type: AdapterType;
    healthy: boolean;
    lastCheck: Date;
    error?: string;
    responseTime?: number;
}

@Injectable()
export class DeviceAdapterFactory {
    private readonly adapterHealthStatus = new Map<AdapterType, AdapterHealthStatus>();

    constructor(
        private readonly logger: LoggerService,
        private readonly configService: ConfigService,
        private readonly hikvisionAdapter: HikvisionAdapter,
        private readonly stubAdapter: StubDeviceAdapter
    ) {}

    /**
     * Create device adapter based on type
     */
    createAdapter(type: AdapterType): IDeviceAdapter {
        this.logger.log('Creating device adapter', { type });

        switch (type) {
            case 'hikvision':
                return this.hikvisionAdapter;

            case 'stub':
                return this.stubAdapter;

            case 'zkteco':
                // Future implementation
                this.logger.warn('ZKTeco adapter not implemented, falling back to stub');
                return this.stubAdapter;

            case 'dahua':
                // Future implementation
                this.logger.warn('Dahua adapter not implemented, falling back to stub');
                return this.stubAdapter;

            default:
                this.logger.warn('Unknown adapter type, falling back to stub', { type });
                return this.stubAdapter;
        }
    }

    /**
     * Get adapter based on environment configuration
     */
    createAdapterFromConfig(): IDeviceAdapter {
        const adapterType = this.getAdapterTypeFromConfig();
        return this.createAdapter(adapterType);
    }

    /**
     * Create adapter with automatic failover
     */
    async createAdapterWithFailover(preferredTypes: AdapterType[]): Promise<IDeviceAdapter> {
        this.logger.log('Creating adapter with failover', { preferredTypes });

        for (const type of preferredTypes) {
            try {
                const adapter = this.createAdapter(type);
                const isHealthy = await this.checkAdapterHealth(adapter, type);

                if (isHealthy) {
                    this.logger.log('Selected healthy adapter', { type });
                    return adapter;
                }
            } catch (error) {
                this.logger.warn('Adapter health check failed', { type, error: error.message });
                this.updateHealthStatus(type, false, error.message);
            }
        }

        // Fallback to stub adapter
        this.logger.warn('All preferred adapters failed, falling back to stub');
        return this.stubAdapter;
    }

    /**
     * Get available adapter types
     */
    getAvailableAdapterTypes(): AdapterType[] {
        return ['hikvision', 'stub', 'zkteco', 'dahua'];
    }

    /**
     * Get supported adapter types (actually implemented)
     */
    getSupportedAdapterTypes(): AdapterType[] {
        return ['hikvision', 'stub'];
    }

    /**
     * Check if adapter type is supported
     */
    isAdapterTypeSupported(type: AdapterType): boolean {
        return this.getSupportedAdapterTypes().includes(type);
    }

    /**
     * Get adapter health status
     */
    getAdapterHealthStatus(type: AdapterType): AdapterHealthStatus | null {
        return this.adapterHealthStatus.get(type) || null;
    }

    /**
     * Get all adapter health statuses
     */
    getAllAdapterHealthStatuses(): AdapterHealthStatus[] {
        return Array.from(this.adapterHealthStatus.values());
    }

    /**
     * Perform health check on all supported adapters
     */
    async performHealthCheckOnAllAdapters(): Promise<AdapterHealthStatus[]> {
        const supportedTypes = this.getSupportedAdapterTypes();
        const healthChecks = supportedTypes.map(async type => {
            try {
                const adapter = this.createAdapter(type);
                const isHealthy = await this.checkAdapterHealth(adapter, type);
                this.updateHealthStatus(type, isHealthy);
                return this.getAdapterHealthStatus(type)!;
            } catch (error) {
                this.updateHealthStatus(type, false, error.message);
                return this.getAdapterHealthStatus(type)!;
            }
        });

        return Promise.all(healthChecks);
    }

    /**
     * Get recommended adapter type based on environment and health
     */
    async getRecommendedAdapterType(): Promise<AdapterType> {
        // Check environment preference
        const envType = this.getAdapterTypeFromConfig();

        if (envType !== 'stub') {
            // Check if preferred type is healthy
            try {
                const adapter = this.createAdapter(envType);
                const isHealthy = await this.checkAdapterHealth(adapter, envType);

                if (isHealthy) {
                    return envType;
                }
            } catch (error) {
                this.logger.warn('Preferred adapter type is unhealthy', {
                    type: envType,
                    error: error.message,
                });
            }
        }

        // Fallback logic
        const healthStatuses = await this.performHealthCheckOnAllAdapters();
        const healthyAdapters = healthStatuses.filter(status => status.healthy);

        if (healthyAdapters.length > 0) {
            // Return the healthiest non-stub adapter, or stub if it's the only healthy one
            const nonStubHealthy = healthyAdapters.filter(status => status.type !== 'stub');
            return nonStubHealthy.length > 0 ? nonStubHealthy[0].type : 'stub';
        }

        // Ultimate fallback
        return 'stub';
    }

    // ==================== Private Methods ====================

    private getAdapterTypeFromConfig(): AdapterType {
        const configType = this.configService.get<string>('DEVICE_ADAPTER_TYPE', 'hikvision');

        if (this.isAdapterTypeSupported(configType as AdapterType)) {
            return configType as AdapterType;
        }

        this.logger.warn('Configured adapter type not supported, falling back to hikvision', {
            configType,
        });
        return 'hikvision';
    }

    private async checkAdapterHealth(adapter: IDeviceAdapter, type: AdapterType): Promise<boolean> {
        const startTime = Date.now();

        try {
            // Basic health check - try to discover devices with timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Health check timeout')), 5000);
            });

            const healthCheckPromise = adapter.discoverDevices();

            await Promise.race([healthCheckPromise, timeoutPromise]);

            const responseTime = Date.now() - startTime;
            this.updateHealthStatus(type, true, undefined, responseTime);

            return true;
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.updateHealthStatus(type, false, error.message, responseTime);

            return false;
        }
    }

    private updateHealthStatus(
        type: AdapterType,
        healthy: boolean,
        error?: string,
        responseTime?: number
    ): void {
        this.adapterHealthStatus.set(type, {
            type,
            healthy,
            lastCheck: new Date(),
            error,
            responseTime,
        });
    }
}
