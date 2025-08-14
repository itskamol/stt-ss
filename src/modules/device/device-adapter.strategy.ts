import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { DeviceType, DeviceProtocol } from '@prisma/client';
import { AdapterType, DeviceAdapterFactory, DeviceCommand, IDeviceAdapter } from '@/modules/integrations/adapters';

export interface DeviceConnectionConfig {
    type: DeviceType;
    protocol: DeviceProtocol;
    host: string;
    port: number;
    username?: string;
    password?: string;
    brand: string;
    model?: string;
}

@Injectable()
export class DeviceAdapterStrategy {
    constructor(
        private readonly adapterFactory: DeviceAdapterFactory,
        private readonly logger: LoggerService,
    ) {}

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
            module: 'device-adapter-strategy'
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
        
        if (brand.includes('dahua')) {     // Brand-based adapter selection
   
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
    async executeCommand(
        deviceId: string,
        config: DeviceConnectionConfig,
        command: DeviceCommand
    ): Promise<any> {
        const adapter = this.getAdapter(config);
        
        try {
            this.logger.log('Executing device command', {
                command: command.command,
                deviceHost: config.host,
                deviceId,
                adapterType: this.determineAdapterType(config),
                module: 'device-adapter-strategy'
            });

            const result = await adapter.sendCommand(deviceId, command);
            
            this.logger.log('Device command executed successfully', {
                command: command.command,
                deviceHost: config.host,
                success: result.success,
                module: 'device-adapter-strategy'
            });

            return result;
        } catch (error) {
            this.logger.error('Device command failed', error.stack, {
                command: command.command,
                deviceHost: config.host,
                deviceId,
                error: error.message,
                module: 'device-adapter-strategy'
            });
            throw error;
        }
    }

    /**
     * Test device connection using appropriate adapter
     */
    async testConnection(deviceId: string, config: DeviceConnectionConfig): Promise<boolean> {
        const adapter = this.getAdapter(config);
        
        try {
            const result = await adapter.testConnection(deviceId);
            
            this.logger.log('Device connection test result', {
                deviceHost: config.host,
                deviceId,
                success: result,
                module: 'device-adapter-strategy'
            });

            return result;
        } catch (error) {
            this.logger.warn('Device connection test failed', {
                deviceHost: config.host,
                deviceId,
                error: error.message,
                module: 'device-adapter-strategy'
            });
            return false;
        }
    }

    /**
     * Get device health using appropriate adapter
     */
    async getDeviceHealth(deviceId: string, config: DeviceConnectionConfig): Promise<any> {
        const adapter = this.getAdapter(config);

        try {
            const health = await adapter.getDeviceHealth(deviceId);
            
            this.logger.log('Device health retrieved successfully', {
                deviceId,
                deviceHost: config.host,
                status: health.status,
                module: 'device-adapter-strategy'
            });

            return health;
        } catch (error) {
            this.logger.warn('Failed to get device health', {
                deviceId,
                deviceHost: config.host,
                error: error.message,
                module: 'device-adapter-strategy'
            });
            throw error;
        }
    }

    /**
     * Get device information using appropriate adapter
     */
    async getDeviceInfo(deviceId: string, config: DeviceConnectionConfig): Promise<any> {
        const adapter = this.getAdapter(config);

        try {
            const deviceInfo = await adapter.getDeviceInfo(deviceId);
            
            this.logger.log('Device information retrieved successfully', {
                deviceId,
                deviceHost: config.host,
                deviceName: deviceInfo.name,
                module: 'device-adapter-strategy'
            });

            return deviceInfo;
        } catch (error) {
            this.logger.warn('Failed to get device information', {
                deviceId,
                deviceHost: config.host,
                error: error.message,
                module: 'device-adapter-strategy'
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
                module: 'device-adapter-strategy'
            });

            return devices;
        } catch (error) {
            this.logger.warn('Device discovery failed', {
                adapterType: type,
                error: error.message,
                module: 'device-adapter-strategy'
            });
            throw error;
        }
    }
}
