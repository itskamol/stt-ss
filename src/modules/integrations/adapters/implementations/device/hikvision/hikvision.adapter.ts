import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import {
    DeviceCapability,
    DeviceCommand,
    DeviceCommandResult,
    DeviceConfiguration,
    DeviceEvent,
    DeviceHealth,
    DeviceInfo,
    IDeviceAdapter,
} from '../../../interfaces';
import { DeviceOperationContext } from '@/modules/device/device-adapter.strategy';
import { Device, DeviceStatus, DeviceType } from '@prisma/client';

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

    private readonly deviceTypes = {
        [DeviceType.CAMERA]: [
            'BladePS',
            'CVR',
            'DVR',
            'DVS',
            'HybirdNVR',
            'IPCamera',
            'IPDome',
            'IPZoom',
            'NVR',
            'lightFace',
            'Visitor',
            'bodyCamera',
            'videoMatrix',
        ],
        [DeviceType.CARD_READER]: ['RFID', 'PersonnelChannel'],
        [DeviceType.FINGERPRINT]: ['FS'],
        [DeviceType.ANPR]: ['HA'],
        [DeviceType.ACCESS_CONTROL]: [
            'DM',
            'DMbehavior',
            'DockStation',
            'FA',
            'FD',
            'HAWK',
            'MCU',
            'PHA',
            'PHAPro',
            'ACS',
            'VIS',
            'FacePaymentTerminal',
            'InteractiveTerminal',
            'Cabinet',
            'ElevatorControl',
            'PanicAlarmPanel',
            'PersonnelChannel',
        ],
        [DeviceType.OTHER]: [
            'Blade',
            'InfoReleaseSys',
            'InfoTerminal',
            'PURE',
            'SipServer',
            'Switch',
            'VoiceSpeaker',
            'PowerAmplifier',
            'FireControlMatrix',
            'PagingMicrophone',
            'conferencePlat',
            'AIOT',
            'OPCA',
            'NetworkReceiver',
            'EmbeddedCentralController',
            'networkMic',
            'IPA',
            'MediaComponentGateway',
        ],
    };

    constructor(
        private readonly logger: LoggerService,
        private readonly httpClient: HikvisionHttpClient,
        private readonly xmlJsonService: XmlJsonService
    ) {
        // Initialize original managers
        this.face = new HikvisionFaceManager(this.httpClient, this.logger, this.xmlJsonService);
        this.card = new HikvisionCardManager(this.httpClient, this.logger);
        this.user = new HikvisionUserManager(this.httpClient, this.logger, this.xmlJsonService);
        this.nfc = new HikvisionNFCManager(this.httpClient, this.logger);
        this.configuration = new HikvisionConfigurationManager(
            this.httpClient,
            this.logger,
            this.xmlJsonService
        );

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

    async getDeviceInfo(device: Device): Promise<DeviceInfo> {
        try {
            // Use configuration manager to get device info
            const deviceInfo = await this.configuration.getDeviceInfo(device);
            const capabilities = await this.configuration.getDeviceCapabilities(device);

            const deviceType: any = Object.keys(this.deviceTypes).find(type =>
                this.deviceTypes[type].includes(deviceInfo.deviceType)
            );

            return {
                name: deviceInfo.deviceName || deviceInfo.name || 'Hikvision Device',
                deviceId:
                    deviceInfo.deviceID ||
                    deviceInfo.deviceId ||
                    deviceInfo.serialNumber ||
                    device.id,
                model: deviceInfo.model || 'Unknown Model',
                serialNumber: deviceInfo.serialNumber || '',
                macAddress: deviceInfo.macAddress || '',
                firmwareVersion: deviceInfo.firmwareVersion || 'Unknown',
                firmwareReleasedDate: deviceInfo.firmwareReleasedDate,
                deviceType: deviceType || 'ACCESS_CONTROL',
                manufacturer: deviceInfo.manufacturer || 'Hikvision',
                capabilities: capabilities,
                status: 'online',
            };
        } catch (error) {
            this.logger.error(`Failed to get device info: ${error.message}`, error.trace, {
                host: device.host,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async getDeviceConfiguration(device: Device): Promise<DeviceConfiguration> {
        try {
            // Use configuration manager
            const deviceConfig = await this.configuration.getConfiguration(device);

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
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async updateDeviceConfiguration(
        device: Device,
        configuration: Partial<DeviceConfiguration>
    ): Promise<void> {
        try {
            // Update different configuration sections using managers
            if (configuration.settings?.network) {
                await this.configuration.updateNetworkConfig(
                    device,
                    configuration.settings.network
                );
            }

            if (configuration.settings?.access) {
                await this.configuration.updateAccessConfig(device, configuration.settings.access);
            }

            if (configuration.settings?.authentication) {
                await this.configuration.updateAuthenticationConfig(
                    device,
                    configuration.settings.authentication
                );
            }

            this.logger.debug('Device configuration updated', {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });
        } catch (error) {
            this.logger.error('Failed to update device configuration', error.message, {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async sendCommand(device: Device, command: DeviceCommand): Promise<DeviceCommandResult> {
        try {
            let result: any;

            // Route commands to appropriate managers
            switch (command.command) {
                case 'unlock_door':
                    result = await this.httpClient.request(device, {
                        method: 'PUT',
                        url: '/ISAPI/AccessControl/RemoteControl/door/1',
                        data: { RemoteControlDoor: { cmd: 'open' } },
                        headers: {
                            'Content-Type': 'application/xml',
                        },
                    });
                    break;

                case 'lock_door':
                    result = await this.httpClient.request(device, {
                        method: 'PUT',
                        url: '/ISAPI/AccessControl/RemoteControl/door/1',
                        data: { RemoteControlDoor: { cmd: 'close' } },
                        headers: {
                            'Content-Type': 'application/xml',
                        },
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

                case 'configure_webhook':
                    const {
                        hostId,
                        url,
                        host,
                        port,
                        eventTypes,
                        protocolType,
                        parameterFormatType,
                    } = command.parameters;

                    this.logger.debug('Configuring webhook on device', {
                        deviceId: device.id,
                        hostId,
                        url,
                        eventTypes,
                    });

                    const hostNotification = this.eventHost.createBasicHostConfig(
                        hostId,
                        url,
                        host,
                        port,
                        {
                            protocolType: protocolType || 'HTTP',
                            parameterFormatType: parameterFormatType || 'JSON',
                        }
                    );

                    if (eventTypes && eventTypes.length > 0) {
                        hostNotification.SubscribeEvent =
                            this.eventHost.createEventSubscription(eventTypes);
                    }

                    result = await this.eventHost.setListeningHost(
                        device,
                        hostId,
                        hostNotification
                    );

                    this.logger.debug('Webhook configured successfully', {
                        deviceId: device.id,
                        hostId,
                        statusCode: result.statusCode,
                    });
                    break;

                case 'remove_webhook':
                    this.logger.debug('Removing webhook from device', {
                        deviceId: device.id,
                        hostId: command.parameters.hostId,
                    });

                    result = await this.eventHost.deleteListeningHost(
                        device,
                        command.parameters.hostId
                    );

                    this.logger.debug('Webhook removed successfully', {
                        deviceId: device.id,
                        hostId: command.parameters.hostId,
                        statusCode: result.statusCode,
                    });
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
                deviceId: device.id,
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

    async getDeviceHealth(device: Device): Promise<DeviceHealth> {
        try {
            // Get device info to check connectivity
            const result = await this.configuration.getDeviceInfo(device);
            // const nfcStatus = await this.nfc.getNFCReaderStatus(device);

            return {
                deviceId: device.id,
                status: device.status,
                uptime: 0, // Would need to get from device
                memoryUsage: 0, // Would need to get from device
                temperature: 0, // Would need to get from device
                lastHealthCheck: new Date(),
                issues: [],
                // nfcStatus.errorCount > 0
                //     ? [`NFC reader has ${nfcStatus.errorCount} errors`]
                //     : [],
            };
        } catch (error) {
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

    async subscribeToEvents(device: Device, callback: (event: DeviceEvent) => void): Promise<void> {
        try {
            this.logger.debug('Subscribing to device events', {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });

            // Implementation would set up event subscription
            // For now, just log that subscription is set up
        } catch (error) {
            this.logger.error('Failed to subscribe to events', error.message, {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async unsubscribeFromEvents(device: Device): Promise<void> {
        try {
            this.logger.debug('Unsubscribing from device events', {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });

            // Implementation would clean up event subscription
        } catch (error) {
            this.logger.error('Failed to unsubscribe from events', error.message, {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async syncUsers(
        device: Device,
        users: Array<{
            userId: string;
            cardId?: string;
            biometricData?: string;
            accessLevel: number;
        }>
    ): Promise<void> {
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
                    deviceId: device.id,
                    userId: userData.userId,
                    module: 'hikvision-v2-adapter',
                });
                // Continue with next user
            }
        }
    }

    async removeUser(device: Device, userId: string): Promise<void> {
        try {
            await this.user.deleteUser(device, userId);
            this.logger.debug('User removed successfully', {
                deviceId: device.id,
                userId,
                module: 'hikvision-v2-adapter',
            });
        } catch (error) {
            this.logger.error('Failed to remove user', error.message, {
                deviceId: device.id,
                userId,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async testConnection(device: Device): Promise<boolean> {
        try {
            if (!device) {
                return false;
            }

            // Try to get device info to test connection
            await this.configuration.getDeviceInfo(device);
            return true;
        } catch (error) {
            this.logger.error('Connection test failed', error.message, {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });
            return false;
        }
    }

    async rebootDevice(device: Device): Promise<void> {
        try {
            await this.configuration.rebootDevice(device);
            this.logger.debug('Device reboot initiated', {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });
        } catch (error) {
            this.logger.error('Failed to reboot device', error.message, {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async updateFirmware(
        device: Device,
        firmwareUrl: string
    ): Promise<{ success: boolean; message: string }> {
        try {
            // Implementation would handle firmware update
            // For now, just return success
            this.logger.debug('Firmware update initiated', {
                deviceId: device.id,
                firmwareUrl,
                module: 'hikvision-v2-adapter',
            });

            return {
                success: true,
                message: 'Firmware update initiated successfully',
            };
        } catch (error) {
            this.logger.error('Failed to update firmware', error.message, {
                deviceId: device.id,
                firmwareUrl,
                module: 'hikvision-v2-adapter',
            });

            return {
                success: false,
                message: error.message,
            };
        }
    }

    async getDeviceLogs(device: Device, startDate?: Date, endDate?: Date): Promise<string[]> {
        try {
            // Implementation would fetch logs from device
            // For now, return empty array
            this.logger.debug('Fetching device logs', {
                deviceId: device.id,
                startDate,
                endDate,
                module: 'hikvision-v2-adapter',
            });

            return [];
        } catch (error) {
            this.logger.error('Failed to get device logs', error.message, {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    async clearDeviceLogs(device: Device): Promise<void> {
        try {
            // Implementation would clear logs on device
            this.logger.debug('Clearing device logs', {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });
        } catch (error) {
            this.logger.error('Failed to clear device logs', error.message, {
                deviceId: device.id,
                module: 'hikvision-v2-adapter',
            });
            throw error;
        }
    }

    // ==================== Convenience Met==============
    /**
     * Bulk add users with all their credentials
     */
    async bulkAddUsers(
        device: Device,
        users: Array<{
            employeeNo: string;
            name: string;
            faceData?: string;
            cardNo?: string;
            nfcId?: string;
        }>
    ): Promise<void> {
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
                    deviceId: device.id,
                    employeeNo: userData.employeeNo,
                    module: 'hikvision-v2-adapter',
                });
            } catch (error) {
                this.logger.error('Failed to add user', error.message, {
                    deviceId: device.id,
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
    async getUserComplete(device: Device, employeeNo: string) {
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
        device: Device,
        searchCriteria: {
            searchID?: string;
            maxResults?: number;
            employeeNoList?: string[];
        }
    ) {
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
        device: Device,
        libraryData: {
            faceLibType: 'blackFD' | 'staticFD';
            name: string;
            customInfo?: string;
            FDID: string;
        }
    ) {
        return await this.faceLibrary.createFaceLibrary(device, libraryData);
    }

    /**
     * Add face picture with image data
     */
    async addFacePictureWithImage(
        device: Device,
        faceData: {
            faceLibType: string;
            FDID: string;
            name: string;
            employeeNo?: string;
        },
        imageBuffer: Buffer
    ) {
        return await this.faceLibrary.addFacePicture(device, faceData, imageBuffer);
    }

    /**
     * Fingerprint management
     */
    async addFingerprint(
        device: Device,
        fingerprintData: {
            employeeNo: string;
            fingerPrintID: string;
            fingerType: string;
            fingerData: string;
        }
    ) {
        return await this.fingerprint.addFingerprint(device, fingerprintData);
    }

    /**
     * Configure event notification hosts
     */
    async configureEventHost(
        device: Device,
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
        device: Device,
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
        const weekPlan = this.schedule.createBasicWeekPlan(schedule.timeSegments);
        return await this.schedule.setWeekPlan(device, planNo, weekPlan);
    }

    /**
     * System user management
     */
    async createSystemUser(
        device: Device,
        userData: {
            id: number;
            userName: string;
            password: string;
            userLevel?: 'Administrator' | 'Operator' | 'Viewer';
            enabled?: boolean;
        }
    ) {
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
        device: Device,
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
        const cardReaderConfig = this.system.createBasicCardReaderConfig(config);
        return await this.system.setCardReaderConfig(device, cardReaderID, cardReaderConfig);
    }

    /**
     * Get device capabilities for different features
     */
    async getDeviceCapabilities(device: Device): Promise<DeviceCapability> {
        try {
            // Use the new HTTP client method to get capabilities
            const rawData = await this.httpClient.getDeviceCapabilities(device);

            const capabilities = await this.xmlJsonService.xmlToJsonClean(rawData);

            this.logger.debug('Device capabilities retrieved', {
                deviceId: device.id,
                capabilities,
            });

            const supported = [
                'isSupportUserInfoDetailDelete',
                'isSupportUserInfo',
                'isSupportTTSText',
                'isSupportTTSTextSearchHolidayPlan',
                'isSupportTTSTextHolidayPlan',
                'isSupportCaptureIrisData',
                'isSupportIrisInfo',
                'isSupportCaptureFace',
                'isSupportFDLib',
                'isSupportCaptureFingerPrint',
                'isSupportFingerPrintDelete',
                'isSupportFingerPrintCfg',
                'isSupportCaptureCardInfo',
                'isSupportCardInfo',
            ];
            
            // isSupportUserInfoDetailDelete -> it indicates that the device supports person deleting.
            // isSupportUserInfo -> it indicates that the device supports user management.
            // isSupportTTSText -> it indicates that the device supports daily schedule management of voice prompt
            // isSupportTTSTextSearchHolidayPlan -> it indicates that the device supports searching for holiday schedule parameters
            // isSupportTTSTextHolidayPlan -> it indicates that the device supports holiday schedule management of voice prompt
            // isSupportCaptureIrisData -> it indicates that the device supports iris data collecting
            // isSupportIrisInfo -> it indicates that the device supports iris data management
            // isSupportCaptureFace -> it indicates that the device supports face picture (captured in visible light) collecting
            // isSupportFDLib -> it indicates that the device supports face picture management
            // isSupportCaptureFingerPrint -> it indicates that the device supports face picture management.
            // isSupportFingerPrintDelete -> it indicates that the device supports fingerprint deleting.
            // isSupportFingerPrintCfg -> it indicates that the device supports fingerprint management.
            // isSupportCaptureCardInfo -> it indicates that the device supports card collecting.
            // isSupportCardInfo -> it indicates that the device supports card management.

            return {
                faceLibrarySupport: capabilities.faceRecognition,
                fingerprintSupport: capabilities.fingerprint,
                cardManagementSupport: 'isSupportCardInfo',
                userManagementSupport: capabilities.userManagement,
                eventSubscriptionSupport: capabilities.eventSubscription,
                capabilities: capabilities.capabilities,
            };
        } catch (error) {
            this.logger.error('Failed to get device capabilities', error.message, {
                deviceId: device.id,
            });

            // Return default capabilities if detection fails
            return {
                faceLibrarySupport: false,
                fingerprintSupport: false,
                cardManagementSupport: false,
                userManagementSupport: true,
                eventSubscriptionSupport: true,
                capabilities: {},
            };
        }
    }

    /**
     * Comprehensive device status check
     */
    async getComprehensiveDeviceStatus(device: Device) {
        try {
            // Get device capabilities first to know what's supported
            const capabilities = await this.getDeviceCapabilities(device);

            const promises = [];

            // Always get device health
            promises.push(this.getDeviceHealth(device));

            // Only get counts for supported features
            if (capabilities.userManagementSupport) {
                promises.push(this.system.getAllUsers(device));
            }

            if (capabilities.eventSubscriptionSupport) {
                promises.push(this.eventHost.getAllListeningHosts(device));
            }

            if (capabilities.faceLibrarySupport) {
                promises.push(this.faceLibrary.getFaceLibraryCount(device));
            }

            if (capabilities.fingerprintSupport) {
                promises.push(this.fingerprint.getFingerprintCount(device));
            }

            if (capabilities.cardManagementSupport) {
                promises.push(this.person.getPersonCount(device));
            }

            const results = await Promise.allSettled(promises);

            return {
                health: results[0]?.status === 'fulfilled' ? results[0].value : null,
                capabilities,
                counts: {
                    systemUsers: results[1]?.status === 'fulfilled' ? results[1].value.length : 0,
                    eventHosts: results[2]?.status === 'fulfilled' ? results[2].value.length : 0,
                    faceLibraries:
                        results[3]?.status === 'fulfilled'
                            ? results[3].value.totalRecordDataNumber
                            : 0,
                    fingerprints: results[4]?.status === 'fulfilled' ? results[4].value : 0,
                    persons: results[5]?.status === 'fulfilled' ? results[5].value : 0,
                },
                lastChecked: new Date(),
            };
        } catch (error) {
            this.logger.error('Failed to get comprehensive device status', error.message, {
                deviceId: device.id,
            });

            return {
                health: null,
                capabilities: {
                    faceLibrarySupport: false,
                    fingerprintSupport: false,
                    cardManagementSupport: false,
                    userManagementSupport: true,
                    eventSubscriptionSupport: true,
                },
                counts: {
                    systemUsers: 0,
                    eventHosts: 0,
                    faceLibraries: 0,
                    fingerprints: 0,
                    persons: 0,
                },
                lastChecked: new Date(),
            };
        }
    }
}
