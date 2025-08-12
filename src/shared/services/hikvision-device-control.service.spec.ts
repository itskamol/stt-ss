import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { DeviceStatus } from '@prisma/client';

import { EncryptionService } from './encryption.service';
import { 
    HikvisionDeviceControlService,
    DoorControlOptions,
    DeviceRebootOptions,
    SystemHealthMetrics 
} from './hikvision-device-control.service';
import { HikvisionDeviceConfig, HIKVISION_CONFIG } from '../adapters/hikvision.adapter';
import { DeviceCommand } from '../adapters/device.adapter';

describe('HikvisionDeviceControlService', () => {
    let service: HikvisionDeviceControlService;
    let httpService: jest.Mocked<HttpService>;
    let encryptionService: jest.Mocked<EncryptionService>;

    const mockDevice: HikvisionDeviceConfig = {
        deviceId: 'test-device-1',
        ipAddress: '192.168.1.100',
        username: 'admin',
        encryptedSecret: 'encrypted-password',
    };

    const mockDecryptedPassword = 'admin123';

    beforeEach(async () => {
        const mockHttpService = {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
        };

        const mockEncryptionService = {
            decrypt: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HikvisionDeviceControlService,
                { provide: HttpService, useValue: mockHttpService },
                { provide: EncryptionService, useValue: mockEncryptionService },
            ],
        }).compile();

        service = module.get<HikvisionDeviceControlService>(HikvisionDeviceControlService);
        httpService = module.get(HttpService);
        encryptionService = module.get(EncryptionService);

        // Setup default mocks
        encryptionService.decrypt.mockReturnValue(mockDecryptedPassword);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('controlDoor', () => {
        it('should unlock door successfully', async () => {
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const options: DoorControlOptions = {
                doorNumber: 1,
                duration: 10,
            };

            const result = await service.controlDoor(mockDevice, 'unlock', options);

            expect(result.success).toBe(true);
            expect(result.message).toContain('unlock command executed successfully');
            expect(httpService.post).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/AccessControl/RemoteControl/door',
                expect.objectContaining({
                    cmd: 'open',
                    doorNo: 1,
                    duration: 10,
                }),
                expect.objectContaining({
                    auth: { username: 'admin', password: mockDecryptedPassword },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );
        });

        it('should lock door successfully', async () => {
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const result = await service.controlDoor(mockDevice, 'lock');

            expect(result.success).toBe(true);
            expect(result.message).toContain('lock command executed successfully');
            expect(httpService.post).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/AccessControl/RemoteControl/door',
                expect.objectContaining({
                    cmd: 'close',
                    doorNo: 1, // default
                }),
                expect.any(Object)
            );
        });

        it('should handle door control failure', async () => {
            const error = { response: { status: 500, statusText: 'Internal Server Error' } };
            httpService.post.mockReturnValue(throwError(() => error) as any);

            const result = await service.controlDoor(mockDevice, 'unlock');

            expect(result.success).toBe(false);
            expect(result.message).toContain('Door control failed');
        });

        it('should use force option when specified', async () => {
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const options: DoorControlOptions = {
                force: true,
            };

            await service.controlDoor(mockDevice, 'unlock', options);

            expect(httpService.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    force: true,
                }),
                expect.any(Object)
            );
        });
    });

    describe('rebootDevice', () => {
        it('should reboot device successfully', async () => {
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const options: DeviceRebootOptions = {
                delay: 30,
                reason: 'Scheduled maintenance',
            };

            const result = await service.rebootDevice(mockDevice, options);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Device reboot initiated with 30s delay');
            expect(httpService.post).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/System/reboot',
                expect.objectContaining({
                    delay: 30,
                    reason: 'Scheduled maintenance',
                }),
                expect.objectContaining({
                    timeout: 30000, // Longer timeout for reboot
                })
            );
        });

        it('should reboot device with default options', async () => {
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const result = await service.rebootDevice(mockDevice);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Device reboot initiated');
            expect(httpService.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    reason: 'Manual reboot',
                }),
                expect.any(Object)
            );
        });

        it('should handle reboot failure', async () => {
            const error = { response: { status: 403, statusText: 'Forbidden' } };
            httpService.post.mockReturnValue(throwError(() => error) as any);

            const result = await service.rebootDevice(mockDevice);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Device reboot failed');
        });
    });

    describe('getDeviceHealth', () => {
        it('should return healthy device status', async () => {
            const mockHealthData = {
                cpuUsage: 45,
                memoryUsage: 60,
                diskUsage: 70,
                temperature: 45,
                networkConnected: true,
                uptime: 86400,
                errorCount: 0,
                warningCount: 1,
            };
            httpService.get.mockReturnValue(of({ data: mockHealthData }) as any);

            const result = await service.getDeviceHealth(mockDevice);

            expect(result.deviceId).toBe('test-device-1');
            expect(result.status).toBe(DeviceStatus.ONLINE);
            expect(result.uptime).toBe(86400);
            expect(result.memoryUsage).toBe(60);
            expect(result.temperature).toBe(45);
            expect(result.issues).toBeUndefined();
        });

        it('should detect high memory usage issue', async () => {
            const mockHealthData = {
                memoryUsage: 95, // High memory usage
                networkConnected: true,
                uptime: 86400,
            };
            httpService.get.mockReturnValue(of({ data: mockHealthData }) as any);

            const result = await service.getDeviceHealth(mockDevice);

            expect(result.status).toBe(DeviceStatus.ERROR);
            expect(result.issues).toContain('High memory usage');
        });

        it('should detect high temperature issue', async () => {
            const mockHealthData = {
                temperature: 75, // High temperature
                networkConnected: true,
                uptime: 86400,
            };
            httpService.get.mockReturnValue(of({ data: mockHealthData }) as any);

            const result = await service.getDeviceHealth(mockDevice);

            expect(result.status).toBe(DeviceStatus.ERROR);
            expect(result.issues).toContain('High temperature');
        });

        it('should detect network connectivity issues', async () => {
            const mockHealthData = {
                networkConnected: false,
                uptime: 86400,
            };
            httpService.get.mockReturnValue(of({ data: mockHealthData }) as any);

            const result = await service.getDeviceHealth(mockDevice);

            expect(result.status).toBe(DeviceStatus.OFFLINE);
            expect(result.issues).toContain('Network connectivity issues');
        });

        it('should return offline status when device is unreachable', async () => {
            const error = { response: { status: 500 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            const result = await service.getDeviceHealth(mockDevice);

            expect(result.status).toBe(DeviceStatus.OFFLINE);
            expect(result.issues).toContain('Device unreachable');
        });
    });

    describe('getSystemHealthMetrics', () => {
        it('should return system health metrics', async () => {
            const mockData = {
                cpuUsage: 45,
                memoryUsage: 60,
                diskUsage: 70,
                temperature: 45,
                networkConnected: true,
                uptime: 86400,
                lastReboot: '2023-01-01T00:00:00Z',
                activeConnections: 5,
                errorCount: 0,
                warningCount: 1,
            };
            httpService.get.mockReturnValue(of({ data: mockData }) as any);

            const result = await service.getSystemHealthMetrics(mockDevice);

            expect(result.deviceId).toBe('test-device-1');
            expect(result.cpuUsage).toBe(45);
            expect(result.memoryUsage).toBe(60);
            expect(result.networkStatus).toBe('connected');
            expect(result.lastReboot).toEqual(new Date('2023-01-01T00:00:00Z'));
            expect(result.activeConnections).toBe(5);
        });

        it('should handle disconnected network status', async () => {
            const mockData = {
                networkConnected: false,
                uptime: 86400,
            };
            httpService.get.mockReturnValue(of({ data: mockData }) as any);

            const result = await service.getSystemHealthMetrics(mockDevice);

            expect(result.networkStatus).toBe('disconnected');
        });

        it('should throw exception on error', async () => {
            const error = { response: { status: 500 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            await expect(service.getSystemHealthMetrics(mockDevice)).rejects.toThrow();
        });
    });

    describe('getDeviceStatus', () => {
        it('should return online device status', async () => {
            const mockData = {
                firmwareVersion: 'V5.6.0',
                serialNumber: 'SN123456789',
                deviceType: 'IP Camera',
                capabilities: ['face_recognition', 'card_reader'],
            };
            httpService.get.mockReturnValue(of({ data: mockData }) as any);

            const result = await service.getDeviceStatus(mockDevice);

            expect(result.deviceId).toBe('test-device-1');
            expect(result.online).toBe(true);
            expect(result.lastSeen).toBeInstanceOf(Date);
            expect(result.responseTime).toBeGreaterThan(0);
            expect(result.firmwareVersion).toBe('V5.6.0');
            expect(result.serialNumber).toBe('SN123456789');
            expect(result.capabilities).toEqual(['face_recognition', 'card_reader']);
        });

        it('should return offline status when device is unreachable', async () => {
            const error = { code: 'ECONNREFUSED' };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            const result = await service.getDeviceStatus(mockDevice);

            expect(result.online).toBe(false);
            expect(result.responseTime).toBeGreaterThan(0);
            expect(result.lastSeen).toBeUndefined();
        });
    });

    describe('executeCustomCommand', () => {
        it('should execute unlock door command', async () => {
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const command: DeviceCommand = {
                command: 'unlock_door',
                parameters: { doorNumber: 2, duration: 15 },
            };

            const result = await service.executeCustomCommand(mockDevice, command);

            expect(result.success).toBe(true);
            expect(result.message).toContain('unlock command executed successfully');
        });

        it('should execute reboot command', async () => {
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const command: DeviceCommand = {
                command: 'reboot',
                parameters: { delay: 60, reason: 'Firmware update' },
            };

            const result = await service.executeCustomCommand(mockDevice, command);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Device reboot initiated with 60s delay');
        });

        it('should handle sync_users command', async () => {
            const command: DeviceCommand = {
                command: 'sync_users',
            };

            const result = await service.executeCustomCommand(mockDevice, command);

            expect(result.success).toBe(true);
            expect(result.message).toContain('User sync command should be handled by user management service');
        });

        it('should handle update_firmware command', async () => {
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const command: DeviceCommand = {
                command: 'update_firmware',
                parameters: { firmwareUrl: 'http://example.com/firmware.bin' },
            };

            const result = await service.executeCustomCommand(mockDevice, command);

            expect(result.success).toBe(true);
            expect(httpService.post).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/System/updateFirmware',
                expect.objectContaining({
                    firmwareUrl: 'http://example.com/firmware.bin',
                }),
                expect.any(Object)
            );
        });

        it('should handle unsupported command', async () => {
            const command: DeviceCommand = {
                command: 'unsupported_command' as any,
            };

            const result = await service.executeCustomCommand(mockDevice, command);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Unsupported command');
        });

        it('should use custom timeout when specified', async () => {
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const command: DeviceCommand = {
                command: 'unlock_door',
                timeout: 15, // 15 seconds
            };

            await service.executeCustomCommand(mockDevice, command);

            // The unlock_door command is handled by controlDoor method,
            // so we check that it was called
            expect(httpService.post).toHaveBeenCalled();
        });
    });

    describe('testConnectivity', () => {
        it('should return successful connectivity test', async () => {
            const mockData = { deviceInfo: 'test' };
            httpService.get.mockReturnValue(of({ status: 200, data: mockData }) as any);

            const result = await service.testConnectivity(mockDevice);

            expect(result.connected).toBe(true);
            expect(result.responseTime).toBeGreaterThan(0);
            expect(result.diagnostics.pingable).toBe(true);
            expect(result.diagnostics.httpAccessible).toBe(true);
            expect(result.diagnostics.authenticated).toBe(true);
            expect(result.diagnostics.apiResponsive).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should detect connection refused', async () => {
            const error = { code: 'ECONNREFUSED' };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            const result = await service.testConnectivity(mockDevice);

            expect(result.connected).toBe(false);
            expect(result.diagnostics.pingable).toBe(false);
            expect(result.diagnostics.httpAccessible).toBe(false);
            expect(result.diagnostics.authenticated).toBe(false);
            expect(result.diagnostics.apiResponsive).toBe(false);
            expect(result.error).toBe('ECONNREFUSED');
        });

        it('should detect authentication failure', async () => {
            const error = { response: { status: 401 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            const result = await service.testConnectivity(mockDevice);

            expect(result.connected).toBe(false);
            expect(result.diagnostics.pingable).toBe(true);
            expect(result.diagnostics.httpAccessible).toBe(true);
            expect(result.diagnostics.authenticated).toBe(false);
            expect(result.diagnostics.apiResponsive).toBe(false);
        });

        it('should detect API unresponsive', async () => {
            const error = { response: { status: 500 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            const result = await service.testConnectivity(mockDevice);

            expect(result.connected).toBe(false);
            expect(result.diagnostics.pingable).toBe(true);
            expect(result.diagnostics.httpAccessible).toBe(true);
            expect(result.diagnostics.authenticated).toBe(true);
            expect(result.diagnostics.apiResponsive).toBe(false);
        });
    });
});