import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import {
    DeviceCommand,
    DeviceCommandResult,
    DeviceConfiguration,
    DeviceEvent,
    DeviceHealth,
    DeviceInfo,
    IDeviceAdapter,
} from '../../interfaces';
import { DeviceOperationContext } from '@/modules/device/device-adapter.strategy';
import { DeviceStatus, DeviceType } from '@prisma/client';

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

    async getDeviceInfo(context: DeviceOperationContext): Promise<DeviceInfo> {
        const deviceId = context.device.id;
        this.logger.log('Getting device info (stub)', { deviceId });

        const device = this.devices.get(deviceId);
        if (!device) {
            // For stub adapter, return mock device info based on context
            return {
                id: context.device.id,
                name: context.device.name,
                type: context.device.type,
                status: context.device.status,
                host: context.config.host,
                capabilities: [
                    { type: context.device.type, enabled: true },
                ],
            };
        }

        return device;
    }

    async getDeviceConfiguration(context: DeviceOperationContext): Promise<DeviceConfiguration> {
        const deviceId = context.device.id;
        this.logger.log('Getting device configuration (stub)', { deviceId });

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
        context: DeviceOperationContext,
        configuration: Partial<DeviceConfiguration>
    ): Promise<void> {
        const deviceId = context.device.id;
        this.logger.log('Updating device configuration (stub)', { deviceId, configuration });

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

    async sendCommand(context: DeviceOperationContext, command: DeviceCommand): Promise<DeviceCommandResult> {
        const deviceId = context.device.id;
        this.logger.log('Sending command to device (stub)', { deviceId, command: command.command });

        if (!deviceId) {
            throw new Error('Device ID is required');
        }

        // Simulate command execution delay
        await new Promise(resolve => setTimeout(resolve, 300));

        // Mock success with 95% probability for stub testing
        const success = Math.random() > 0.05;

        return {
            success,
            message: success
                ? `Command ${command.command} executed successfully on device ${deviceId}`
                : `Command ${command.command} execution failed on device ${deviceId}`,
            data: success ? { result: 'ok', deviceId } : undefined,
            executedAt: new Date(),
        };
    }

    async getDeviceHealth(context: DeviceOperationContext): Promise<DeviceHealth> {
        const deviceId = context.device.id;
        this.logger.log('Getting device health (stub)', { deviceId });

        if (!deviceId) {
            throw new Error('Device ID is required');
        }

        // Generate mock health data
        const memoryUsage = Math.floor(Math.random() * 100);
        const diskUsage = Math.floor(Math.random() * 100);
        const temperature = Math.floor(Math.random() * 40) + 20; // 20-60°C

        let status: DeviceStatus = DeviceStatus.ONLINE; // Default to online for stub
        const issues: string[] = [];

        if (memoryUsage > 90) {
            status = DeviceStatus.ONLINE;
            issues.push('High memory usage');
        } else if (memoryUsage > 80) {
            status = DeviceStatus.ONLINE;
            issues.push('Elevated memory usage');
        }

        if (temperature > 55) {
            status = DeviceStatus.ERROR;
            issues.push('High temperature');
        } else if (temperature > 50) {
            status = DeviceStatus.ERROR;
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
        context: DeviceOperationContext,
        callback: (event: DeviceEvent) => void
    ): Promise<void> {
        const deviceId = context.device.id;
        this.logger.log('Subscribing to device events (stub)', { deviceId });

        this.eventSubscriptions.set(deviceId, callback);

        // Simulate periodic events
        this.simulateDeviceEvents(deviceId);
    }

    async unsubscribeFromEvents(context: DeviceOperationContext): Promise<void> {
        const deviceId = context.device.id;
        this.logger.log('Unsubscribing from device events (stub)', { deviceId });

        this.eventSubscriptions.delete(deviceId);
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
        const deviceId = context.device.id;
        this.logger.log('Syncing users to device (stub)', { deviceId, userCount: users.length });

        // Simulate sync delay
        await new Promise(resolve => setTimeout(resolve, users.length * 100));
    }

    async removeUser(context: DeviceOperationContext, userId: string): Promise<void> {
        const deviceId = context.device.id;
        this.logger.log('Removing user from device (stub)', { deviceId, userId });

        // Simulate removal delay
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    async testConnection(context: DeviceOperationContext): Promise<boolean> {
        const deviceId = context.device.id;
        this.logger.log('Testing device connection (stub)', { deviceId });

        if (!deviceId) {
            return false;
        }

        // Simulate connection test delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Mock success with 90% probability for stub testing
        return Math.random() > 0.1;
    }

    async rebootDevice(context: DeviceOperationContext): Promise<void> {
        const deviceId = context.device.id;
        this.logger.log('Rebooting device (stub)', { deviceId });

        // Simulate reboot delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update device status
        const device = this.devices.get(deviceId);
        if (device) {
            device.status = DeviceStatus.ONLINE;
            device.lastSeen = new Date();
        }
    }

    async updateFirmware(
        context: DeviceOperationContext,
        firmwareUrl: string
    ): Promise<{ success: boolean; message: string }> {
        const deviceId = context.device.id;
        this.logger.log('Updating device firmware (stub)', { deviceId, firmwareUrl });

        // Simulate firmware update delay
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Mock success with 85% probability
        const success = Math.random() > 0.15;

        if (success) {
            const device = this.devices.get(deviceId);
            if (device) {
                device.firmwareVersion = `v${Math.floor(Math.random() * 10) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`;
            }
        }

        return {
            success,
            message: success ? 'Firmware updated successfully' : 'Firmware update failed',
        };
    }

    async getDeviceLogs(context: DeviceOperationContext, startDate?: Date, endDate?: Date): Promise<string[]> {
        const deviceId = context.device.id;
        this.logger.log('Getting device logs (stub)', { deviceId, startDate, endDate });

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

    async clearDeviceLogs(context: DeviceOperationContext): Promise<void> {
        const deviceId = context.device.id;
        this.logger.log('Clearing device logs (stub)', { deviceId });

        // Simulate log clearing delay
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    private initializeMockDevices() {
        const mockDevices: DeviceInfo[] = [
            {
                id: 'device-001',
                name: 'Main Entrance Card Reader',
                type: DeviceType.CARD_READER,
                status: DeviceStatus.ONLINE,
                host: '192.168.1.100',
                macAddress: '00:11:22:33:44:55',
                firmwareVersion: 'v2.1.3',
                lastSeen: new Date(),
                capabilities: [
                    { type: DeviceType.CARD_READER, enabled: true },
                    { type: DeviceType.CAMERA, enabled: true },
                ],
            },
            {
                id: 'device-002',
                name: 'Office Biometric Scanner',
                type: DeviceType.FINGERPRINT,
                status: DeviceStatus.ONLINE,
                host: '192.168.1.101',
                macAddress: '00:11:22:33:44:56',
                firmwareVersion: 'v1.8.2',
                lastSeen: new Date(),
                capabilities: [
                    { type: DeviceType.FINGERPRINT, enabled: true },
                    { type: DeviceType.OTHER, enabled: true },
                ],
            },
            {
                id: 'device-003',
                name: 'Visitor QR Scanner',
                type: DeviceType.OTHER,
                status: DeviceStatus.OFFLINE,
                host: '192.168.1.102',
                macAddress: '00:11:22:33:44:57',
                firmwareVersion: 'v1.5.1',
                lastSeen: new Date(Date.now() - 3600000), // 1 hour ago
                capabilities: [{ type: DeviceType.OTHER, enabled: true }],
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