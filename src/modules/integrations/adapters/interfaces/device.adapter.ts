import { DeviceProtocol, DeviceStatus, DeviceType, EventType } from '@prisma/client';
import { DeviceOperationContext } from '@/modules/device/device-adapter.strategy';

export interface DeviceDiscoveryConfig {
    type: DeviceType;
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
    deviceType: string;
    manufacturer: string;
    capabilities: DeviceCapability[];
    status?: 'online' | 'offline' | 'unknown';
}

export interface DeviceCapability {
    type: DeviceType;
    enabled: boolean;
    configuration?: Record<string, any>;
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
    command: 'unlock_door' | 'lock_door' | 'reboot' | 'sync_users' | 'update_firmware' | 'configure_webhook' | 'remove_webhook' | 'test_webhook';
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
     * Discover devices on the network
     */
    discoverDevices(): Promise<DeviceInfo[]>;

    /**
     * Get device information
     */
    getDeviceInfo(context: DeviceOperationContext): Promise<DeviceInfo>;

    /**
     * Get device configuration
     */
    getDeviceConfiguration(context: DeviceOperationContext): Promise<DeviceConfiguration>;

    /**
     * Update device configuration
     */
    updateDeviceConfiguration(
        context: DeviceOperationContext,
        configuration: Partial<DeviceConfiguration>
    ): Promise<void>;

    /**
     * Send command to device
     */
    sendCommand(context: DeviceOperationContext, command: DeviceCommand): Promise<DeviceCommandResult>;

    /**
     * Get device health status
     */
    getDeviceHealth(context: DeviceOperationContext): Promise<DeviceHealth>;

    /**
     * Subscribe to device events
     */
    subscribeToEvents(context: DeviceOperationContext, callback: (event: DeviceEvent) => void): Promise<void>;

    /**
     * Unsubscribe from device events
     */
    unsubscribeFromEvents(context: DeviceOperationContext): Promise<void>;

    /**
     * Sync user data to device
     */
    syncUsers(
        context: DeviceOperationContext,
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
    removeUser(context: DeviceOperationContext, userId: string): Promise<void>;

    /**
     * Test device connectivity
     */
    testConnection(context: DeviceOperationContext): Promise<boolean>;

    /**
     * Reboot device
     */
    rebootDevice(context: DeviceOperationContext): Promise<void>;

    /**
     * Update device firmware
     */
    updateFirmware(
        context: DeviceOperationContext,
        firmwareUrl: string
    ): Promise<{ success: boolean; message: string }>;

    /**
     * Get device logs
     */
    getDeviceLogs(context: DeviceOperationContext, startDate?: Date, endDate?: Date): Promise<string[]>;

    /**
     * Clear device logs
     */
    clearDeviceLogs(context: DeviceOperationContext): Promise<void>;
}
