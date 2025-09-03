import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IDeviceAdapter } from '../interfaces';
import { HikvisionAdapter } from '../implementations';
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
                return // Future implementation;

            case 'zkteco':
                // Future implementation
                this.logger.warn('ZKTeco adapter not implemented, falling back to stub');
                return // Future implementation;

            case 'dahua':
                // Future implementation
                this.logger.warn('Dahua adapter not implemented, falling back to stub');
                return // Future implementation;

            default:
                this.logger.warn('Unknown adapter type, falling back to stub', { type });
                return // Future implementation;
        }
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
}
