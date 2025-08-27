import { Device, DeviceProtocol, DeviceStatus, DeviceType, EventType } from '@prisma/client';
import { DeviceOperationContext } from '@/modules/device/device-adapter.strategy';
import { ISAPIXMLResponse } from '../implementations';

export interface DeviceDiscoveryConfig {
    protocol: DeviceProtocol;
    host: string;
    port: number;
    username: string;
    password: string;
    brand: string;
}

export interface DeviceInfo {
    name: string;
    deviceId: string;
    model: string;
    serialNumber: string;
    macAddress: string;
    firmwareVersion: string;
    firmwareReleasedDate?: string;
    deviceType: DeviceType;
    manufacturer: string;
    capabilities: DeviceCapability;
    status?: DeviceStatus;
}

export interface DeviceCapability {
    faceLibrarySupport: any;
    fingerprintSupport: any;
    cardManagementSupport: any;
    userManagementSupport: any;
    eventSubscriptionSupport: any;
    meta: {
        [key: string]: any; // Dynamic capabilities
    };
    [key: string]: any;
}

export interface DeviceConfiguration {
    deviceId: string;
    settings: Record<string, any>;
    schedules?: DeviceSchedule[];
    accessRules?: DeviceAccessRule[];
}

export interface DeviceSchedule {
    id: string;
    name: string;
    startTime: string; // HH:mm format
    endTime: string; // HH:mm format
    daysOfWeek: number[]; // 0-6, Sunday = 0
    enabled: boolean;
}

export interface DeviceAccessRule {
    id: string;
    name: string;
    userGroups: string[];
    timeSchedules: string[];
    enabled: boolean;
}

export interface DeviceCommand {
    command:
        | 'unlock_door'
        | 'lock_door'
        | 'reboot'
        | 'sync_users'
        | 'update_firmware'
        | 'configure_webhook'
        | 'remove_webhook'
        | 'test_webhook';
    parameters?: Record<string, any>;
    timeout?: number; // seconds
}

export interface DeviceCommandResult {
    success: boolean;
    message?: string;
    data?: any;
    executedAt: Date;
}

export interface DeviceEvent {
    deviceId: string;
    eventType: EventType;
    timestamp: Date;
    userId?: string;
    cardId?: string;
    biometricId?: string;
    data?: Record<string, any>;
}

export interface DeviceHealth {
    deviceId: string;
    status: DeviceStatus;
    uptime: number; // seconds
    memoryUsage?: number; // percentage
    diskUsage?: number; // percentage
    temperature?: number; // celsius
    lastHealthCheck: Date;
    issues?: string[];
}

export interface IDeviceAdapter {
    /**
     * Get device information
     */
    getDeviceInfo(device: Device): Promise<DeviceInfo>;

    /**
     * Get device configuration
     */
    getDeviceConfiguration(device: Device): Promise<DeviceConfiguration>;

    /**
     * Update device configuration
     */
    updateDeviceConfiguration(
        device: Device,
        configuration: Partial<DeviceConfiguration>
    ): Promise<void>;

    /**
     * Send command to device
     */
    sendCommand(device: Device, command: DeviceCommand): Promise<DeviceCommandResult>;

    /**
     * Get device health status
     */
    getDeviceHealth(device: Device): Promise<DeviceHealth>;

    /**
     * Discover device capabilities
     */
    getDeviceCapabilities(device: Device): Promise<DeviceCapability>;

    /**
     * Subscribe to device events
     */
    subscribeToEvents(device: Device, callback: (event: DeviceEvent) => void): Promise<void>;

    /**
     * Unsubscribe from device events
     */
    unsubscribeFromEvents(device: Device): Promise<void>;

    /**
     * Sync user data to device
     */
    syncUsers(
        device: Device,
        users: Array<{
            userId: string;
            cardId?: string;
            biometricData?: string;
            accessLevel: number;
        }>
    ): Promise<void>;

    /**
     * Remove user from device
     */
    removeUser(device: Device, userId: string): Promise<void>;

    /**
     * Test device connectivity
     */
    testConnection(device: Device): Promise<boolean>;

    /**
     * Reboot device
     */
    rebootDevice(device: Device): Promise<void>;

    /**
     * Update device firmware
     */
    updateFirmware(
        device: Device,
        firmwareUrl: string
    ): Promise<{ success: boolean; message: string }>;

    /**
     * Get device logs
     */
    getDeviceLogs(device: Device, startDate?: Date, endDate?: Date): Promise<string[]>;

    /**
     * Clear device logs
     */
    clearDeviceLogs(device: Device): Promise<void>;

    supportsWebhooks(device: Device): Promise<boolean>;

    getWebhookConfigurations(device: Device): Promise<any[]>;

    deleteWebhook(device: Device, webhookId: string): Promise<void>;
    deleteWebhooks(device: Device): Promise<void>;

    configureEventHost(
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
    ): Promise<ISAPIXMLResponse>;
}
