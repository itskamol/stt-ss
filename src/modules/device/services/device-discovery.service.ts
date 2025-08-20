import { Injectable } from '@nestjs/common';
import { DeviceRepository } from '../device.repository';
import { DeviceAdapterStrategy } from '../device-adapter.strategy';
import { DeviceInfo } from '@/modules/integrations/adapters';
import { DataScope } from '@/shared/interfaces';
import { LoggerService } from '@/core/logger';
import { Device } from '@prisma/client';

@Injectable()
export class DeviceDiscoveryService {
    constructor(
        private readonly deviceAdapterStrategy: DeviceAdapterStrategy,
        private readonly logger: LoggerService
    ) {}

    async discoverDeviceInfo(connectionDetails: {
        host: string;
        port: number;
        username: string;
        password: string;
        protocol: string;
        deviceType: string;
    }): Promise<DeviceInfo> {
        const correlationId = `discovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Starting device discovery', {
                module: 'DeviceDiscoveryService',
                action: 'discoverDeviceInfo',
                correlationId,
                host: connectionDetails.host,
                port: connectionDetails.port,
                protocol: connectionDetails.protocol,
                deviceType: connectionDetails.deviceType,
            });

            const config = {
                protocol: connectionDetails.protocol,
                host: connectionDetails.host,
                port: connectionDetails.port,
                username: connectionDetails.username,
                password: connectionDetails.password,
            };
            const adapter = this.deviceAdapterStrategy.getAdapter(config as Device);

            const deviceInfo = await adapter.getDeviceInfo(config as Device);
            
            const deviceCapabilities = await adapter.getDeviceCapabilities(config as Device);
            
            deviceInfo.capabilities = deviceCapabilities;
            
            this.logger.log('Device discovery completed successfully', {
                module: 'DeviceDiscoveryService',
                action: 'discoverDeviceInfo',
                correlationId,
            });

            return deviceInfo;
        } catch (error) {
            this.logger.error('Device discovery failed', error.stack, {
                module: 'DeviceDiscoveryService',
                action: 'discoverDeviceInfo',
                correlationId,
                host: connectionDetails.host,
                port: connectionDetails.port,
                protocol: connectionDetails.protocol,
                error: error.message,
            });
            throw error;
        }
    }

    async scanDeviceForCreationInternal(deviceCreationDto: any, scope: DataScope): Promise<any> {
        const correlationId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Starting internal device scan for creation', {
                module: 'DeviceDiscoveryService',
                action: 'scanDeviceForCreationInternal',
                correlationId,
                deviceName: deviceCreationDto.name,
                host: deviceCreationDto.host,
                scope,
            });

            const scanResult = await this.discoverDeviceInfo({
                host: deviceCreationDto.host,
                port: deviceCreationDto.port,
                username: deviceCreationDto.username,
                password: deviceCreationDto.password,
                protocol: deviceCreationDto.protocol,
                deviceType: deviceCreationDto.type,
            });

            const deviceData = {
                ...deviceCreationDto,
                manufacturer: scanResult.manufacturer,
                model: scanResult.model,
                serialNumber: scanResult.serialNumber,
                macAddress: scanResult.macAddress,
                capabilities: scanResult.capabilities,
                organizationId: scope.organizationId,
            };

            this.logger.log('Device scan completed successfully', {
                module: 'DeviceDiscoveryService',
                action: 'scanDeviceForCreationInternal',
                correlationId,
                deviceName: deviceCreationDto.name,
                manufacturer: scanResult.manufacturer,
                model: scanResult.model,
            });

            return deviceData;
        } catch (error) {
            this.logger.error('Device scan failed', error.stack, {
                module: 'DeviceDiscoveryService',
                action: 'scanDeviceForCreationInternal',
                correlationId,
                deviceName: deviceCreationDto.name,
                host: deviceCreationDto.host,
                scope,
                error: error.message,
            });
            throw error;
        }
    }
}
