import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../core/logger/logger.service';
import {
    DeviceCommand,
    DeviceCommandResult,
    DeviceConfiguration,
    DeviceEvent,
    DeviceHealth,
    DeviceInfo,
    IDeviceAdapter,
} from '../device.adapter';

@Injectable()
export class StubDeviceAdapter implements IDeviceAdapter {
    private devices: Map<string, DeviceInfo> = new Map();
    private configurations: Map<string, DeviceConfiguration> = new Map();
    private eventSubscriptions: Map<string, (event: DeviceEvent) => void> = new Map();

    constructor(private readonly logger: LoggerService) {
        this.initializeMockDevices();
    }

    async discoverDevices(): Promise<DeviceInfo[]> {
        this.logger.log('Discovering devices (stub)');

        // Simulate discovery delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        return Array.from(this.devices.values());
    }

    async getDeviceInfo(deviceId: string): Promise<DeviceInfo> {
        this.logger.log('Getting device info (stub)', { deviceId });

        const device = this.devices.get(deviceId);
        if (!device) {
            throw new Error(`Device not found: ${deviceId}`);
        }

        return device;
    }

    async getDeviceConfiguration(deviceId: string): Promise<DeviceConfiguration> {
        this.logger.log('Getting device configuration (stub)', { deviceId });

        if (!this.devices.has(deviceId)) {
            throw new Error(`Device not found: ${deviceId}`);
        }

        return (
            this.configurations.get(deviceId) || {
                deviceId,
                settings: {},
                schedules: [],
                accessRules: [],
            }
        );
    }

    async updateDeviceConfiguration(
        deviceId: string,
        configuration: Partial<DeviceConfiguration>
    ): Promise<void> {
        this.logger.log('Updating device configuration (stub)', { deviceId, configuration });

        if (!this.devices.has(deviceId)) {
            throw new Error(`Device not found: ${deviceId}`);
        }

        const existingConfig = this.configurations.get(deviceId) || {
            deviceId,
            settings: {},
            schedules: [],
            accessRules: [],
        };

        this.configurations.set(deviceId, {
            ...existingConfig,
            ...configuration,
        });

        // Simulate configuration update delay
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    async sendCommand(deviceId: string, command: DeviceCommand): Promise<DeviceCommandResult> {
        this.logger.log('Sending command to device (stub)', { deviceId, command: command.command });

        if (!this.devices.has(deviceId)) {
            throw new Error(`Device not found: ${deviceId}`);
        }

        // Simulate command execution delay
        await new Promise(resolve => setTimeout(resolve, 300));

        // Mock success with 95% probability
        const success = Math.random() > 0.05;

        return {
            success,
            message: success
                ? `Command ${command.command} executed successfully`
                : 'Command execution failed',
            data: success ? { result: 'ok' } : undefined,
            executedAt: new Date(),
        };
    }

    async getDeviceHealth(deviceId: string): Promise<DeviceHealth> {
        this.logger.log('Getting device health (stub)', { deviceId });

        if (!this.devices.has(deviceId)) {
            throw new Error(`Device not found: ${deviceId}`);
        }

        // Generate mock health data
        const memoryUsage = Math.floor(Math.random() * 100);
        const diskUsage = Math.floor(Math.random() * 100);
        const temperature = Math.floor(Math.random() * 40) + 20; // 20-60°C

        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        const issues: string[] = [];

        if (memoryUsage > 90) {
            status = 'critical';
            issues.push('High memory usage');
        } else if (memoryUsage > 80) {
            status = 'warning';
            issues.push('Elevated memory usage');
        }

        if (temperature > 55) {
            status = 'critical';
            issues.push('High temperature');
        } else if (temperature > 50) {
            status = 'warning';
            issues.push('Elevated temperature');
        }

        return {
            deviceId,
            status,
            uptime: Math.floor(Math.random() * 86400 * 30), // Random uptime up to 30 days
            memoryUsage,
            diskUsage,
            temperature,
            lastHealthCheck: new Date(),
            issues: issues.length > 0 ? issues : undefined,
        };
    }

    async subscribeToEvents(
        deviceId: string,
        callback: (event: DeviceEvent) => void
    ): Promise<void> {
        this.logger.log('Subscribing to device events (stub)', { deviceId });

        if (!this.devices.has(deviceId)) {
            throw new Error(`Device not found: ${deviceId}`);
        }

        this.eventSubscriptions.set(deviceId, callback);

        // Simulate periodic events
        this.simulateDeviceEvents(deviceId);
    }

    async unsubscribeFromEvents(deviceId: string): Promise<void> {
        this.logger.log('Unsubscribing from device events (stub)', { deviceId });

        this.eventSubscriptions.delete(deviceId);
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
        this.logger.log('Syncing users to device (stub)', { deviceId, userCount: users.length });

        if (!this.devices.has(deviceId)) {
            throw new Error(`Device not found: ${deviceId}`);
        }

        // Simulate sync delay
        await new Promise(resolve => setTimeout(resolve, users.length * 100));
    }

    async removeUser(deviceId: string, userId: string): Promise<void> {
        this.logger.log('Removing user from device (stub)', { deviceId, userId });

        if (!this.devices.has(deviceId)) {
            throw new Error(`Device not found: ${deviceId}`);
        }

        // Simulate removal delay
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    async testConnection(deviceId: string): Promise<boolean> {
        this.logger.log('Testing device connection (stub)', { deviceId });

        if (!this.devices.has(deviceId)) {
            return false;
        }

        // Simulate connection test delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Mock success with 90% probability
        return Math.random() > 0.1;
    }

    async rebootDevice(deviceId: string): Promise<void> {
        this.logger.log('Rebooting device (stub)', { deviceId });

        if (!this.devices.has(deviceId)) {
            throw new Error(`Device not found: ${deviceId}`);
        }

        // Simulate reboot delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update device status
        const device = this.devices.get(deviceId)!;
        device.status = 'online';
        device.lastSeen = new Date();
    }

    async updateFirmware(
        deviceId: string,
        firmwareUrl: string
    ): Promise<{ success: boolean; message: string }> {
        this.logger.log('Updating device firmware (stub)', { deviceId, firmwareUrl });

        if (!this.devices.has(deviceId)) {
            throw new Error(`Device not found: ${deviceId}`);
        }

        // Simulate firmware update delay
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Mock success with 85% probability
        const success = Math.random() > 0.15;

        if (success) {
            const device = this.devices.get(deviceId)!;
            device.firmwareVersion = `v${Math.floor(Math.random() * 10) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`;
        }

        return {
            success,
            message: success ? 'Firmware updated successfully' : 'Firmware update failed',
        };
    }

    async getDeviceLogs(deviceId: string, startDate?: Date, endDate?: Date): Promise<string[]> {
        this.logger.log('Getting device logs (stub)', { deviceId, startDate, endDate });

        if (!this.devices.has(deviceId)) {
            throw new Error(`Device not found: ${deviceId}`);
        }

        // Generate mock logs
        const logs = [
            `${new Date().toISOString()} [INFO] Device started`,
            `${new Date().toISOString()} [INFO] Network connection established`,
            `${new Date().toISOString()} [DEBUG] User sync completed`,
            `${new Date().toISOString()} [INFO] Access granted for user-123`,
            `${new Date().toISOString()} [WARN] High memory usage detected`,
        ];

        return logs;
    }

    async clearDeviceLogs(deviceId: string): Promise<void> {
        this.logger.log('Clearing device logs (stub)', { deviceId });

        if (!this.devices.has(deviceId)) {
            throw new Error(`Device not found: ${deviceId}`);
        }

        // Simulate log clearing delay
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    private initializeMockDevices() {
        const mockDevices: DeviceInfo[] = [
            {
                id: 'device-001',
                name: 'Main Entrance Card Reader',
                type: 'card_reader',
                status: 'online',
                ipAddress: '192.168.1.100',
                macAddress: '00:11:22:33:44:55',
                firmwareVersion: 'v2.1.3',
                lastSeen: new Date(),
                capabilities: [
                    { type: 'card_read', enabled: true },
                    { type: 'door_control', enabled: true },
                ],
            },
            {
                id: 'device-002',
                name: 'Office Biometric Scanner',
                type: 'biometric',
                status: 'online',
                ipAddress: '192.168.1.101',
                macAddress: '00:11:22:33:44:56',
                firmwareVersion: 'v1.8.2',
                lastSeen: new Date(),
                capabilities: [
                    { type: 'biometric_scan', enabled: true },
                    { type: 'door_control', enabled: true },
                ],
            },
            {
                id: 'device-003',
                name: 'Visitor QR Scanner',
                type: 'qr_scanner',
                status: 'offline',
                ipAddress: '192.168.1.102',
                macAddress: '00:11:22:33:44:57',
                firmwareVersion: 'v1.5.1',
                lastSeen: new Date(Date.now() - 3600000), // 1 hour ago
                capabilities: [{ type: 'qr_scan', enabled: true }],
            },
        ];

        mockDevices.forEach(device => {
            this.devices.set(device.id, device);
        });
    }

    private simulateDeviceEvents(deviceId: string) {
        const callback = this.eventSubscriptions.get(deviceId);
        if (!callback) return;

        // Simulate random events every 10-30 seconds
        const interval = setInterval(
            () => {
                if (!this.eventSubscriptions.has(deviceId)) {
                    clearInterval(interval);
                    return;
                }

                const eventTypes = [
                    'access_granted',
                    'access_denied',
                    'door_opened',
                    'door_closed',
                ];
                const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)] as any;

                const event: DeviceEvent = {
                    deviceId,
                    eventType,
                    timestamp: new Date(),
                    userId:
                        Math.random() > 0.5 ? `user-${Math.floor(Math.random() * 100)}` : undefined,
                    cardId:
                        Math.random() > 0.7
                            ? `card-${Math.floor(Math.random() * 1000)}`
                            : undefined,
                    data: { mockEvent: true },
                };

                callback(event);
            },
            Math.random() * 20000 + 10000
        ); // 10-30 seconds
    }
}
