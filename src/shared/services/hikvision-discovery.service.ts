import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as dgram from 'dgram';
import * as net from 'net';

import { PrismaService } from '@/core/database/prisma.service';
import { EncryptionService } from './encryption.service';
import {
    HikvisionDeviceConfig,
    HikvisionErrorContext,
    HIKVISION_ENDPOINTS,
    HIKVISION_CONFIG,
    HikvisionValidation,
} from '../adapters/hikvision.adapter';
import {
    DeviceInfo,
    DeviceConfiguration,
    DeviceSchedule,
    DeviceAccessRule,
} from '../adapters/device.adapter';
import { DeviceStatus, DeviceType } from '@prisma/client';
import { HikvisionExceptionFactory } from '../exceptions/hikvision.exceptions';

export interface NetworkDiscoveryOptions {
    networkRange?: string; // e.g., "192.168.1.0/24"
    timeout?: number;
    maxConcurrent?: number;
    ports?: number[];
    useUPnP?: boolean;
    useBroadcast?: boolean;
}

export interface DiscoveredDevice {
    ipAddress: string;
    macAddress?: string;
    deviceType?: string;
    serialNumber?: string;
    firmwareVersion?: string;
    model?: string;
    manufacturer?: string;
    port: number;
    responseTime: number;
    discoveryMethod: 'upnp' | 'broadcast' | 'scan' | 'manual';
    capabilities?: string[];
    isConfigured: boolean; // Whether device is already in database
}

export interface DeviceConfigurationTemplate {
    name: string;
    description: string;
    deviceType: DeviceType;
    settings: Record<string, any>;
    schedules: DeviceSchedule[];
    accessRules: DeviceAccessRule[];
    networkSettings?: {
        dhcp?: boolean;
        staticIp?: string;
        gateway?: string;
        dns?: string[];
    };
}

export interface ConfigurationValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
}

@Injectable()
export class HikvisionDiscoveryService {
    private readonly logger = new Logger(HikvisionDiscoveryService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly prisma: PrismaService,
        private readonly encryptionService: EncryptionService,
    ) {}

    /**
     * Discover Hikvision devices on the network
     */
    async discoverDevices(options: NetworkDiscoveryOptions = {}): Promise<DiscoveredDevice[]> {
        const {
            networkRange = '192.168.1.0/24',
            timeout = 5000,
            maxConcurrent = 50,
            ports = [80, 8000, 8080],
            useUPnP = true,
            useBroadcast = true,
        } = options;

        this.logger.log('Starting device discovery', { networkRange, timeout, maxConcurrent });

        const discoveredDevices: DiscoveredDevice[] = [];

        try {
            // Method 1: UPnP Discovery
            if (useUPnP) {
                const upnpDevices = await this.discoverViaUPnP(timeout);
                discoveredDevices.push(...upnpDevices);
            }

            // Method 2: Broadcast Discovery
            if (useBroadcast) {
                const broadcastDevices = await this.discoverViaBroadcast(timeout);
                discoveredDevices.push(...broadcastDevices);
            }

            // Method 3: Network Scanning
            const scanDevices = await this.discoverViaNetworkScan(networkRange, ports, timeout, maxConcurrent);
            discoveredDevices.push(...scanDevices);

            // Remove duplicates and check if devices are already configured
            const uniqueDevices = await this.deduplicateAndCheckConfiguration(discoveredDevices);

            this.logger.log('Device discovery completed', { 
                totalFound: uniqueDevices.length,
                configured: uniqueDevices.filter(d => d.isConfigured).length,
                unconfigured: uniqueDevices.filter(d => !d.isConfigured).length,
            });

            return uniqueDevices;

        } catch (error) {
            this.logger.error('Device discovery failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Get device configuration from device
     */
    async getDeviceConfiguration(deviceId: string): Promise<DeviceConfiguration> {
        this.logger.log('Getting device configuration', { deviceId });

        const device = await this.getDeviceFromDatabase(deviceId);
        const context = this.createErrorContext(deviceId, 'getDeviceConfiguration');

        try {
            // Get basic device settings
            const settingsEndpoint = this.buildEndpoint(device, '/ISAPI/System/deviceInfo');
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const settingsResponse = await firstValueFrom(
                this.httpService.get(settingsEndpoint, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );

            // Get access control settings
            const accessEndpoint = this.buildEndpoint(device, '/ISAPI/AccessControl/Configuration');
            let accessSettings = {};
            try {
                const accessResponse = await firstValueFrom(
                    this.httpService.get(accessEndpoint, {
                        auth: { username: device.username, password },
                        timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                    })
                );
                accessSettings = accessResponse.data;
            } catch (error) {
                this.logger.debug('Access control settings not available', { deviceId });
            }

            return {
                deviceId,
                settings: {
                    ...settingsResponse.data,
                    accessControl: accessSettings,
                },
                schedules: await this.getDeviceSchedules(device),
                accessRules: await this.getDeviceAccessRules(device),
            };

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to get device configuration', { deviceId, error: exception.message });
            throw exception.toNestException();
        }
    }

    /**
     * Update device configuration
     */
    async updateDeviceConfiguration(
        deviceId: string,
        configuration: Partial<DeviceConfiguration>
    ): Promise<void> {
        this.logger.log('Updating device configuration', { deviceId });

        const device = await this.getDeviceFromDatabase(deviceId);
        const context = this.createErrorContext(deviceId, 'updateDeviceConfiguration');

        try {
            // Update basic settings
            if (configuration.settings) {
                await this.updateDeviceSettings(device, configuration.settings);
            }

            // Update schedules
            if (configuration.schedules) {
                await this.updateDeviceSchedules(device, configuration.schedules);
            }

            // Update access rules
            if (configuration.accessRules) {
                await this.updateDeviceAccessRules(device, configuration.accessRules);
            }

            this.logger.log('Device configuration updated successfully', { deviceId });

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to update device configuration', { deviceId, error: exception.message });
            throw exception.toNestException();
        }
    }

    /**
     * Apply configuration template to device
     */
    async applyConfigurationTemplate(
        deviceId: string,
        template: DeviceConfigurationTemplate
    ): Promise<void> {
        this.logger.log('Applying configuration template', { deviceId, templateName: template.name });

        const configuration: DeviceConfiguration = {
            deviceId,
            settings: template.settings,
            schedules: template.schedules,
            accessRules: template.accessRules,
        };

        await this.updateDeviceConfiguration(deviceId, configuration);

        // Apply network settings if specified
        if (template.networkSettings) {
            await this.updateNetworkConfiguration(deviceId, template.networkSettings);
        }

        this.logger.log('Configuration template applied successfully', { deviceId, templateName: template.name });
    }

    /**
     * Validate device configuration
     */
    async validateDeviceConfiguration(
        deviceId: string,
        configuration: DeviceConfiguration
    ): Promise<ConfigurationValidationResult> {
        this.logger.debug('Validating device configuration', { deviceId });

        const result: ConfigurationValidationResult = {
            valid: true,
            errors: [],
            warnings: [],
            suggestions: [],
        };

        try {
            // Validate basic settings
            if (configuration.settings) {
                const settingsValidation = this.validateSettings(configuration.settings);
                result.errors.push(...settingsValidation.errors);
                result.warnings.push(...settingsValidation.warnings);
            }

            // Validate schedules
            if (configuration.schedules) {
                const schedulesValidation = this.validateSchedules(configuration.schedules);
                result.errors.push(...schedulesValidation.errors);
                result.warnings.push(...schedulesValidation.warnings);
            }

            // Validate access rules
            if (configuration.accessRules) {
                const rulesValidation = this.validateAccessRules(configuration.accessRules);
                result.errors.push(...rulesValidation.errors);
                result.warnings.push(...rulesValidation.warnings);
            }

            // Check for conflicts and provide suggestions
            result.suggestions.push(...this.generateConfigurationSuggestions(configuration));

            result.valid = result.errors.length === 0;

            return result;

        } catch (error) {
            result.valid = false;
            result.errors.push(`Configuration validation failed: ${error.message}`);
            return result;
        }
    }

    /**
     * Create default configuration templates
     */
    getDefaultConfigurationTemplates(): DeviceConfigurationTemplate[] {
        return [
            {
                name: 'Basic Access Control',
                description: 'Basic configuration for access control devices',
                deviceType: DeviceType.CAMERA,
                settings: {
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                    maxUsers: 1000,
                    enableFaceRecognition: true,
                    enableCardReader: true,
                },
                schedules: [
                    {
                        id: 'business-hours',
                        name: 'Business Hours',
                        startTime: '08:00',
                        endTime: '18:00',
                        daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
                        enabled: true,
                    },
                    {
                        id: 'after-hours',
                        name: 'After Hours',
                        startTime: '18:01',
                        endTime: '07:59',
                        daysOfWeek: [1, 2, 3, 4, 5],
                        enabled: true,
                    },
                ],
                accessRules: [
                    {
                        id: 'employees',
                        name: 'Employee Access',
                        userGroups: ['employees'],
                        timeSchedules: ['business-hours'],
                        enabled: true,
                    },
                    {
                        id: 'security',
                        name: 'Security Access',
                        userGroups: ['security'],
                        timeSchedules: ['business-hours', 'after-hours'],
                        enabled: true,
                    },
                ],
            },
            {
                name: 'High Security',
                description: 'High security configuration with strict access controls',
                deviceType: DeviceType.CAMERA,
                settings: {
                    timeout: 5000,
                    maxUsers: 500,
                    enableFaceRecognition: true,
                    enableCardReader: true,
                    requireDualAuthentication: true,
                    enableAntiPassback: true,
                },
                schedules: [
                    {
                        id: 'restricted-hours',
                        name: 'Restricted Hours',
                        startTime: '09:00',
                        endTime: '17:00',
                        daysOfWeek: [1, 2, 3, 4, 5],
                        enabled: true,
                    },
                ],
                accessRules: [
                    {
                        id: 'authorized-only',
                        name: 'Authorized Personnel Only',
                        userGroups: ['authorized'],
                        timeSchedules: ['restricted-hours'],
                        enabled: true,
                    },
                ],
                networkSettings: {
                    dhcp: false,
                    dns: ['8.8.8.8', '8.8.4.4'],
                },
            },
        ];
    }

    // ==================== Private Methods ====================

    private async discoverViaUPnP(timeout: number): Promise<DiscoveredDevice[]> {
        this.logger.debug('Starting UPnP discovery');
        
        // UPnP discovery implementation would go here
        // For now, return empty array as placeholder
        return [];
    }

    private async discoverViaBroadcast(timeout: number): Promise<DiscoveredDevice[]> {
        this.logger.debug('Starting broadcast discovery');
        
        return new Promise((resolve) => {
            const devices: DiscoveredDevice[] = [];
            const socket = dgram.createSocket('udp4');
            
            // Hikvision broadcast discovery packet
            const discoveryPacket = Buffer.from([
                0x00, 0x00, 0x00, 0x20, 0x63, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            ]);

            socket.on('message', (msg, rinfo) => {
                // Parse Hikvision response
                if (msg.length >= 32) {
                    devices.push({
                        ipAddress: rinfo.address,
                        port: 80, // Default HTTP port
                        responseTime: 0,
                        discoveryMethod: 'broadcast',
                        isConfigured: false,
                    });
                }
            });

            socket.bind(() => {
                socket.setBroadcast(true);
                socket.send(discoveryPacket, 37020, '255.255.255.255');
            });

            setTimeout(() => {
                socket.close();
                resolve(devices);
            }, timeout);
        });
    }

    private async discoverViaNetworkScan(
        networkRange: string,
        ports: number[],
        timeout: number,
        maxConcurrent: number
    ): Promise<DiscoveredDevice[]> {
        this.logger.debug('Starting network scan', { networkRange, ports });

        const devices: DiscoveredDevice[] = [];
        const ipAddresses = this.generateIPRange(networkRange);
        
        // Limit concurrent scans
        const chunks = this.chunkArray(ipAddresses, maxConcurrent);
        
        for (const chunk of chunks) {
            const promises = chunk.map(ip => this.scanDevice(ip, ports, timeout));
            const results = await Promise.allSettled(promises);
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    devices.push(result.value);
                }
            });
        }

        return devices;
    }

    private async scanDevice(ipAddress: string, ports: number[], timeout: number): Promise<DiscoveredDevice | null> {
        for (const port of ports) {
            try {
                const startTime = Date.now();
                
                // Test HTTP connection
                const endpoint = `http://${ipAddress}:${port}${HIKVISION_ENDPOINTS.DEVICE_INFO}`;
                
                const response = await firstValueFrom(
                    this.httpService.get(endpoint, {
                        timeout: timeout / ports.length, // Divide timeout among ports
                        validateStatus: () => true, // Accept any status
                    })
                );

                const responseTime = Date.now() - startTime;

                // Check if this looks like a Hikvision device
                if (this.isHikvisionDevice(response)) {
                    return {
                        ipAddress,
                        port,
                        responseTime,
                        discoveryMethod: 'scan',
                        deviceType: response.data?.deviceType,
                        serialNumber: response.data?.serialNumber,
                        firmwareVersion: response.data?.firmwareVersion,
                        model: response.data?.model,
                        manufacturer: 'Hikvision',
                        isConfigured: false,
                    };
                }
            } catch (error) {
                // Continue to next port
                continue;
            }
        }

        return null;
    }

    private isHikvisionDevice(response: any): boolean {
        // Check response headers and content for Hikvision indicators
        const headers = response.headers || {};
        const data = response.data || {};
        
        return (
            headers['server']?.toLowerCase().includes('hikvision') ||
            headers['www-authenticate']?.toLowerCase().includes('hikvision') ||
            data.manufacturer?.toLowerCase().includes('hikvision') ||
            data.deviceType?.toLowerCase().includes('hikvision') ||
            response.status === 401 // Unauthorized is common for Hikvision devices
        );
    }

    private generateIPRange(networkRange: string): string[] {
        // Simple implementation for /24 networks
        const [network, cidr] = networkRange.split('/');
        const [a, b, c] = network.split('.').map(Number);
        const ips: string[] = [];
        
        if (cidr === '24') {
            for (let d = 1; d < 255; d++) {
                ips.push(`${a}.${b}.${c}.${d}`);
            }
        }
        
        return ips;
    }

    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    private async deduplicateAndCheckConfiguration(devices: DiscoveredDevice[]): Promise<DiscoveredDevice[]> {
        // Remove duplicates by IP address
        const uniqueDevices = devices.reduce((acc, device) => {
            const existing = acc.find(d => d.ipAddress === device.ipAddress);
            if (!existing) {
                acc.push(device);
            } else if (device.discoveryMethod === 'upnp' && existing.discoveryMethod !== 'upnp') {
                // Prefer UPnP discovery results
                acc[acc.indexOf(existing)] = device;
            }
            return acc;
        }, [] as DiscoveredDevice[]);

        // Check if devices are already configured in database
        for (const device of uniqueDevices) {
            const existingDevice = await this.prisma.device.findFirst({
                where: { ipAddress: device.ipAddress },
            });
            device.isConfigured = !!existingDevice;
        }

        return uniqueDevices;
    }

    private async getDeviceFromDatabase(deviceId: string): Promise<HikvisionDeviceConfig> {
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

    private async getDeviceSchedules(device: HikvisionDeviceConfig): Promise<DeviceSchedule[]> {
        // Placeholder implementation
        return [];
    }

    private async getDeviceAccessRules(device: HikvisionDeviceConfig): Promise<DeviceAccessRule[]> {
        // Placeholder implementation
        return [];
    }

    private async updateDeviceSettings(device: HikvisionDeviceConfig, settings: Record<string, any>): Promise<void> {
        // Implementation for updating device settings
        this.logger.debug('Updating device settings', { deviceId: device.deviceId });
    }

    private async updateDeviceSchedules(device: HikvisionDeviceConfig, schedules: DeviceSchedule[]): Promise<void> {
        // Implementation for updating device schedules
        this.logger.debug('Updating device schedules', { deviceId: device.deviceId });
    }

    private async updateDeviceAccessRules(device: HikvisionDeviceConfig, rules: DeviceAccessRule[]): Promise<void> {
        // Implementation for updating device access rules
        this.logger.debug('Updating device access rules', { deviceId: device.deviceId });
    }

    private async updateNetworkConfiguration(deviceId: string, networkSettings: any): Promise<void> {
        // Implementation for updating network configuration
        this.logger.debug('Updating network configuration', { deviceId });
    }

    private validateSettings(settings: Record<string, any>): { errors: string[]; warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (settings.timeout && settings.timeout < 1000) {
            errors.push('Timeout must be at least 1000ms');
        }

        if (settings.maxUsers && settings.maxUsers > 10000) {
            warnings.push('Maximum users exceeds recommended limit of 10000');
        }

        return { errors, warnings };
    }

    private validateSchedules(schedules: DeviceSchedule[]): { errors: string[]; warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        for (const schedule of schedules) {
            if (!schedule.startTime || !schedule.endTime) {
                errors.push(`Schedule ${schedule.name} must have start and end times`);
            }

            if (schedule.daysOfWeek.length === 0) {
                warnings.push(`Schedule ${schedule.name} has no active days`);
            }
        }

        return { errors, warnings };
    }

    private validateAccessRules(rules: DeviceAccessRule[]): { errors: string[]; warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        for (const rule of rules) {
            if (rule.userGroups.length === 0) {
                errors.push(`Access rule ${rule.name} must have at least one user group`);
            }

            if (rule.timeSchedules.length === 0) {
                warnings.push(`Access rule ${rule.name} has no time schedules`);
            }
        }

        return { errors, warnings };
    }

    private generateConfigurationSuggestions(configuration: DeviceConfiguration): string[] {
        const suggestions: string[] = [];

        if (configuration.schedules && configuration.schedules.length === 0) {
            suggestions.push('Consider adding time schedules for better access control');
        }

        if (configuration.accessRules && configuration.accessRules.length === 0) {
            suggestions.push('Consider adding access rules to control user permissions');
        }

        return suggestions;
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
}