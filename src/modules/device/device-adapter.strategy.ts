import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { Device, DeviceProtocol, DeviceType } from '@prisma/client';
import {
    AdapterType,
    DeviceAdapterFactory,
    DeviceCapability,
    DeviceCommand,
    DeviceDiscoveryConfig,
    DeviceInfo,
    IDeviceAdapter,
} from '@/modules/integrations/adapters';

export interface DeviceConnectionConfig {
    protocol: DeviceProtocol;
    host: string;
    port: number;
    username?: string;
    password?: string;
    brand: string;
    model?: string;
}

/**
 * Context object containing all necessary information for device operations
 */
export interface DeviceOperationContext {
    /**
     * Complete device object from database
     */
    device: Device;

    /**
     * Connection configuration for the device
     */
    config: DeviceConnectionConfig;
}

@Injectable()
export class DeviceAdapterStrategy {
    constructor(
        private readonly adapterFactory: DeviceAdapterFactory,
        private readonly logger: LoggerService
    ) {}

    /**
     * Create operation context from device object
     */
    private createContext(device: Device): DeviceOperationContext {
        const config: DeviceConnectionConfig = {
            protocol: device.protocol,
            host: device.host,
            port: device.port || 80,
            username: device.username,
            password: device.password, // Decrypt if needed
            brand: device.manufacturer || 'unknown',
            model: device.model,
        };

        return { device, config };
    }

    /**
     * Get appropriate adapter based on device configuration
     */
    getAdapter(device: Device): IDeviceAdapter {
        const config = this.createContext(device).config;
        const adapterType = this.determineAdapterType(config);

        this.logger.log('Selecting device adapter', {
            deviceBrand: config.brand,
            deviceModel: config.model,
            adapterType,
            host: config.host,
            module: 'device-adapter-strategy',
        });

        return this.adapterFactory.createAdapter(adapterType);
    }

    /**
     * Determine adapter type based on device configuration
     */
    private determineAdapterType(config: DeviceConnectionConfig): AdapterType {
        const brand = config.brand.toLowerCase();

        if (brand.includes('hikvision') || brand.includes('hik')) {
            return 'hikvision';
        }

        if (brand.includes('zkteco') || brand.includes('zk')) {
            return 'zkteco';
        }

        if (brand.includes('dahua')) {
            // Brand-based adapter selection

            return 'dahua';
        }

        // Protocol-based fallback
        if (config.protocol === DeviceProtocol.HTTP || config.protocol === DeviceProtocol.HTTPS) {
            // Default to Hikvision for HTTP-based devices
            return 'hikvision';
        }

        // Fallback to stub for testing/unknown devices
        return 'stub';
    }

    /**
     * Execute command on device using appropriate adapter
     */
    async executeCommand(device: Device, command: DeviceCommand): Promise<any> {
        const context = this.createContext(device);
        const adapter = this.getAdapter(device);

        try {
            this.logger.log('Executing device command', {
                command: command.command,
                deviceHost: device.host,
                deviceId: device.id,
                deviceName: device.name,
                adapterType: this.determineAdapterType(context.config),
                module: 'device-adapter-strategy',
            });

            const result = await adapter.sendCommand(device, command);

            this.logger.log('Device command executed successfully', {
                command: command.command,
                deviceHost: device.host,
                deviceId: device.id,
                success: result.success,
                module: 'device-adapter-strategy',
            });

            return result;
        } catch (error) {
            this.logger.error('Device command failed', error.stack, {
                command: command.command,
                deviceHost: device.host,
                deviceId: device.id,
                error: error.message,
                module: 'device-adapter-strategy',
            });
            throw error;
        }
    }

    /**
     * Test device connection using appropriate adapter
     */
    async testConnection(device: Device): Promise<boolean> {
        const adapter = this.getAdapter(device);

        try {
            const result = await adapter.testConnection(device);

            this.logger.log('Device connection test result', {
                deviceHost: device.host,
                deviceId: device.id,
                deviceName: device.name,
                success: result,
                module: 'device-adapter-strategy',
            });

            return result;
        } catch (error) {
            this.logger.warn('Device connection test failed', {
                deviceHost: device.host,
                deviceId: device.id,
                deviceName: device.name,
                error: error.message,
                module: 'device-adapter-strategy',
            });
            return false;
        }
    }

    /**
     * Get device configuration using appropriate adapter
     */
    async getDeviceConfiguration(device: Device): Promise<any> {
        const adapter = this.getAdapter(device);

        try {
            const result = await adapter.getDeviceConfiguration(device);

            this.logger.log('Get device configuration', {
                deviceHost: device.host,
                deviceId: device.id,
                deviceName: device.name,
                success: result,
                module: 'device-adapter-strategy',
            });

            return result;
        } catch (error) {
            this.logger.warn('Get device configuration filed', {
                deviceHost: device.host,
                deviceId: device.id,
                deviceName: device.name,
                error: error.message,
                module: 'device-adapter-strategy',
            });
            return false;
        }
    }

    /**
     * Get device health using appropriate adapter
     */
    async getDeviceHealth(device: Device): Promise<any> {
        const adapter = this.getAdapter(device);

        try {
            const health = await adapter.getDeviceHealth(device);

            this.logger.log('Device health retrieved successfully', {
                deviceId: device.id,
                deviceHost: device.host,
                deviceName: device.name,
                status: health.status,
                module: 'device-adapter-strategy',
            });

            return health;
        } catch (error) {
            this.logger.warn('Failed to get device health', {
                deviceId: device.id,
                deviceHost: device.host,
                deviceName: device.name,
                error: error.message,
                module: 'device-adapter-strategy',
            });
            throw error;
        }
    }

    /**
     * Get device information using appropriate adapter
     */
    async getDeviceInfo(device: Device): Promise<any> {
        const adapter = this.getAdapter(device);

        try {
            const deviceInfo = await adapter.getDeviceInfo(device);

            this.logger.log('Device information retrieved successfully', {
                deviceId: device.id,
                deviceHost: device.host,
                deviceName: deviceInfo.name,
                module: 'device-adapter-strategy',
            });

            return deviceInfo;
        } catch (error) {
            this.logger.warn('Failed to get device information', {
                deviceId: device.id,
                deviceHost: device.host,
                deviceName: device.name,
                error: error.message,
                module: 'device-adapter-strategy',
            });
            throw error;
        }
    }

    /**
     * Get device information without persisted device (for discovery/testing)
     */
    async getDeviceInfoByConfig(device: Device): Promise<DeviceInfo> {
        // Create virtual device object for discovery
        const virtualDevice: Partial<Device> = {
            id: `discovery_${Date.now()}`,
            protocol: device.protocol,
            host: device.host,
            port: device.port,
            username: device.username,
            password: device.password,
            manufacturer: device.manufacturer,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            branchId: '',
            organizationId: '',
            name: `${device.manufacturer} Discovery Device`,
        };

        const adapter = this.getAdapter(device);

        try {
            const deviceInfo = await adapter.getDeviceInfo(device);

            this.logger.log('Device information retrieved successfully (discovery mode)', {
                deviceHost: device.host,
                deviceName: deviceInfo.name,
                module: 'device-adapter-strategy',
            });

            return deviceInfo;
        } catch (error) {
            this.logger.warn('Failed to get device information (discovery mode)', {
                deviceHost: device.host,
                error: error.message,
                module: 'device-adapter-strategy',
            });
            throw error;
        }
    }

    /**
     * Get device capabilities using appropriate adapter
     */
    async supportsWebhooks(device: Device): Promise<boolean> {
        const adapter = this.getAdapter(device);

        try {
            return adapter.supportsWebhooks(device);
        } catch (error) {
            this.logger.warn('Failed to get device capabilities', {
                deviceId: device.id,
                deviceHost: device.host,
                deviceName: device.name,
                error: error.message,
                module: 'device-adapter-strategy',
            });
            return false;
        }
    }
}
