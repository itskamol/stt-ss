import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { Device, DeviceProtocol, DeviceType } from '@prisma/client';
import {
    AdapterType,
    DeviceAdapterFactory,
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
    getAdapter(config: DeviceConnectionConfig): IDeviceAdapter {
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
        const adapter = this.getAdapter(context.config);

        try {
            this.logger.log('Executing device command', {
                command: command.command,
                deviceHost: context.config.host,
                deviceId: context.device.id,
                deviceName: context.device.name,
                adapterType: this.determineAdapterType(context.config),
                module: 'device-adapter-strategy',
            });

            const result = await adapter.sendCommand(context, command);

            this.logger.log('Device command executed successfully', {
                command: command.command,
                deviceHost: context.config.host,
                deviceId: context.device.id,
                success: result.success,
                module: 'device-adapter-strategy',
            });

            return result;
        } catch (error) {
            this.logger.error('Device command failed', error.stack, {
                command: command.command,
                deviceHost: context.config.host,
                deviceId: context.device.id,
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
        const context = this.createContext(device);
        const adapter = this.getAdapter(context.config);

        try {
            const result = await adapter.testConnection(context);

            this.logger.log('Device connection test result', {
                deviceHost: context.config.host,
                deviceId: context.device.id,
                deviceName: context.device.name,
                success: result,
                module: 'device-adapter-strategy',
            });

            return result;
        } catch (error) {
            this.logger.warn('Device connection test failed', {
                deviceHost: context.config.host,
                deviceId: context.device.id,
                deviceName: context.device.name,
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
        const context = this.createContext(device);
        const adapter = this.getAdapter(context.config);

        try {
            const result = await adapter.getDeviceConfiguration(context);

            this.logger.log('Get device configuration', {
                deviceHost: context.config.host,
                deviceId: context.device.id,
                deviceName: context.device.name,
                success: result,
                module: 'device-adapter-strategy',
            });

            return result;
        } catch (error) {
            this.logger.warn('Get device configuration filed', {
                deviceHost: context.config.host,
                deviceId: context.device.id,
                deviceName: context.device.name,
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
        const context = this.createContext(device);
        const adapter = this.getAdapter(context.config);

        try {
            const health = await adapter.getDeviceHealth(context);

            this.logger.log('Device health retrieved successfully', {
                deviceId: context.device.id,
                deviceHost: context.config.host,
                deviceName: context.device.name,
                status: health.status,
                module: 'device-adapter-strategy',
            });

            return health;
        } catch (error) {
            this.logger.warn('Failed to get device health', {
                deviceId: context.device.id,
                deviceHost: context.config.host,
                deviceName: context.device.name,
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
        const context = this.createContext(device);
        const adapter = this.getAdapter(context.config);

        try {
            const deviceInfo = await adapter.getDeviceInfo(context);

            this.logger.log('Device information retrieved successfully', {
                deviceId: context.device.id,
                deviceHost: context.config.host,
                deviceName: deviceInfo.name,
                module: 'device-adapter-strategy',
            });

            return deviceInfo;
        } catch (error) {
            this.logger.warn('Failed to get device information', {
                deviceId: context.device.id,
                deviceHost: context.config.host,
                deviceName: context.device.name,
                error: error.message,
                module: 'device-adapter-strategy',
            });
            throw error;
        }
    }

    /**
     * Get device information without persisted device (for discovery/testing)
     */
    async getDeviceInfoByConfig(config: DeviceDiscoveryConfig): Promise<DeviceInfo> {
        // Create virtual device object for discovery
        const virtualDevice: Partial<Device> = {
            id: `discovery_${Date.now()}`,
            protocol: config.protocol,
            host: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
            manufacturer: config.brand,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            branchId: '',
            organizationId: '',
            name: `${config.brand} Discovery Device`,
        };

        const context: DeviceOperationContext = {
            device: virtualDevice as Device,
            config: {
                protocol: config.protocol,
                host: config.host,
                port: config.port,
                username: config.username,
                password: config.password,
                brand: config.brand,
                model: undefined,
            }
        };

        const adapter = this.getAdapter(config);

        try {
            const deviceInfo = await adapter.getDeviceInfo(context);

            this.logger.log('Device information retrieved successfully (discovery mode)', {
                deviceHost: config.host,
                deviceName: deviceInfo.name,
                module: 'device-adapter-strategy',
            });

            return deviceInfo;
        } catch (error) {
            this.logger.warn('Failed to get device information (discovery mode)', {
                deviceHost: config.host,
                error: error.message,
                module: 'device-adapter-strategy',
            });
            throw error;
        }
    }

    /**
     * Discover devices using appropriate adapter
     */
    async discoverDevices(adapterType?: AdapterType): Promise<any> {
        const type = adapterType || 'hikvision'; // Default
        const adapter = this.adapterFactory.createAdapter(type);

        try {
            const devices = await adapter.discoverDevices();

            this.logger.log('Device discovery completed', {
                adapterType: type,
                deviceCount: devices.length,
                module: 'device-adapter-strategy',
            });

            return devices;
        } catch (error) {
            this.logger.warn('Device discovery failed', {
                adapterType: type,
                error: error.message,
                module: 'device-adapter-strategy',
            });
            throw error;
        }
    }
}