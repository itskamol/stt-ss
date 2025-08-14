import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import {
    IDeviceAdapter,
    DeviceInfo,
    DeviceConfiguration,
    DeviceCommand,
    DeviceCommandResult,
    DeviceHealth,
    DeviceEvent,
    DeviceCapability,
} from '../../../interfaces';
import { DeviceOperationContext } from '@/modules/device/device-adapter.strategy';
import { DeviceType, DeviceStatus } from '@prisma/client';

// Import managers
import { HikvisionHttpClient } from './utils/hikvision-http.client';
import { XmlJsonService } from '@/shared/services/xml-json.service';
import {
    HikvisionFaceManager,
    HikvisionCardManager,
    HikvisionUserManager,
    HikvisionNFCManager,
    HikvisionConfigurationManager,
    // New ISAPI Managers
    HikvisionPersonManager,
    HikvisionFaceLibraryManager,
    HikvisionFingerprintManager,
    HikvisionEventHostManager,
    HikvisionScheduleManager,
    HikvisionSystemManager,
} from './managers';

@Injectable()
export class HikvisionAdapter implements IDeviceAdapter {
    // Original Manager instances
    public readonly face: HikvisionFaceManager;
    public readonly card: HikvisionCardManager;
    public readonly user: HikvisionUserManager;
    public readonly nfc: HikvisionNFCManager;
    public readonly configuration: HikvisionConfigurationManager;

    // New ISAPI Manager instances - bu sizning yangi imkoniyatlaringiz!
    public readonly person: HikvisionPersonManager;
    public readonly faceLibrary: HikvisionFaceLibraryManager;
    public readonly fingerprint: HikvisionFingerprintManager;
    public readonly eventHost: HikvisionEventHostManager;
    public readonly schedule: HikvisionScheduleManager;
    public readonly system: HikvisionSystemManager;

    constructor(
        private readonly logger: LoggerService,
        private readonly httpClient: HikvisionHttpClient,
        private readonly xmlJsonService: XmlJsonService
    ) {
        // Initialize original managers
        this.face = new HikvisionFaceManager(this.httpClient, this.logger);
        this.card = new HikvisionCardManager(this.httpClient, this.logger);
        this.user = new HikvisionUserManager(this.httpClient, this.logger);
        this.nfc = new HikvisionNFCManager(this.httpClient, this.logger);
        this.configuration = new HikvisionConfigurationManager(this.httpClient, this.logger, this.xmlJsonService);

        // Initialize new ISAPI managers
        this.person = new HikvisionPersonManager(this.httpClient, this.logger);
        this.faceLibrary = new HikvisionFaceLibraryManager(
            this.httpClient,
            this.logger,
            this.xmlJsonService
        );
        this.fingerprint = new HikvisionFingerprintManager(
            this.httpClient,
            this.logger,
            this.xmlJsonService
        );
        this.eventHost = new HikvisionEventHostManager(
            this.httpClient,
            this.logger,
            this.xmlJsonService
        );
        this.schedule = new HikvisionScheduleManager(this.httpClient, this.logger);
        this.system = new HikvisionSystemManager(this.httpClient, this.logger, this.xmlJsonService);
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

    async getDeviceInfo(context: DeviceOperationContext): Promise<DeviceInfo> {
        try {
            const { device, config } = context;

            // Use configuration manager to get device info
            const deviceInfo = await this.configuration.getDeviceInfo(config);
            console.log(deviceInfo);
            return {
                id: device.id,
                name: deviceInfo.deviceName,
                type: DeviceType.ACCESS_CONTROL,
                status: device.status,
                host: device.host,
                firmwareVersion: deviceInfo.firmwareVersion,
                lastSeen: device.lastSeen,
                capabilities: [
                    { type: DeviceType.ACCESS_CONTROL, enabled: true },
                    { type: DeviceType.OTHER, enabled: true },
                ] as DeviceCapability[],
            };
        } catch (error) {
            this.logger.error(`Failed to get device info: ${error.message}`, error.trace, {
                deviceId: context.device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async getDeviceConfiguration(context: DeviceOperationContext): Promise<DeviceConfiguration> {
        try {
            const { device, config } = context;

            // Use configuration manager
            const deviceConfig = await this.configuration.getConfiguration(config);

            return {
                deviceId: device.id,
                settings: {
                    network: deviceConfig.network,
                    authentication: deviceConfig.authentication,
                    access: deviceConfig.access,
                    time: deviceConfig.time,
                },
            } as DeviceConfiguration;
        } catch (error) {
            this.logger.error('Failed to get device configuration', error.message, {
                deviceId: context.device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async updateDeviceConfiguration(
        context: DeviceOperationContext,
        configuration: Partial<DeviceConfiguration>
    ): Promise<void> {
        try {
            const { device, config } = context;

            // Update different configuration sections using managers
            if (configuration.settings?.network) {
                await this.configuration.updateNetworkConfig(config, configuration.settings.network);
            }

            if (configuration.settings?.access) {
                await this.configuration.updateAccessConfig(config, configuration.settings.access);
            }

            if (configuration.settings?.authentication) {
                await this.configuration.updateAuthenticationConfig(
                    config,
                    configuration.settings.authentication
                );
            }

            this.logger.debug('Device configuration updated', {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });
        } catch (error) {
            this.logger.error('Failed to update device configuration', error.message, {
                deviceId: context.device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async sendCommand(context: DeviceOperationContext, command: DeviceCommand): Promise<DeviceCommandResult> {
        try {
            const device = context.device

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
                deviceId: context.device.id,
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

    async getDeviceHealth(context: DeviceOperationContext): Promise<DeviceHealth> {
        const device = context.device;
        try {

            // Get device info to check connectivity
            await this.configuration.getDeviceInfo(device);
            const nfcStatus = await this.nfc.getNFCReaderStatus(device);

            return {
                deviceId: device.id,
                status: device.status,
                uptime: 0, // Would need to get from device
                memoryUsage: 0, // Would need to get from device
                temperature: 0, // Would need to get from device
                lastHealthCheck: new Date(),
                issues:
                    nfcStatus.errorCount > 0
                        ? [`NFC reader has ${nfcStatus.errorCount} errors`]
                        : [],
            };
        } catch (error) {
            console.log(error);
            this.logger.error('Failed to get device health', error.message, {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });

            return {
                deviceId: device.id,
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

    async subscribeToEvents(
        context: DeviceOperationContext,
        callback: (event: DeviceEvent) => void
    ): Promise<void> {
        try {
            this.logger.debug('Subscribing to device events', {
                deviceId: context.device.id,
                module: 'hikvision-v2-adapter',
            });

            // Implementation would set up event subscription
            // For now, just log that subscription is set up
        } catch (error) {
            this.logger.error('Failed to subscribe to events', error.message, {
                deviceId: context.device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async unsubscribeFromEvents(context: DeviceOperationContext): Promise<void> {
        try {
            this.logger.debug('Unsubscribing from device events', {
                deviceId: context.device.id,
                module: 'hikvision-v2-adapter',
            });

            // Implementation would clean up event subscription
        } catch (error) {
            this.logger.error('Failed to unsubscribe from events', error.message, {
                deviceId: context.device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async syncUsers(
        context: DeviceOperationContext,
        users: Array<{
            userId: string;
            cardId?: string;
            biometricData?: string;
            accessLevel: number;
        }>
    ): Promise<void> {
        const device = context.device;

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
                    deviceId: context.device.id,
                    userId: userData.userId,
                    module: 'hikvision-v2-adapter',
                });
                // Continue with next user
            }
        }
    }

    async removeUser(context: DeviceOperationContext, userId: string): Promise<void> {
        const device = context.device;

        try {
            await this.user.deleteUser(device, userId);
            this.logger.debug('User removed successfully', {
                deviceId: context.device.id,
                userId,
                module: 'hikvision-v2-adapter',
            });
        } catch (error) {
            this.logger.error('Failed to remove user', error.message, {
                deviceId: context.device.id,
                userId,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async testConnection(context: DeviceOperationContext): Promise<boolean> {
        try {
            const device = context.device;

            if (!device) {
                return false;
            }

            // Try to get device info to test connection
            await this.configuration.getDeviceInfo(device);
            return true;
        } catch (error) {
            this.logger.error('Connection test failed', error.message, {
                deviceId: context.device.id,
                module: 'hikvision-v2-adapter',
            });
            return false;
        }
    }

    async rebootDevice(context: DeviceOperationContext): Promise<void> {
        const device = context.device;

        try {
            await this.configuration.rebootDevice(device);
            this.logger.debug('Device reboot initiated', {
                deviceId: context.device.id,
                module: 'hikvision-v2-adapter',
            });
        } catch (error) {
            this.logger.error('Failed to reboot device', error.message, {
                deviceId: context.device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async updateFirmware(
        context: DeviceOperationContext,
        firmwareUrl: string
    ): Promise<{ success: boolean; message: string }> {
        try {
            // Implementation would handle firmware update
            // For now, just return success
            this.logger.debug('Firmware update initiated', {
                deviceId: context.device.id,
                firmwareUrl,
                module: 'hikvision-v2-adapter',
            });

            return {
                success: true,
                message: 'Firmware update initiated successfully',
            };
        } catch (error) {
            this.logger.error('Failed to update firmware', error.message, {
                deviceId: context.device.id,
                firmwareUrl,
                module: 'hikvision-v2-adapter',
            });

            return {
                success: false,
                message: error.message,
            };
        }
    }

    async getDeviceLogs(context: DeviceOperationContext, startDate?: Date, endDate?: Date): Promise<string[]> {
        try {
            const device = context.device;

            // Implementation would fetch logs from device
            // For now, return empty array
            this.logger.debug('Fetching device logs', {
                deviceId: context.device.id,
                startDate,
                endDate,
                module: 'hikvision-v2-adapter',
            });

            return [];
        } catch (error) {
            this.logger.error('Failed to get device logs', error.message, {
                deviceId: context.device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async clearDeviceLogs(context: DeviceOperationContext): Promise<void> {
        try {
            const device = context.device;

            if (!device) {
                throw new Error(`Devid} not found`);
            }

            // Implementation would clear logs on device
            this.logger.debug('Clearing device logs', {
                deviceId: context.device.id,
                module: 'hikvision-v2-adapter',
            });
        } catch (error) {
            this.logger.error('Failed to clear device logs', error.message, {
                deviceId: context.device.id,
                module: 'hikvisiapter',
            });
            throw error;
        }
    }

    // ==================== Convenience Met==============
    /**
     * Bulk add users with all their credentials
     */
    async bulkAddUsers(
        context: DeviceOperationContext,
        users: Array<{
            employeeNo: string;
            name: string;
            faceData?: string;
            cardNo?: string;
            nfcId?: string;
        }>
    ): Promise<void> {
        const device = context.device;

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
                    deviceId: context.device.id,
                    employeeNo: userData.employeeNo,
                    module: 'hikvision-v2-adapter',
                });
            } catch (error) {
                this.logger.error('Failed to add user', error.message, {
                    deviceId: context.device.id,
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
    async getUserComplete(context: DeviceOperationContext, employeeNo: string) {
        const device = context.device;

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

    // ==================== New ISAPI Methods ====================

    /**
     * Advanced person management with ISAPI
     */
    async searchPersons(
        context: DeviceOperationContext,
        searchCriteria: {
            searchID?: string;
            maxResults?: number;
            employeeNoList?: string[];
        }
    ) {
        const device = context.device;

        return await this.person.searchPersons(device, {
            UserInfoSearchCond: {
                searchID: searchCriteria.searchID || `search_${Date.now()}`,
                searchResultPosition: 0,
                maxResults: searchCriteria.maxResults || 100,
                EmployeeNoList: searchCriteria.employeeNoList?.map(no => ({ employeeNo: no })),
            },
        });
    }

    /**
     * Advanced face library management
     */
    async createFaceLibrary(
        context: DeviceOperationContext,
        libraryData: {
            faceLibType: 'blackFD' | 'staticFD';
            name: string;
            customInfo?: string;
            FDID: string;
        }
    ) {
        const device = context.device;

        return await this.faceLibrary.createFaceLibrary(device, libraryData);
    }

    /**
     * Add face picture with image data
     */
    async addFacePictureWithImage(
        context: DeviceOperationContext,
        faceData: {
            faceLibType: string;
            FDID: string;
            name: string;
            employeeNo?: string;
        },
        imageBuffer: Buffer
    ) {
        const device = context.device;

        return await this.faceLibrary.addFacePicture(device, faceData, imageBuffer);
    }

    /**
     * Fingerprint management
     */
    async addFingerprint(
        context: DeviceOperationContext,
        fingerprintData: {
            employeeNo: string;
            fingerPrintID: string;
            fingerType: string;
            fingerData: string;
        }
    ) {
        const device = context.device;

        return await this.fingerprint.addFingerprint(device, fingerprintData);
    }

    /**
     * Configure event notification hosts
     */
    async configureEventHost(
        context: DeviceOperationContext,
        hostID: string,
        hostConfig: {
            url: string;
            host: string;
            port: number;
            protocolType?: 'HTTP' | 'HTTPS';
            parameterFormatType?: 'XML' | 'JSON';
            eventTypes?: string[];
        }
    ) {
        const device = context.device;

        const hostNotification = this.eventHost.createBasicHostConfig(
            hostID,
            hostConfig.url,
            hostConfig.host,
            hostConfig.port,
            {
                protocolType: hostConfig.protocolType,
                parameterFormatType: hostConfig.parameterFormatType,
            }
        );

        if (hostConfig.eventTypes && hostConfig.eventTypes.length > 0) {
            hostNotification.SubscribeEvent = this.eventHost.createEventSubscription(
                hostConfig.eventTypes
            );
        }

        return await this.eventHost.setListeningHost(device, hostID, hostNotification);
    }

    /**
     * Schedule management
     */
    async createWeekSchedule(
        context: DeviceOperationContext,
        planNo: number,
        schedule: {
            timeSegments: Array<{
                week:
                    | 'Monday'
                    | 'Tuesday'
                    | 'Wednesday'
                    | 'Thursday'
                    | 'Friday'
                    | 'Saturday'
                    | 'Sunday';
                beginTime: string;
                endTime: string;
                enabled?: boolean;
            }>;
        }
    ) {
        const device = context.device;

        const weekPlan = this.schedule.createBasicWeekPlan(schedule.timeSegments);
        return await this.schedule.setWeekPlan(device, planNo, weekPlan);
    }

    /**
     * System user management
     */
    async createSystemUser(
        context: DeviceOperationContext,
        userData: {
            id: number;
            userName: string;
            password: string;
            userLevel?: 'Administrator' | 'Operator' | 'Viewer';
            enabled?: boolean;
        }
    ) {
        const device = context.device;

        const userInfo = this.system.createBasicUser(
            userData.id,
            userData.userName,
            userData.password,
            userData.userLevel,
            userData.enabled
        );

        return await this.system.setUser(device, userData.id, userInfo);
    }

    /**
     * Card reader configuration
     */
    async configureCardReader(
        context: DeviceOperationContext,
        cardReaderID: number,
        config: Partial<{
            enable: boolean;
            swipeInterval: number;
            faceMatchThreshold: number;
            fingerPrintCheckLevel: number;
            defaultVerifyMode: string;
            cardReaderFunction: string[];
        }>
    ) {
        const device = context.device;

        const cardReaderConfig = this.system.createBasicCardReaderConfig(config);
        return await this.system.setCardReaderConfig(device, cardReaderID, cardReaderConfig);
    }

    /**
     * Get device capabilities for different features
     */
    async getDeviceCapabilities(context: DeviceOperationContext) {
        const device = context.device;

        const [
            faceLibrarySupport,
            fingerprintSupport,
            personCapabilities,
            faceLibraryCapabilities,
            fingerprintCapabilities,
            scheduleCapabilities,
            cardReaderCapabilities,
        ] = await Promise.allSettled([
            this.faceLibrary.checkFaceLibrarySupport(device),
            this.fingerprint.checkFingerprintSupport(device),
            this.person.getPersonCapabilities(device),
            this.faceLibrary.getFaceLibraryCapabilities(device),
            this.fingerprint.getFingerprintCapabilities(device),
            this.schedule.getWeekPlanCapabilities(device),
            this.system.getCardReaderCapabilities(device),
        ]);

        return {
            faceLibrarySupport:
                faceLibrarySupport.status === 'fulfilled' ? faceLibrarySupport.value : false,
            fingerprintSupport:
                fingerprintSupport.status === 'fulfilled' ? fingerprintSupport.value : false,
            capabilities: {
                person: personCapabilities.status === 'fulfilled' ? personCapabilities.value : null,
                faceLibrary:
                    faceLibraryCapabilities.status === 'fulfilled'
                        ? faceLibraryCapabilities.value
                        : null,
                fingerprint:
                    fingerprintCapabilities.status === 'fulfilled'
                        ? fingerprintCapabilities.value
                        : null,
                schedule:
                    scheduleCapabilities.status === 'fulfilled' ? scheduleCapabilities.value : null,
                cardReader:
                    cardReaderCapabilities.status === 'fulfilled'
                        ? cardReaderCapabilities.value
                        : null,
            },
        };
    }

    /**
     * Comprehensive device status check
     */
    async getComprehensiveDeviceStatus(context: DeviceOperationContext) {
        const device = context.device;

        const [
            deviceHealth,
            personCount,
            faceLibraryCount,
            fingerprintCount,
            eventHosts,
            systemUsers,
        ] = await Promise.allSettled([
            this.getDeviceHealth(context),
            this.person.getPersonCount(device),
            this.faceLibrary.getFaceLibraryCount(device),
            this.fingerprint.getFingerprintCount(device),
            this.eventHost.getAllListeningHosts(device),
            this.system.getAllUsers(device),
        ]);

        return {
            health: deviceHealth.status === 'fulfilled' ? deviceHealth.value : null,
            counts: {
                persons: personCount.status === 'fulfilled' ? personCount.value : 0,
                faceLibraries:
                    faceLibraryCount.status === 'fulfilled'
                        ? faceLibraryCount.value.totalRecordDataNumber
                        : 0,
                fingerprints: fingerprintCount.status === 'fulfilled' ? fingerprintCount.value : 0,
                eventHosts: eventHosts.status === 'fulfilled' ? eventHosts.value.length : 0,
                systemUsers: systemUsers.status === 'fulfilled' ? systemUsers.value.length : 0,
            },
            lastChecked: new Date(),
        };
    }
}
