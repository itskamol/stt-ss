export interface DeviceInfo {
    id: string;
    name: string;
    type: 'card_reader' | 'biometric' | 'qr_scanner' | 'facial_recognition';
    status: 'online' | 'offline' | 'maintenance' | 'error';
    ipAddress?: string;
    macAddress?: string;
    firmwareVersion?: string;
    lastSeen?: Date;
    capabilities: DeviceCapability[];
}

export interface DeviceCapability {
    type: 'card_read' | 'biometric_scan' | 'qr_scan' | 'facial_recognition' | 'door_control';
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
    command: 'unlock_door' | 'lock_door' | 'reboot' | 'sync_users' | 'update_firmware';
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
    eventType:
        | 'access_granted'
        | 'access_denied'
        | 'door_opened'
        | 'door_closed'
        | 'alarm'
        | 'error';
    timestamp: Date;
    userId?: string;
    cardId?: string;
    biometricId?: string;
    data?: Record<string, any>;
}

export interface DeviceHealth {
    deviceId: string;
    status: 'healthy' | 'warning' | 'critical';
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
    getDeviceInfo(deviceId: string): Promise<DeviceInfo>;

    /**
     * Get device configuration
     */
    getDeviceConfiguration(deviceId: string): Promise<DeviceConfiguration>;

    /**
     * Update device configuration
     */
    updateDeviceConfiguration(
        deviceId: string,
        configuration: Partial<DeviceConfiguration>
    ): Promise<void>;

    /**
     * Send command to device
     */
    sendCommand(deviceId: string, command: DeviceCommand): Promise<DeviceCommandResult>;

    /**
     * Get device health status
     */
    getDeviceHealth(deviceId: string): Promise<DeviceHealth>;

    /**
     * Subscribe to device events
     */
    subscribeToEvents(deviceId: string, callback: (event: DeviceEvent) => void): Promise<void>;

    /**
     * Unsubscribe from device events
     */
    unsubscribeFromEvents(deviceId: string): Promise<void>;

    /**
     * Sync user data to device
     */
    syncUsers(
        deviceId: string,
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
    removeUser(deviceId: string, userId: string): Promise<void>;

    /**
     * Test device connectivity
     */
    testConnection(deviceId: string): Promise<boolean>;

    /**
     * Reboot device
     */
    rebootDevice(deviceId: string): Promise<void>;

    /**
     * Update device firmware
     */
    updateFirmware(
        deviceId: string,
        firmwareUrl: string
    ): Promise<{ success: boolean; message: string }>;

    /**
     * Get device logs
     */
    getDeviceLogs(deviceId: string, startDate?: Date, endDate?: Date): Promise<string[]>;

    /**
     * Clear device logs
     */
    clearDeviceLogs(deviceId: string): Promise<void>;
}
