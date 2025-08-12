import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { EncryptionService } from './encryption.service';
import { PrismaService } from '@/core/database/prisma.service';
import {
    HikvisionDeviceConfig,
    HikvisionErrorContext,
    HIKVISION_ENDPOINTS,
    HIKVISION_CONFIG,
    HikvisionValidation,
} from '../adapters/hikvision.adapter';
import { DeviceConfiguration, DeviceSchedule, DeviceAccessRule } from '../adapters/device.adapter';
import { HikvisionExceptionFactory } from '../exceptions/hikvision.exceptions';

export interface DeviceConnectionTest {
    deviceId: string;
    success: boolean;
    responseTime?: number;
    error?: string;
    timestamp: Date;
}

export interface DeviceNetworkInfo {
    ipAddress: string;
    macAddress?: string;
    gateway?: string;
    subnet?: string;
    dns?: string[];
}

export interface DeviceSystemInfo {
    deviceName: string;
    deviceType: string;
    serialNumber: string;
    firmwareVersion: string;
    hardwareVersion: string;
    bootTime?: Date;
    uptime?: number;
}

export interface DeviceCapabilities {
    maxUsers: number;
    maxCards: number;
    maxFingerprints: number;
    maxFaces: number;
    supportedFeatures: string[];
    videoFormats?: string[];
    audioFormats?: string[];
}

@Injectable()
export class HikvisionDeviceConfigService {
    private readonly logger = new Logger(HikvisionDeviceConfigService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly encryptionService: EncryptionService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * Test device connection with detailed diagnostics
     */
    async testDeviceConnection(deviceId: string): Promise<DeviceConnectionTest> {
        const startTime = Date.now();
        this.logger.log('Testing device connection', { deviceId });

        try {
            const device = await this.getDeviceConfig(deviceId);
            const endpoint = this.buildEndpoint(device, HIKVISION_ENDPOINTS.DEVICE_INFO);
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: 5000,
                })
            );

            const responseTime = Date.now() - startTime;
            
            return {
                deviceId,
                success: true,
                responseTime,
                timestamp: new Date(),
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            return {
                deviceId,
                success: false,
                responseTime,
                error: error.message,
                timestamp: new Date(),
            };
        }
    }

    /**
     * Get comprehensive device information
     */
    async getDeviceSystemInfo(deviceId: string): Promise<DeviceSystemInfo | null> {
        this.logger.log('Getting device system info', { deviceId });

        try {
            const device = await this.getDeviceConfig(deviceId);
            const endpoint = this.buildEndpoint(device, HIKVISION_ENDPOINTS.DEVICE_INFO);
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );

            const data = response.data;
            
            return {
                deviceName: data.deviceName || 'Unknown Device',
                deviceType: data.deviceType || 'Hikvision Device',
                serialNumber: data.serialNumber || 'Unknown',
                firmwareVersion: data.firmwareVersion || 'Unknown',
                hardwareVersion: data.hardwareVersion || 'Unknown',
                bootTime: data.bootTime ? new Date(data.bootTime) : undefined,
                uptime: data.uptime || 0,
            };

        } catch (error) {
            const context = this.createErrorContext(deviceId, 'getDeviceSystemInfo');
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to get device system info', { deviceId, error: exception.message });
            return null;
        }
    }

    /**
     * Get device network configuration
     */
    async getDeviceNetworkInfo(deviceId: string): Promise<DeviceNetworkInfo | null> {
        this.logger.log('Getting device network info', { deviceId });

        try {
            const device = await this.getDeviceConfig(deviceId);
            const endpoint = this.buildEndpoint(device, '/ISAPI/System/Network/interfaces/1');
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );

            const data = response.data;
            
            return {
                ipAddress: data.ipAddress || device.ipAddress,
                macAddress: data.macAddress,
                gateway: data.gateway,
                subnet: data.subnetMask,
                dns: data.dns ? [data.dns] : undefined,
            };

        } catch (error) {
            const context = this.createErrorContext(deviceId, 'getDeviceNetworkInfo');
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to get device network info', { deviceId, error: exception.message });
            return null;
        }
    }

    /**
     * Get device capabilities
     */
    async getDeviceCapabilities(deviceId: string): Promise<DeviceCapabilities | null> {
        this.logger.log('Getting device capabilities', { deviceId });

        try {
            const device = await this.getDeviceConfig(deviceId);
            const endpoint = this.buildEndpoint(device, '/ISAPI/System/capabilities');
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );

            const data = response.data;
            
            return {
                maxUsers: data.maxUsers || 1000,
                maxCards: data.maxCards || 1000,
                maxFingerprints: data.maxFingerprints || 1000,
                maxFaces: data.maxFaces || 1000,
                supportedFeatures: data.supportedFeatures || [],
                videoFormats: data.videoFormats,
                audioFormats: data.audioFormats,
            };

        } catch (error) {
            const context = this.createErrorContext(deviceId, 'getDeviceCapabilities');
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to get device capabilities', { deviceId, error: exception.message });
            return null;
        }
    }

    /**
     * Update device network configuration
     */
    async updateDeviceNetworkConfig(
        deviceId: string, 
        networkConfig: Partial<DeviceNetworkInfo>
    ): Promise<boolean> {
        this.logger.log('Updating device network configuration', { deviceId, networkConfig });

        try {
            const device = await this.getDeviceConfig(deviceId);
            const endpoint = this.buildEndpoint(device, '/ISAPI/System/Network/interfaces/1');
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const payload = {
                NetworkInterface: {
                    id: 1,
                    ...(networkConfig.ipAddress && { ipAddress: networkConfig.ipAddress }),
                    ...(networkConfig.gateway && { gateway: networkConfig.gateway }),
                    ...(networkConfig.subnet && { subnetMask: networkConfig.subnet }),
                    ...(networkConfig.dns && { dns: networkConfig.dns[0] }),
                },
            };

            await firstValueFrom(
                this.httpService.put(endpoint, payload, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            );

            // Update database if IP address changed
            if (networkConfig.ipAddress) {
                await this.prisma.device.update({
                    where: { id: deviceId },
                    data: { ipAddress: networkConfig.ipAddress },
                });
            }

            this.logger.log('Device network configuration updated', { deviceId });
            return true;

        } catch (error) {
            const context = this.createErrorContext(deviceId, 'updateDeviceNetworkConfig');
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to update device network config', { deviceId, error: exception.message });
            throw exception.toNestException();
        }
    }

    /**
     * Validate device configuration
     */
    async validateDeviceConfig(config: Partial<HikvisionDeviceConfig>): Promise<string[]> {
        const errors: string[] = [];

        if (config.ipAddress && !HikvisionValidation.isValidIpAddress(config.ipAddress)) {
            errors.push('Invalid IP address format');
        }

        if (config.port && (config.port < 1 || config.port > 65535)) {
            errors.push('Port must be between 1 and 65535');
        }

        if (config.username && config.username.length < 1) {
            errors.push('Username cannot be empty');
        }

        if (config.timeout && config.timeout < 1000) {
            errors.push('Timeout must be at least 1000ms');
        }

        return errors;
    }

    /**
     * Create device configuration from template
     */
    async createDeviceConfigFromTemplate(
        deviceId: string,
        templateName: string
    ): Promise<DeviceConfiguration> {
        this.logger.log('Creating device configuration from template', { deviceId, templateName });

        // This would typically load from a configuration template
        // For now, we'll create a basic template
        const baseConfig: DeviceConfiguration = {
            deviceId,
            settings: {
                timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                maxRetries: HIKVISION_CONFIG.MAX_RETRIES,
                retryDelay: HIKVISION_CONFIG.RETRY_DELAY,
            },
            schedules: this.createDefaultSchedules(),
            accessRules: this.createDefaultAccessRules(),
        };

        return baseConfig;
    }

    /**
     * Backup device configuration
     */
    async backupDeviceConfiguration(deviceId: string): Promise<any> {
        this.logger.log('Backing up device configuration', { deviceId });

        try {
            const device = await this.getDeviceConfig(deviceId);
            const endpoint = this.buildEndpoint(device, '/ISAPI/System/configurationData');
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: 30000, // Longer timeout for backup
                    responseType: 'arraybuffer',
                })
            );

            return {
                deviceId,
                timestamp: new Date(),
                data: Buffer.from(response.data),
                size: response.data.byteLength,
            };

        } catch (error) {
            const context = this.createErrorContext(deviceId, 'backupDeviceConfiguration');
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to backup device configuration', { deviceId, error: exception.message });
            throw exception.toNestException();
        }
    }

    /**
     * Restore device configuration
     */
    async restoreDeviceConfiguration(deviceId: string, backupData: Buffer): Promise<boolean> {
        this.logger.log('Restoring device configuration', { deviceId, dataSize: backupData.length });

        try {
            const device = await this.getDeviceConfig(deviceId);
            const endpoint = this.buildEndpoint(device, '/ISAPI/System/configurationData');
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            await firstValueFrom(
                this.httpService.put(endpoint, backupData, {
                    auth: { username: device.username, password },
                    timeout: 60000, // Longer timeout for restore
                    headers: {
                        'Content-Type': 'application/octet-stream',
                    },
                })
            );

            this.logger.log('Device configuration restored', { deviceId });
            return true;

        } catch (error) {
            const context = this.createErrorContext(deviceId, 'restoreDeviceConfiguration');
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to restore device configuration', { deviceId, error: exception.message });
            throw exception.toNestException();
        }
    }

    // ==================== Private Methods ====================

    private async getDeviceConfig(deviceId: string): Promise<HikvisionDeviceConfig> {
        const device = await this.prisma.device.findUnique({
            where: { id: deviceId },
        });

        if (!device || !device.ipAddress || !device.username || !device.password) {
            throw new Error(`Device configuration not found or incomplete: ${deviceId}`);
        }

        return {
            deviceId: device.id,
            ipAddress: device.ipAddress,
            username: device.username,
            encryptedSecret: device.password,
        };
    }

    private buildEndpoint(device: HikvisionDeviceConfig, path: string): string {
        const protocol = device.useHttps ? 'https' : 'http';
        const port = device.port || (device.useHttps ? HIKVISION_CONFIG.DEFAULT_HTTPS_PORT : HIKVISION_CONFIG.DEFAULT_PORT);
        
        return `${protocol}://${device.ipAddress}:${port}${path}`;
    }

    private createErrorContext(deviceId: string, operation: string): HikvisionErrorContext {
        return {
            deviceId,
            operation,
            correlationId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
    }

    private createDefaultSchedules(): DeviceSchedule[] {
        return [
            {
                id: 'default-24-7',
                name: '24/7 Access',
                startTime: '00:00',
                endTime: '23:59',
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
                enabled: true,
            },
            {
                id: 'business-hours',
                name: 'Business Hours',
                startTime: '08:00',
                endTime: '18:00',
                daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
                enabled: false,
            },
        ];
    }

    private createDefaultAccessRules(): DeviceAccessRule[] {
        return [
            {
                id: 'default-rule',
                name: 'Default Access Rule',
                userGroups: ['employees'],
                timeSchedules: ['default-24-7'],
                enabled: true,
            },
        ];
    }
}