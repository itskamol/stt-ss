import { Injectable } from '@nestjs/common';
import { DeviceAdapterStrategy } from '../device-adapter.strategy';
import { DeviceInfo } from '@/modules/integrations/adapters';
import { DataScope } from '@/shared/interfaces';
import { Device } from '@prisma/client';

@Injectable()
export class DeviceDiscoveryService {
    constructor(
        private readonly deviceAdapterStrategy: DeviceAdapterStrategy,
    ) {}

    async discoverDeviceInfo(connectionDetails: {
        host: string;
        port: number;
        username: string;
        password: string;
        protocol: string;
        deviceType: string;
    }): Promise<DeviceInfo> {
        try {
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

            return deviceInfo;
        } catch (error) {
            throw error;
        }
    }

    async scanDeviceForCreationInternal(deviceCreationDto: any, scope: DataScope): Promise<any> {
        try {
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
                firmwareReleasedDate: scanResult.firmwareReleasedDate,
                firmwareVersion: scanResult.firmwareVersion,
                status: scanResult.status,
                isActive: true,
            };
            return deviceData;
        } catch (error) {
            throw error;
        }
    }
}
