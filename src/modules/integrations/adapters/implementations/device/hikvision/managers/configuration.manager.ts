import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { HikvisionHttpClient } from '../utils/hikvision-http.client';
import { XmlJsonService } from '@/shared/services/xml-json.service';

export interface DeviceConfiguration {
    deviceInfo: {
        deviceName: string;
        deviceID: string;
        model: string;
        serialNumber: string;
        firmwareVersion: string;
        hardwareVersion: string;
    };
    network: {
        host: string;
        subnetMask: string;
        gateway: string;
        dns1: string;
        dns2: string;
        dhcpEnabled: boolean;
    };
    time: {
        timeZone: string;
        ntpEnabled: boolean;
        ntpServer: string;
        currentTime: Date;
    };
    access: {
        unlockTime: number; // seconds
        alarmTime: number; // seconds
        maxInvalidAttempts: number;
        lockoutTime: number; // minutes
    };
    authentication: {
        cardEnabled: boolean;
        faceEnabled: boolean;
        fingerprintEnabled: boolean;
        passwordEnabled: boolean;
        multiFactorRequired: boolean;
    };
}

export interface NetworkConfig {
    host?: string;
    subnetMask?: string;
    gateway?: string;
    dns1?: string;
    dns2?: string;
    dhcpEnabled?: boolean;
}

export interface AccessConfig {
    unlockTime?: number;
    alarmTime?: number;
    maxInvalidAttempts?: number;
    lockoutTime?: number;
}

export interface AuthenticationConfig {
    cardEnabled?: boolean;
    faceEnabled?: boolean;
    fingerprintEnabled?: boolean;
    passwordEnabled?: boolean;
    multiFactorRequired?: boolean;
}

@Injectable()
export class HikvisionConfigurationManager {
    constructor(
        private readonly httpClient: HikvisionHttpClient,
        private readonly logger: LoggerService,
        private readonly xmlJsonService: XmlJsonService
    ) {}

    /**
     * Get complete device configuration
     */
    async getConfiguration(device: any): Promise<DeviceConfiguration> {
        try {
            this.logger.debug('Getting device configuration', {
                deviceId: device.id,
                module: 'hikvision-config-manager',
            });

            const [deviceInfo, networkInfo, timeInfo, accessInfo, authInfo] = await Promise.all([
                this.getDeviceInfo(device),
                this.getNetworkConfig(device),
                this.getTimeConfig(device),
                this.getAccessConfig(device),
                this.getAuthenticationConfig(device),
            ]);

            return {
                deviceInfo,
                network: networkInfo,
                time: timeInfo,
                access: accessInfo,
                authentication: authInfo,
            };
        } catch (error) {
            this.logger.error('Failed to get device configuration', error.message, {
                deviceId: device.id,
                module: 'hikvision-config-manager',
            });
            throw error;
        }
    }

    /**
     * Get device basic information
     */
    async getDeviceInfo(device: any) {
        // Try different ISAPI endpoints for device info
        const url = '/ISAPI/System/deviceInfo';

        try {
            this.logger.debug(`Trying endpoint: ${url}`, {
                deviceId: device.id,
                module: 'hikvision-config-manager',
            });

            const response = await this.httpClient.request<any>(device, {
                method: 'GET',
                url,
            });

            // Convert XML response to JSON if needed
            let data = response;
            if (typeof data === 'string' && data.includes('<?xml')) {
                data = await this.xmlJsonService.xmlToJson(data);
            }

            // Extract device info from XML structure
            const deviceInfo = data.DeviceInfo || data.deviceInfo || data;

            // If successful, return formatted data
            return {
                deviceName: deviceInfo.deviceName || deviceInfo.DeviceName || 'Unknown',
                deviceID: deviceInfo.deviceID || deviceInfo.DeviceID || 'Unknown',
                model: deviceInfo.model || deviceInfo.Model || 'Unknown',
                serialNumber: deviceInfo.serialNumber || deviceInfo.SerialNumber || 'Unknown',
                firmwareVersion:
                    deviceInfo.firmwareVersion || deviceInfo.FirmwareVersion || 'Unknown',
                hardwareVersion:
                    deviceInfo.hardwareVersion || deviceInfo.HardwareVersion || 'Unknown',
            };
        } catch (error) {
            this.logger.debug(`Endpoint ${url} failed: ${error.message}`, {
                deviceId: device.id,
                module: 'hikvision-config-manager',
            });
        }

    }

    /**
     * Get network configuration
     */
    async getNetworkConfig(device: any) {
        const response = await this.httpClient.request<any>(device, {
            method: 'GET',
            url: '/ISAPI/System/Network/interfaces/1',
        });

        const networkInterface = response.data.NetworkInterface;
        return {
            host: networkInterface.host,
            subnetMask: networkInterface.SubnetMask,
            gateway: networkInterface.DefaultGateway,
            dns1: networkInterface.PrimaryDNS,
            dns2: networkInterface.SecondaryDNS,
            dhcpEnabled: networkInterface.DHCP?.enabled === 'true',
        };
    }

    /**
     * Update network configuration
     */
    async updateNetworkConfig(device: any, config: NetworkConfig): Promise<void> {
        try {
            await this.httpClient.request<any>(device, {
                method: 'PUT',
                url: '/ISAPI/System/Network/interfaces/1',
                data: {
                    NetworkInterface: {
                        id: 1,
                        host: config.host,
                        SubnetMask: config.subnetMask,
                        DefaultGateway: config.gateway,
                        PrimaryDNS: config.dns1,
                        SecondaryDNS: config.dns2,
                        DHCP: {
                            enabled: config.dhcpEnabled ? 'true' : 'false',
                        },
                    },
                },
            });

            this.logger.debug('Network configuration updated', {
                deviceId: device.id,
                config,
                module: 'hikvision-config-manager',
            });
        } catch (error) {
            this.logger.error('Failed to update network configuration', error.message, {
                deviceId: device.id,
                config,
                module: 'hikvision-config-manager',
            });
            throw error;
        }
    }

    /**
     * Get time configuration
     */
    async getTimeConfig(device: any) {
        const response = await this.httpClient.request<any>(device, {
            method: 'GET',
            url: '/ISAPI/System/time',
        });

        return {
            timeZone: response.data.timeZone,
            ntpEnabled: response.data.NTPServers?.enabled === 'true',
            ntpServer: response.data.NTPServers?.NTPServer?.[0]?.host || '',
            currentTime: new Date(response.data.localTime),
        };
    }

    /**
     * Get access control configuration
     */
    async getAccessConfig(device: any) {
        const response = await this.httpClient.request<any>(device, {
            method: 'GET',
            url: '/ISAPI/AccessControl/Door/param/1',
        });

        const doorParam = response.data.DoorParam;
        return {
            unlockTime: parseInt(doorParam.openDuration) || 5,
            alarmTime: parseInt(doorParam.alarmTimeout) || 30,
            maxInvalidAttempts: parseInt(doorParam.maxOpenFailTimes) || 3,
            lockoutTime: parseInt(doorParam.openFailLockTime) || 5,
        };
    }

    /**
     * Update access control configuration
     */
    async updateAccessConfig(device: any, config: AccessConfig): Promise<void> {
        try {
            await this.httpClient.request<any>(device, {
                method: 'PUT',
                url: '/ISAPI/AccessControl/Door/param/1',
                data: {
                    DoorParam: {
                        doorNo: 1,
                        openDuration: config.unlockTime?.toString() || '5',
                        alarmTimeout: config.alarmTime?.toString() || '30',
                        maxOpenFailTimes: config.maxInvalidAttempts?.toString() || '3',
                        openFailLockTime: config.lockoutTime?.toString() || '5',
                    },
                },
            });

            this.logger.debug('Access configuration updated', {
                deviceId: device.id,
                config,
                module: 'hikvision-config-manager',
            });
        } catch (error) {
            this.logger.error('Failed to update access configuration', error.message, {
                deviceId: device.id,
                config,
                module: 'hikvision-config-manager',
            });
            throw error;
        }
    }

    /**
     * Get authentication configuration
     */
    async getAuthenticationConfig(device: any) {
        const response = await this.httpClient.request<any>(device, {
            method: 'GET',
            url: '/ISAPI/AccessControl/Authentication',
        });

        const auth = response.data.Authentication;
        return {
            cardEnabled: auth.cardReaderEnabled === 'true',
            faceEnabled: auth.faceEnabled === 'true',
            fingerprintEnabled: auth.fingerprintEnabled === 'true',
            passwordEnabled: auth.passwordEnabled === 'true',
            multiFactorRequired: auth.multiFactorAuthEnabled === 'true',
        };
    }

    /**
     * Update authentication configuration
     */
    async updateAuthenticationConfig(device: any, config: AuthenticationConfig): Promise<void> {
        try {
            await this.httpClient.request<any>(device, {
                method: 'PUT',
                url: '/ISAPI/AccessControl/Authentication',
                data: {
                    Authentication: {
                        cardReaderEnabled: config.cardEnabled ? 'true' : 'false',
                        faceEnabled: config.faceEnabled ? 'true' : 'false',
                        fingerprintEnabled: config.fingerprintEnabled ? 'true' : 'false',
                        passwordEnabled: config.passwordEnabled ? 'true' : 'false',
                        multiFactorAuthEnabled: config.multiFactorRequired ? 'true' : 'false',
                    },
                },
            });

            this.logger.debug('Authentication configuration updated', {
                deviceId: device.id,
                config,
                module: 'hikvision-config-manager',
            });
        } catch (error) {
            this.logger.error('Failed to update authentication configuration', error.message, {
                deviceId: device.id,
                config,
                module: 'hikvision-config-manager',
            });
            throw error;
        }
    }

    /**
     * Reboot device
     */
    async rebootDevice(device: any): Promise<void> {
        try {
            await this.httpClient.request<any>(device, {
                method: 'PUT',
                url: '/ISAPI/System/reboot',
            });

            this.logger.debug('Device reboot initiated', {
                deviceId: device.id,
                module: 'hikvision-config-manager',
            });
        } catch (error) {
            this.logger.error('Failed to reboot device', error.message, {
                deviceId: device.id,
                module: 'hikvision-config-manager',
            });
            throw error;
        }
    }

    /**
     * Factory reset device
     */
    async factoryReset(device: any): Promise<void> {
        try {
            await this.httpClient.request<any>(device, {
                method: 'PUT',
                url: '/ISAPI/System/factoryReset',
                data: {
                    factoryReset: 'default',
                },
            });

            this.logger.debug('Factory reset initiated', {
                deviceId: device.id,
                module: 'hikvision-config-manager',
            });
        } catch (error) {
            this.logger.error('Failed to factory reset device', error.message, {
                deviceId: device.id,
                module: 'hikvision-config-manager',
            });
            throw error;
        }
    }
}
