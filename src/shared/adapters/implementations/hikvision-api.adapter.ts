import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Device, DeviceStatus, DeviceType, EventType } from '@prisma/client';

import { PrismaService } from '@/core/database/prisma.service';
import { EncryptionService } from '@/shared/services/encryption.service';
import { HikvisionSessionService } from '@/shared/services/hikvision-session.service';
import { HikvisionUserManagementService } from '@/shared/services/hikvision-user-management.service';
import { HikvisionDeviceControlService } from '@/shared/services/hikvision-device-control.service';
import { HikvisionDiscoveryService } from '@/shared/services/hikvision-discovery.service';
import { HikvisionEventMonitoringService } from '@/shared/services/hikvision-event-monitoring.service';
import { HikvisionMaintenanceService } from '@/shared/services/hikvision-maintenance.service';
import {
    IDeviceAdapter,
    DeviceInfo,
    DeviceConfiguration,
    DeviceCommand,
    DeviceCommandResult,
    DeviceHealth,
    DeviceEvent,
} from '../device.adapter';
import {
    CreateDeviceUserDto,
    UpdateDeviceUserDto,
    DeviceUserInfo,
    SecureSession,
    CachedSession,
    HikvisionCacheKeys,
    HikvisionValidation,
    HIKVISION_ENDPOINTS,
    HIKVISION_CONFIG,
    HikvisionDeviceConfig,
    HikvisionErrorContext,
    HikvisionSecurityResponse,
    HikvisionUserInfoResponse,
    HikvisionCreateUserPayload,
    HikvisionUpdateUserPayload,
} from '../hikvision.adapter';
import {
    HikvisionExceptionFactory,
    HikvisionNotFoundException,
    HikvisionBadRequestException,
} from '@/shared/exceptions/hikvision.exceptions';
import { CacheService } from '@/core/cache/cache.service';

@Injectable()
export class HikvisionApiAdapter implements IDeviceAdapter {
    private readonly logger = new Logger(HikvisionApiAdapter.name);

    constructor(
        private readonly cacheManager: CacheService,
        private readonly httpService: HttpService,
        private readonly prisma: PrismaService,
        private readonly encryptionService: EncryptionService,
        private readonly sessionService: HikvisionSessionService,
        private readonly userManagementService: HikvisionUserManagementService,
        private readonly deviceControlService: HikvisionDeviceControlService,
        private readonly discoveryService: HikvisionDiscoveryService,
        private readonly eventMonitoringService: HikvisionEventMonitoringService,
        private readonly maintenanceService: HikvisionMaintenanceService,
    ) {}

    // ==================== IDeviceAdapter Implementation ====================

    async discoverDevices(): Promise<DeviceInfo[]> {
        this.logger.log('Discovering Hikvision devices');
        
        try {
            // Use discovery service to find devices on network
            const discoveredDevices = await this.discoveryService.discoverDevices({
                timeout: 10000,
                maxConcurrent: 20,
                ports: [80, 8000, 8080],
            });

            // Convert discovered devices to DeviceInfo format
            const deviceInfos: DeviceInfo[] = discoveredDevices.map(device => ({
                id: device.isConfigured ? `configured-${device.ipAddress}` : `discovered-${device.ipAddress}`,
                name: device.model || `Hikvision Device (${device.ipAddress})`,
                type: DeviceType.CAMERA,
                status: device.isConfigured ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE,
                ipAddress: device.ipAddress,
                macAddress: device.macAddress,
                firmwareVersion: device.firmwareVersion,
                lastSeen: new Date(),
                capabilities: [
                    {
                        type: DeviceType.CAMERA,
                        enabled: true,
                        configuration: {
                            port: device.port,
                            discoveryMethod: device.discoveryMethod,
                            responseTime: device.responseTime,
                        },
                    },
                ],
            }));

            this.logger.log('Device discovery completed', { 
                totalFound: deviceInfos.length,
                configured: deviceInfos.filter(d => d.status === DeviceStatus.ONLINE).length,
            });

            return deviceInfos;

        } catch (error) {
            this.logger.error('Device discovery failed', { error: error.message });
            
            // Fallback to database devices
            const devices = await this.prisma.device.findMany({
                where: {
                    // Filter for Hikvision devices if there's a type field
                },
            });

            return devices.map(device => this.mapDeviceToDeviceInfo(device));
        }
    }

    async getDeviceInfo(deviceId: string): Promise<DeviceInfo> {
        this.logger.log('Getting device info', { deviceId });

        const device = await this.getDeviceFromDatabase(deviceId);
        
        try {
            // Try to get additional info from the device itself
            const deviceConfig = this.deviceToConfig(device);
            const endpoint = this.buildEndpoint(deviceConfig, HIKVISION_ENDPOINTS.DEVICE_INFO);
            const password = this.encryptionService.decrypt(device.password);
            
            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );

            // Parse device info from response and merge with database info
            const deviceInfo = this.mapDeviceToDeviceInfo(device);
            if (response.data) {
                // Update with live data from device
                deviceInfo.status = DeviceStatus.ONLINE;
                deviceInfo.lastSeen = new Date();
                deviceInfo.firmwareVersion = response.data.firmwareVersion || deviceInfo.firmwareVersion;
            }

            return deviceInfo;
        } catch (error) {
            this.logger.warn('Failed to get live device info, returning database info', { deviceId, error: error.message });
            const deviceInfo = this.mapDeviceToDeviceInfo(device);
            deviceInfo.status = DeviceStatus.OFFLINE;
            return deviceInfo;
        }
    }

    async getDeviceConfiguration(deviceId: string): Promise<DeviceConfiguration> {
        return this.discoveryService.getDeviceConfiguration(deviceId);
    }

    async updateDeviceConfiguration(
        deviceId: string,
        configuration: Partial<DeviceConfiguration>
    ): Promise<void> {
        await this.discoveryService.updateDeviceConfiguration(deviceId, configuration);
        
        // Update database configuration if needed
        if (configuration.settings) {
            await this.prisma.device.update({
                where: { id: deviceId },
                data: {
                    // Update relevant fields based on settings
                    // This would need to be adjusted based on your actual schema
                },
            });
        }
    }

    async sendCommand(deviceId: string, command: DeviceCommand): Promise<DeviceCommandResult> {
        const device = await this.getDeviceFromDatabase(deviceId);
        return this.deviceControlService.executeCustomCommand(this.deviceToConfig(device), command);
    }

    async getDeviceHealth(deviceId: string): Promise<DeviceHealth> {
        const device = await this.getDeviceFromDatabase(deviceId);
        return this.deviceControlService.getDeviceHealth(this.deviceToConfig(device));
    }

    async subscribeToEvents(deviceId: string, callback: (event: DeviceEvent) => void): Promise<void> {
        this.logger.log('Subscribing to device events', { deviceId });
        
        const device = await this.getDeviceFromDatabase(deviceId);
        
        // Use event monitoring service for subscription
        await this.eventMonitoringService.subscribeToEvents(this.deviceToConfig(device), callback, {
            eventTypes: Object.values(EventType),
            useWebSocket: true,
            pollingInterval: 5000,
            maxRetries: 5,
        });
        
        this.logger.log('Successfully subscribed to device events', { deviceId });
    }

    async unsubscribeFromEvents(deviceId: string): Promise<void> {
        this.logger.log('Unsubscribing from device events', { deviceId });
        
        await this.eventMonitoringService.unsubscribeFromEvents(deviceId);
        
        this.logger.log('Successfully unsubscribed from device events', { deviceId });
    }

    async syncUsers(
        deviceId: string,
        users: Array<{
            userId: string;
            cardId?: string;
            biometricData?: string;
            accessLevel: number;
        }>
    ): Promise<void> {
        this.logger.log('Syncing users to device', { deviceId, userCount: users.length });

        const device = await this.getDeviceFromDatabase(deviceId);
        const context = this.createErrorContext(deviceId, 'syncUsers');

        try {
            const device = await this.getDeviceFromDatabase(deviceId);
            const result = await this.userManagementService.syncUsersFromSource(this.deviceToConfig(device), users);

            if (result.failureCount > 0) {
                this.logger.warn('User sync completed with errors', { 
                    deviceId, 
                    successCount: result.successCount,
                    failureCount: result.failureCount,
                    errors: result.errors 
                });
            } else {
                this.logger.log('User sync completed successfully', { 
                    deviceId, 
                    syncedUsers: result.successCount 
                });
            }

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('User sync failed', { deviceId, error: exception.message });
            throw exception.toNestException();
        }
    }

    async removeUser(deviceId: string, userId: string): Promise<void> {
        this.logger.log('Removing user from device', { deviceId, userId });
        
        await this.deleteUser(deviceId, userId);
    }

    async testConnection(deviceId: string): Promise<boolean> {
        this.logger.log('Testing device connection', { deviceId });

        try {
            const device = await this.getDeviceFromDatabase(deviceId);
            const deviceConfig = this.deviceToConfig(device);
            const endpoint = this.buildEndpoint(deviceConfig, HIKVISION_ENDPOINTS.DEVICE_INFO);
            const password = this.encryptionService.decrypt(device.password);
            
            await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: 5000, // Shorter timeout for connection test
                })
            );

            return true;

        } catch (error) {
            this.logger.warn('Device connection test failed', { deviceId, error: error.message });
            return false;
        }
    }

    async rebootDevice(deviceId: string): Promise<void> {
        this.logger.log('Rebooting device', { deviceId });

        const command: DeviceCommand = {
            command: 'reboot',
            timeout: 30, // 30 seconds timeout for reboot
        };

        const result = await this.sendCommand(deviceId, command);
        
        if (!result.success) {
            throw new Error(`Failed to reboot device: ${result.message}`);
        }

        this.logger.log('Device reboot initiated', { deviceId });
    }

    async updateFirmware(
        deviceId: string,
        firmwareUrl: string
    ): Promise<{ success: boolean; message: string }> {
        this.logger.log('Updating device firmware', { deviceId, firmwareUrl });

        const device = await this.getDeviceFromDatabase(deviceId);
        
        const result = await this.maintenanceService.updateFirmware(this.deviceToConfig(device), {
            firmwareUrl,
            rebootAfterUpdate: true,
            backupBeforeUpdate: true,
        });

        return {
            success: result.success,
            message: result.message,
        };
    }

    async getDeviceLogs(deviceId: string, startDate?: Date, endDate?: Date): Promise<string[]> {
        this.logger.log('Getting device logs', { deviceId, startDate, endDate });

        const device = await this.getDeviceFromDatabase(deviceId);
        
        const logs = await this.maintenanceService.getDeviceLogs(this.deviceToConfig(device), {
            startDate,
            endDate,
            limit: 1000,
        });

        // Convert log entries to string format for compatibility
        return logs.map(log => 
            `${log.timestamp.toISOString()} [${log.level.toUpperCase()}] ${log.category}: ${log.message}`
        );
    }

    async clearDeviceLogs(deviceId: string): Promise<void> {
        this.logger.log('Clearing device logs', { deviceId });

        const device = await this.getDeviceFromDatabase(deviceId);
        
        const result = await this.maintenanceService.clearDeviceLogs(this.deviceToConfig(device));
        
        if (!result.success) {
            throw new Error(result.message);
        }
        
        this.logger.log('Device logs cleared successfully', { 
            deviceId, 
            clearedCount: result.clearedCount 
        });
    }

    // ==================== Hikvision-Specific Methods ====================

    async getSecureSession(deviceId: string): Promise<SecureSession> {
        const device = await this.getDeviceFromDatabase(deviceId);
        return this.sessionService.getSecureSession(this.deviceToConfig(device));
    }

    async clearSession(deviceId: string): Promise<void> {
        return this.sessionService.clearSession(deviceId);
    }

    async getDeviceStatus(deviceId: string): Promise<{ online: boolean; lastSeen?: Date }> {
        const device = await this.getDeviceFromDatabase(deviceId);
        const status = await this.deviceControlService.getDeviceStatus(this.deviceToConfig(device));
        return {
            online: status.online,
            lastSeen: status.lastSeen,
        };
    }

    async addUser(deviceId: string, userData: CreateDeviceUserDto): Promise<boolean> {
        const device = await this.getDeviceFromDatabase(deviceId);
        return this.userManagementService.addUser(this.deviceToConfig(device), userData);
    }

    async updateUser(deviceId: string, employeeNo: string, userData: UpdateDeviceUserDto): Promise<boolean> {
        const device = await this.getDeviceFromDatabase(deviceId);
        return this.userManagementService.updateUser(this.deviceToConfig(device), employeeNo, userData);
    }

    async deleteUser(deviceId: string, employeeNo: string): Promise<boolean> {
        const device = await this.getDeviceFromDatabase(deviceId);
        return this.userManagementService.deleteUser(this.deviceToConfig(device), employeeNo);
    }

    async findUserByEmployeeNo(deviceId: string, employeeNo: string): Promise<DeviceUserInfo | null> {
        const device = await this.getDeviceFromDatabase(deviceId);
        return this.userManagementService.findUserByEmployeeNo(this.deviceToConfig(device), employeeNo);
    }

    async getFaceData(deviceId: string, employeeNo: string): Promise<Buffer | null> {
        this.logger.log('Getting face data', { deviceId, employeeNo });

        const device = await this.getDeviceFromDatabase(deviceId);
        const context = this.createErrorContext(deviceId, 'getFaceData', HIKVISION_ENDPOINTS.FACE_DATA);

        try {
            // Get secure session for face data operations
            const session = await this.sessionService.getSecureSession(this.deviceToConfig(device));

            const endpoint = this.buildEndpoint(this.deviceToConfig(device), HIKVISION_ENDPOINTS.FACE_DATA);            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    params: {
                        format: 'json',
                        employeeNo,
                        security: session.security,
                        identityKey: session.identityKey,
                    },
                    responseType: 'arraybuffer',
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );

            return Buffer.from(response.data);

        } catch (error) {
            if (error.response?.status === 404) {
                return null;
            }
            
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to get face data', { deviceId, employeeNo, error: exception.message });
            throw exception.toNestException();
        }
    }

    // ==================== Private Helper Methods ====================

    private async getDeviceFromDatabase(deviceId: string): Promise<Device> {
        const device = await this.prisma.device.findUnique({
            where: { id: deviceId },
        });

        if (!device || !device.ipAddress || !device.username || !device.password) {
            throw new HikvisionNotFoundException(
                this.createErrorContext(deviceId, 'getDeviceFromDatabase'),
                'device configuration'
            ).toNestException();
        }

        return device;
    }

    private async getDeviceConfigFromDatabase(deviceId: string): Promise<HikvisionDeviceConfig> {
        const device = await this.getDeviceFromDatabase(deviceId);

        return {
            deviceId: device.id,
            ipAddress: device.ipAddress,
            username: device.username,
            encryptedSecret: device.password,
        };
    }

    private deviceToConfig(device: Device): HikvisionDeviceConfig {
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

    private async validateDeviceConnection(device: HikvisionDeviceConfig): Promise<boolean> {
        try {
            const endpoint = this.buildEndpoint(device, HIKVISION_ENDPOINTS.DEVICE_INFO);
            const password = this.encryptionService.decrypt(device.encryptedSecret);
            
            await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: 5000, // Short timeout for validation
                })
            );

            return true;
        } catch (error) {
            this.logger.debug('Device connection validation failed', { 
                deviceId: device.deviceId, 
                error: error.message 
            });
            return false;
        }
    }

    private async getDeviceCapabilities(device: HikvisionDeviceConfig): Promise<any> {
        try {
            const endpoint = this.buildEndpoint(device, '/ISAPI/System/capabilities');
            const password = this.encryptionService.decrypt(device.encryptedSecret);
            
            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );

            return response.data;
        } catch (error) {
            this.logger.warn('Failed to get device capabilities', { 
                deviceId: device.deviceId, 
                error: error.message 
            });
            return null;
        }
    }

    private createErrorContext(deviceId: string, operation: string, endpoint?: string): HikvisionErrorContext {
        return {
            deviceId,
            operation,
            endpoint,
            correlationId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
    }

    private mapDeviceToDeviceInfo(device: Device): DeviceInfo {
        return {
            id: device.id,
            name: device.name || `Hikvision Device ${device.id}`,
            type: DeviceType.CAMERA, // Assuming Hikvision devices are cameras
            status: DeviceStatus.OFFLINE, // Will be updated by actual device status
            ipAddress: device.ipAddress,
            macAddress: device.macAddress,
            firmwareVersion: device.firmware,
            lastSeen: device.lastSeen,
            capabilities: [
                {
                    type: DeviceType.CAMERA,
                    enabled: true,
                    configuration: {
                        faceRecognition: true,
                        accessControl: true,
                    },
                },
            ],
        };
    }
}