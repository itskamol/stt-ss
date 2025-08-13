import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { PrismaService } from '@/core/database/prisma.service';
import {
    IDeviceAdapter,
    DeviceInfo,
    DeviceConfiguration,
    DeviceCommand,
    DeviceCommandResult,
    DeviceHealth,
    DeviceEvent,
    DeviceCapability
} from '../../../interfaces';
import { DeviceType, DeviceStatus } from '@prisma/client';

// Import managers
import { HikvisionHttpClient } from './utils/hikvision-http.client';
import {
    HikvisionFaceManager,
    HikvisionCardManager,
    HikvisionUserManager,
    HikvisionNFCManager,
    HikvisionConfigurationManager
} from './managers';

@Injectable()
export class HikvisionV2Adapter implements IDeviceAdapter {
    // Manager instances - bu sizning asosiy afzalligingiz!
    public readonly face: HikvisionFaceManager;
    public readonly card: HikvisionCardManager;
    public readonly user: HikvisionUserManager;
    public readonly nfc: HikvisionNFCManager;
    public readonly configuration: HikvisionConfigurationManager;

    constructor(
        private readonly logger: LoggerService,
        private readonly prisma: PrismaService,
        private readonly httpClient: HikvisionHttpClient,
    ) {
        // Initialize managers
        this.face = new HikvisionFaceManager(this.httpClient, this.logger);
        this.card = new HikvisionCardManager(this.httpClient, this.logger);
        this.user = new HikvisionUserManager(this.httpClient, this.logger);
        this.nfc = new HikvisionNFCManager(this.httpClient, this.logger);
        this.configuration = new HikvisionConfigurationManager(this.httpClient, this.logger);
    }

    // ==================== IDeviceAdapter Implementation ====================

    async discoverDevices(): Promise<DeviceInfo[]> {
        try {
            this.logger.debug('Discovering Hikvision devices', {
                module: 'hikvision-v2-adapter',
            });

            // Device discovery logic
            // This would typically scan network for Hikvision devices
            return [];
        } catch (error) {
            this.logger.error('Failed to discover devices', error.message, {
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async getDeviceInfo(deviceId: string): Promise<DeviceInfo> {
        try {
            const device = await this.prisma.device.findUnique({
                where: { id: deviceId },
            });

            if (!device) {
                throw new Error(`Device ${deviceId} not found`);
            }

            // Use configuration manager to get device info
            const deviceInfo = await this.configuration.getDeviceInfo(device);

            return {
                id: device.id,
                name: deviceInfo.deviceName,
                type: DeviceType.ACCESS_CONTROL,
                status: device.status,
                ipAddress: device.ipAddress,
                firmwareVersion: deviceInfo.firmwareVersion,
                lastSeen: device.lastSeen,
                capabilities: [
                    { type: DeviceType.ACCESS_CONTROL, enabled: true },
                    { type: DeviceType.OTHER, enabled: true },
                ] as DeviceCapability[],
            };
        } catch (error) {
            this.logger.error('Failed to get device info', error.message, {
                deviceId,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async getDeviceConfiguration(deviceId: string): Promise<DeviceConfiguration> {
        try {
            const device = await this.prisma.device.findUnique({
                where: { id: deviceId },
            });

            if (!device) {
                throw new Error(`Device ${deviceId} not found`);
            }

            // Use configuration manager
            const config = await this.configuration.getConfiguration(device);

            return {
                deviceId,
                settings: {
                    network: config.network,
                    authentication: config.authentication,
                    access: config.access,
                    time: config.time,
                },
            } as DeviceConfiguration;
        } catch (error) {
            this.logger.error('Failed to get device configuration', error.message, {
                deviceId,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async updateDeviceConfiguration(deviceId: string, config: Partial<DeviceConfiguration>): Promise<void> {
        try {
            const device = await this.prisma.device.findUnique({
                where: { id: deviceId },
            });

            if (!device) {
                throw new Error(`Device ${deviceId} not found`);
            }

            // Update different configuration sections using managers
            if (config.settings?.network) {
                await this.configuration.updateNetworkConfig(device, config.settings.network);
            }

            if (config.settings?.access) {
                await this.configuration.updateAccessConfig(device, config.settings.access);
            }

            if (config.settings?.authentication) {
                await this.configuration.updateAuthenticationConfig(device, config.settings.authentication);
            }

            this.logger.debug('Device configuration updated', {
                deviceId,
                module: 'hikvision-v2-adapter',
            });
        } catch (error) {
            this.logger.error('Failed to update device configuration', error.message, {
                deviceId,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async sendCommand(deviceId: string, command: DeviceCommand): Promise<DeviceCommandResult> {
        try {
            const device = await this.prisma.device.findUnique({
                where: { id: deviceId },
            });

            if (!device) {
                throw new Error(`Device ${deviceId} not found`);
            }

            let result: any;

            // Route commands to appropriate managers
            switch (command.command) {
                case 'unlock_door':
                    result = await this.httpClient.request(device, {
                        method: 'PUT',
                        url: '/ISAPI/AccessControl/RemoteControl/door/1',
                        data: { cmd: 'open' },
                    });
                    break;

                case 'lock_door':
                    result = await this.httpClient.request(device, {
                        method: 'PUT',
                        url: '/ISAPI/AccessControl/RemoteControl/door/1',
                        data: { cmd: 'close' },
                    });
                    break;

                case 'reboot':
                    result = await this.configuration.rebootDevice(device);
                    break;

                case 'sync_users':
                    // Handle user sync
                    result = { message: 'User sync initiated' };
                    break;

                case 'update_firmware':
                    // Handle firmware update
                    result = { message: 'Firmware update initiated' };
                    break;

                default:
                    throw new Error(`Unsupported command: ${command.command}`);
            }

            return {
                success: true,
                data: result,
                executedAt: new Date(),
            };
        } catch (error) {
            this.logger.error('Failed to execute command', error.message, {
                deviceId,
                command: command.command,
                module: 'hikvision-v2-adapter',
            });

            return {
                success: false,
                message: error.message,
                executedAt: new Date(),
            };
        }
    }

    async getDeviceHealth(deviceId: string): Promise<DeviceHealth> {
        try {
            const device = await this.prisma.device.findUnique({
                where: { id: deviceId },
            });

            if (!device) {
                throw new Error(`Device ${deviceId} not found`);
            }

            // Get device info to check connectivity
            await this.configuration.getDeviceInfo(device);
            const nfcStatus = await this.nfc.getNFCReaderStatus(device);

            return {
                deviceId,
                status: device.status,
                uptime: 0, // Would need to get from device
                memoryUsage: 0, // Would need to get from device
                temperature: 0, // Would need to get from device
                lastHealthCheck: new Date(),
                issues: nfcStatus.errorCount > 0 ? [`NFC reader has ${nfcStatus.errorCount} errors`] : [],
            };
        } catch (error) {
            this.logger.error('Failed to get device health', error.message, {
                deviceId,
                module: 'hikvision-v2-adapter',
            });

            const device = await this.prisma.device.findUnique({
                where: { id: deviceId },
            });

            return {
                deviceId,
                status: device?.status || DeviceStatus.OFFLINE,
                uptime: 0,
                memoryUsage: 0,
                temperature: 0,
                lastHealthCheck: new Date(),
                issues: [error.message],
            };
        }
    }

    // ==================== IDeviceAdapter Required Methods ====================

    async subscribeToEvents(deviceId: string, callback: (event: DeviceEvent) => void): Promise<void> {
        try {
            this.logger.debug('Subscribing to device events', {
                deviceId,
                module: 'hikvision-v2-adapter',
            });

            // Implementation would set up event subscription
            // For now, just log that subscription is set up
        } catch (error) {
            this.logger.error('Failed to subscribe to events', error.message, {
                deviceId,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async unsubscribeFromEvents(deviceId: string): Promise<void> {
        try {
            this.logger.debug('Unsubscribing from device events', {
                deviceId,
                module: 'hikvision-v2-adapter',
            });

            // Implementation would clean up event subscription
        } catch (error) {
            this.logger.error('Failed to unsubscribe from events', error.message, {
                deviceId,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async syncUsers(deviceId: string, users: Array<{
        userId: string;
        cardId?: string;
        biometricData?: string;
        accessLevel: number;
    }>): Promise<void> {
        const device = await this.prisma.device.findUnique({
            where: { id: deviceId },
        });

        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        for (const userData of users) {
            try {
                // Add user
                await this.user.addUser(device, {
                    employeeNo: userData.userId,
                    name: userData.userId, // Would need actual name
                });

                // Add card if provided
                if (userData.cardId) {
                    await this.card.addCard(device, {
                        cardNo: userData.cardId,
                        userId: userData.userId,
                        employeeNo: userData.userId,
                    });
                }

                // Add biometric if provided
                if (userData.biometricData) {
                    await this.face.addFace(device, {
                        userId: userData.userId,
                        faceData: userData.biometricData,
                        employeeNo: userData.userId,
                    });
                }
            } catch (error) {
                this.logger.error('Failed to sync user', error.message, {
                    deviceId,
                    userId: userData.userId,
                    module: 'hikvision-v2-adapter',
                });
                // Continue with next user
            }
        }
    }

    async removeUser(deviceId: string, userId: string): Promise<void> {
        const device = await this.prisma.device.findUnique({
            where: { id: deviceId },
        });

        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        try {
            await this.user.deleteUser(device, userId);
            this.logger.debug('User removed successfully', {
                deviceId,
                userId,
                module: 'hikvision-v2-adapter',
            });
        } catch (error) {
            this.logger.error('Failed to remove user', error.message, {
                deviceId,
                userId,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async testConnection(deviceId: string): Promise<boolean> {
        try {
            const device = await this.prisma.device.findUnique({
                where: { id: deviceId },
            });

            if (!device) {
                return false;
            }

            // Try to get device info to test connection
            await this.configuration.getDeviceInfo(device);
            return true;
        } catch (error) {
            this.logger.error('Connection test failed', error.message, {
                deviceId,
                module: 'hikvision-v2-adapter',
            });
            return false;
        }
    }

    async rebootDevice(deviceId: string): Promise<void> {
        const device = await this.prisma.device.findUnique({
            where: { id: deviceId },
        });

        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        try {
            await this.configuration.rebootDevice(device);
            this.logger.debug('Device reboot initiated', {
                deviceId,
                module: 'hikvision-v2-adapter',
            });
        } catch (error) {
            this.logger.error('Failed to reboot device', error.message, {
                deviceId,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async updateFirmware(deviceId: string, firmwareUrl: string): Promise<{ success: boolean; message: string }> {
        try {
            const device = await this.prisma.device.findUnique({
                where: { id: deviceId },
            });

            if (!device) {
                throw new Error(`Device ${deviceId} not found`);
            }

            // Implementation would handle firmware update
            // For now, just return success
            this.logger.debug('Firmware update initiated', {
                deviceId,
                firmwareUrl,
                module: 'hikvision-v2-adapter',
            });

            return {
                success: true,
                message: 'Firmware update initiated successfully',
            };
        } catch (error) {
            this.logger.error('Failed to update firmware', error.message, {
                deviceId,
                firmwareUrl,
                module: 'hikvision-v2-adapter',
            });

            return {
                success: false,
                message: error.message,
            };
        }
    }

    async getDeviceLogs(deviceId: string, startDate?: Date, endDate?: Date): Promise<string[]> {
        try {
            const device = await this.prisma.device.findUnique({
                where: { id: deviceId },
            });

            if (!device) {
                throw new Error(`Device ${deviceId} not found`);
            }

            // Implementation would fetch logs from device
            // For now, return empty array
            this.logger.debug('Fetching device logs', {
                deviceId,
                startDate,
                endDate,
                module: 'hikvision-v2-adapter',
            });

            return [];
        } catch (error) {
            this.logger.error('Failed to get device logs', error.message, {
                deviceId,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async clearDeviceLogs(deviceId: string): Promise<void> {
        try {
            const device = await this.prisma.device.findUnique({
                where: { id: deviceId },
            });

            if (!device) {
                throw new Error(`Devid} not found`);
            }

            // Implementation would clear logs on device
            this.logger.debug('Clearing device logs', {
                deviceId,
                module: 'hikvision-v2-adapter',
            });
        } catch (error) {
            this.logger.error('Failed to clear device logs', error.message, {
                deviceId,
                module: 'hikvisiapter',
            });
            throw error;
        }
    }

    // ==================== Convenience Met==============
    /**
     * Bulk add users with all their credentials
     */
    async bulkAddUsers(deviceId: string, users: Array<{
        employeeNo: string;
        name: string;
        faceData?: string;
        cardNo?: string;
        nfcId?: string;
    }>): Promise<void> {
        const device = await this.prisma.device.findUnique({
            where: { id: deviceId },
        });

        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        for (const userData of users) {
            try {
                // Add user
                await this.user.addUser(device, {
                    employeeNo: userData.employeeNo,
                    name: userData.name,
                });

                // Add face if provided
                if (userData.faceData) {
                    await this.face.addFace(device, {
                        userId: userData.employeeNo,
                        faceData: userData.faceData,
                        employeeNo: userData.employeeNo,
                    });
                }

                // Add card if provided
                if (userData.cardNo) {
                    await this.card.addCard(device, {
                        cardNo: userData.cardNo,
                        userId: userData.employeeNo,
                        employeeNo: userData.employeeNo,
                    });
                }

                // Add NFC if provided
                if (userData.nfcId) {
                    await this.nfc.addNFC(device, {
                        nfcId: userData.nfcId,
                        userId: userData.employeeNo,
                        employeeNo: userData.employeeNo,
                    });
                }

                this.logger.debug('User added successfully', {
                    deviceId,
                    employeeNo: userData.employeeNo,
                    module: 'hikvision-v2-adapter',
                });
            } catch (error) {
                this.logger.error('Failed to add user', error.message, {
                    deviceId,
                    employeeNo: userData.employeeNo,
                    module: 'hikvision-v2-adapter',
                });
                // Continue with next user
            }
        }
    }

    /**
     * Get complete user information including all credentials
     */
    async getUserComplete(deviceId: string, employeeNo: string) {
        const device = await this.prisma.device.findUnique({
            where: { id: deviceId },
        });

        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        const [users, faces, cards, nfcs] = await Promise.all([
            this.user.getUsers(device, employeeNo),
            this.face.getFaces(device, employeeNo),
            this.card.getCards(device, employeeNo),
            this.nfc.getNFCs(device, employeeNo),
        ]);

        return {
            user: users[0] || null,
            faces,
            cards,
            nfcs,
        };
    }
}