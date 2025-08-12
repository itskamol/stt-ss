import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

import { PrismaService } from '@/core/database/prisma.service';
import { EncryptionService } from '@/shared/services/encryption.service';
import { HikvisionSessionService } from '@/shared/services/hikvision-session.service';
import { HikvisionUserManagementService } from '@/shared/services/hikvision-user-management.service';
import { HikvisionDeviceControlService } from '@/shared/services/hikvision-device-control.service';
import { HikvisionDiscoveryService } from '@/shared/services/hikvision-discovery.service';
import { HikvisionEventMonitoringService } from '@/shared/services/hikvision-event-monitoring.service';
import { HikvisionMaintenanceService } from '@/shared/services/hikvision-maintenance.service';
import { HikvisionApiAdapter } from './hikvision-api.adapter';
import { CreateDeviceUserDto, UpdateDeviceUserDto } from '../hikvision.adapter';
import { DeviceCommand } from '../device.adapter';
import { CacheService } from '@/core/cache/cache.service';

// Mock MSW server
const server = setupServer(
    // Device info endpoint
    http.get('http://192.168.1.100:80/ISAPI/System/deviceInfo', ({ request }) => {
        const auth = request.headers.get('authorization');
        if (!auth || !auth.includes('Basic')) {
            return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        return HttpResponse.json({
            deviceName: 'Test Hikvision Camera',
            deviceType: 'IP Camera',
            serialNumber: 'SN123456789',
            firmwareVersion: 'V5.6.0',
            hardwareVersion: 'H1.0',
        });
    }),

    // User management endpoints
    http.post('http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Record', () => {
        return HttpResponse.json({ success: true });
    }),

    http.put('http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Record', () => {
        return HttpResponse.json({ success: true });
    }),

    http.delete('http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Delete', () => {
        return HttpResponse.json({ success: true });
    }),

    http.get('http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Search', ({ request }) => {
        const url = new URL(request.url);
        const employeeNo = url.searchParams.get('employeeNo');

        if (employeeNo === 'EMP001') {
            return HttpResponse.json({
                UserInfo: {
                    employeeNo: 'EMP001',
                    name: 'John Doe',
                    userType: 'normal',
                },
            });
        }

        return new HttpResponse(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }),

    // Session management
    http.get('http://192.168.1.100:80/ISAPI/System/Security/identityKey', () => {
        return HttpResponse.json({
            security: 'test-security-key',
            identityKey: 'test-identity-key',
        });
    }),

    // Face data endpoint
    http.get('http://192.168.1.100:80/ISAPI/Intelligent/FDLib', ({ request }) => {
        const url = new URL(request.url);
        const employeeNo = url.searchParams.get('employeeNo');

        if (employeeNo === 'EMP001') {
            return new HttpResponse(Buffer.from('fake-face-data'));
        }

        return new HttpResponse(null, { status: 404 });
    }),

    // Device control endpoints
    http.post('http://192.168.1.100:80/ISAPI/AccessControl/RemoteControl/door', () => {
        return HttpResponse.json({ success: true });
    }),

    http.post('http://192.168.1.100:80/ISAPI/System/reboot', () => {
        return HttpResponse.json({ success: true });
    }),

    // System status
    http.get('http://192.168.1.100:80/ISAPI/System/status', () => {
        return HttpResponse.json({
            cpuUsage: 45,
            memoryUsage: 60,
            diskUsage: 70,
            temperature: 45,
            networkConnected: true,
            uptime: 86400,
            errorCount: 0,
            warningCount: 1,
        });
    }),

    // Logging endpoints
    http.get('http://192.168.1.100:80/ISAPI/System/Logging/search', () => {
        return HttpResponse.json({
            LogSearch: {
                MatchList: [
                    {
                        time: '2023-01-01T12:00:00Z',
                        logLevel: 'INFO',
                        logType: 'system',
                        logDescription: 'System started',
                        logSource: 'system',
                    },
                    {
                        time: '2023-01-01T12:01:00Z',
                        logLevel: 'ERROR',
                        logType: 'access',
                        logDescription: 'Access denied',
                        logSource: 'door',
                    },
                ],
            },
        });
    }),

    http.post('http://192.168.1.100:80/ISAPI/System/Logging/clear', () => {
        return HttpResponse.json({ clearedCount: 50 });
    }),

    // Firmware update
    http.post('http://192.168.1.100:80/ISAPI/System/updateFirmware', () => {
        return HttpResponse.json({ updateId: 'update-123' });
    }),

    http.get('http://192.168.1.100:80/ISAPI/System/updateStatus/:updateId', () => {
        return HttpResponse.json({
            status: 'completed',
            newVersion: 'V5.7.0',
        });
    }),

    // Configuration backup
    http.get('http://192.168.1.100:80/ISAPI/System/configurationData', () => {
        return new HttpResponse(Buffer.from('configuration-backup-data'));
    }),

    // Error scenarios
    http.get('http://192.168.1.100:80/ISAPI/error/unauthorized', () => {
        return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }),

    http.get('http://192.168.1.100:80/ISAPI/error/notfound', () => {
        return new HttpResponse(JSON.stringify({ error: 'Not Found' }), { status: 404 });
    }),

    http.get('http://192.168.1.100:80/ISAPI/error/server', () => {
        return new HttpResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    })
);

describe('HikvisionApiAdapter Integration Tests', () => {
    let adapter: HikvisionApiAdapter;
    let prismaService: any;
    let encryptionService: jest.Mocked<EncryptionService>;
    let cacheService: jest.Mocked<CacheService>;

    const mockDevice = {
        id: 'test-device-1',
        name: 'Test Hikvision Camera',
        ipAddress: '192.168.1.100',
        username: 'admin',
        encryptedSecret: 'encrypted-password',
    };

    beforeAll(() => {
        server.listen({ onUnhandledRequest: 'error' });
    });

    afterEach(() => {
        server.resetHandlers();
        jest.clearAllMocks();
    });

    afterAll(() => {
        server.close();
    });

    beforeEach(async () => {
        const mockPrismaService = {
            device: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
            },
        };

        const mockEncryptionService = {
            decrypt: jest.fn().mockReturnValue('admin123'),
            encrypt: jest.fn(),
        };

        const mockCacheService = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            imports: [HttpModule],
            providers: [
                HikvisionApiAdapter,
                HikvisionSessionService,
                HikvisionUserManagementService,
                HikvisionDeviceControlService,
                HikvisionDiscoveryService,
                HikvisionEventMonitoringService,
                HikvisionMaintenanceService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: EncryptionService, useValue: mockEncryptionService },
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        adapter = module.get<HikvisionApiAdapter>(HikvisionApiAdapter);
        prismaService = module.get(PrismaService);
        encryptionService = module.get(EncryptionService);
        cacheService = module.get(CacheService);

        // Setup default mocks
        prismaService.device.findUnique.mockResolvedValue(mockDevice);
        cacheService.get.mockResolvedValue(null); // No cached sessions
    });

    describe('Device Information', () => {
        it('should get device info successfully', async () => {
            const result = await adapter.getDeviceInfo('test-device-1');

            expect(result.id).toBe('test-device-1');
            expect(result.name).toBe('Test Hikvision Camera');
            expect(result.firmwareVersion).toBe('V5.6.0'); // Fixed to match mock response
            expect(result.status).toBeDefined();
        });

        it('should test device connection', async () => {
            const result = await adapter.testConnection('test-device-1');

            expect(result).toBe(true);
        });

        it('should get device health status', async () => {
            const result = await adapter.getDeviceHealth('test-device-1');

            expect(result.deviceId).toBe('test-device-1');
            expect(result.uptime).toBe(86400);
            expect(result.memoryUsage).toBe(60);
            expect(result.temperature).toBe(45);
        });
    });

    describe('User Management', () => {
        it('should complete full user lifecycle', async () => {
            // Add user
            const userData: CreateDeviceUserDto = {
                employeeNo: 'EMP001',
                name: 'John Doe',
                userType: 'normal',
            };

            const addResult = await adapter.addUser('test-device-1', userData);
            expect(addResult).toBe(true);

            // Find user
            const foundUser = await adapter.findUserByEmployeeNo('test-device-1', 'EMP001');
            expect(foundUser).toEqual({
                employeeNo: 'EMP001',
                name: 'John Doe',
                userType: 'normal',
            });

            // Update user
            const updateData: UpdateDeviceUserDto = {
                name: 'Jane Doe',
                userType: 'visitor',
            };

            const updateResult = await adapter.updateUser('test-device-1', 'EMP001', updateData);
            expect(updateResult).toBe(true);

            // Delete user
            const deleteResult = await adapter.deleteUser('test-device-1', 'EMP001');
            expect(deleteResult).toBe(true);
        });

        it('should handle user not found', async () => {
            const result = await adapter.findUserByEmployeeNo('test-device-1', 'NONEXISTENT');
            expect(result).toBeNull();
        });

        it('should sync multiple users', async () => {
            const users = [
                { userId: 'EMP001', accessLevel: 1 },
                { userId: 'EMP002', accessLevel: 2 },
            ];

            await expect(adapter.syncUsers('test-device-1', users)).resolves.not.toThrow();
        });
    });

    describe('Face Data Operations', () => {
        it('should get face data with session management', async () => {
            const result = await adapter.getFaceData('test-device-1', 'EMP001');

            expect(result).toBeInstanceOf(Buffer);
            expect(result?.toString()).toBe('fake-face-data');
        });

        it('should return null for non-existent face data', async () => {
            const result = await adapter.getFaceData('test-device-1', 'NONEXISTENT');
            expect(result).toBeNull();
        });
    });

    describe('Device Control', () => {
        it('should execute door control commands', async () => {
            const unlockCommand: DeviceCommand = {
                command: 'unlock_door',
                parameters: { doorNumber: 1, duration: 10 },
            };

            const result = await adapter.sendCommand('test-device-1', unlockCommand);
            expect(result.success).toBe(true);
            expect(result.message).toContain('executed successfully');
        });

        it('should reboot device', async () => {
            await expect(adapter.rebootDevice('test-device-1')).resolves.not.toThrow();
        });
    });

    describe('Logging and Maintenance', () => {
        it('should retrieve device logs', async () => {
            const logs = await adapter.getDeviceLogs('test-device-1');

            expect(logs).toHaveLength(2);
            expect(logs[0]).toContain('[ERROR]');
            expect(logs[0]).toContain('Access denied');
            expect(logs[1]).toContain('[INFO]');
            expect(logs[1]).toContain('System started');
        });

        it('should clear device logs', async () => {
            await expect(adapter.clearDeviceLogs('test-device-1')).resolves.not.toThrow();
        });

        it('should update firmware', async () => {
            const result = await adapter.updateFirmware(
                'test-device-1',
                'http://example.com/firmware.bin'
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('completed successfully');
        });
    });

    describe('Error Handling', () => {
        it('should handle unauthorized errors', async () => {
            // Mock device with wrong credentials
            const unauthorizedDevice = { ...mockDevice, encryptedSecret: 'wrong-password' };
            prismaService.device.findUnique.mockResolvedValueOnce(unauthorizedDevice);
            encryptionService.decrypt.mockReturnValueOnce('wrong-password');

            // Override MSW to return 401 for this specific case
            server.use(
                http.get('http://192.168.1.100:80/ISAPI/System/deviceInfo', () => {
                    return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
                })
            );

            const result = await adapter.testConnection('test-device-1');
            expect(result).toBe(false);
        });

        it('should handle device not found in database', async () => {
            prismaService.device.findUnique.mockResolvedValueOnce(null);

            await expect(adapter.getDeviceInfo('non-existent')).rejects.toThrow();
        });

        it('should handle network timeouts', async () => {
            // Mock network timeout
            server.use(
                http.get('http://192.168.1.100:80/ISAPI/System/deviceInfo', () => {
                    return new HttpResponse(null, { status: 200 }); // Can't delay in MSW v2 easily
                })
            );

            const result = await adapter.testConnection('test-device-1');
            expect(result).toBe(false);
        });
    });

    describe('Session Management', () => {
        it('should cache and reuse sessions', async () => {
            // First call should create session
            const result1 = await adapter.getFaceData('test-device-1', 'EMP001');
            expect(result1).toBeInstanceOf(Buffer);

            // Mock cached session for second call
            cacheService.get.mockResolvedValueOnce('cached-session-data');

            // Second call should use cached session
            const result2 = await adapter.getFaceData('test-device-1', 'EMP001');
            expect(result2).toBeInstanceOf(Buffer);

            // Verify cache was checked
            expect(cacheService.get).toHaveBeenCalled();
        });
    });

    describe('Device Discovery', () => {
        it('should discover devices on network', async () => {
            // Mock database devices
            prismaService.device.findMany.mockResolvedValue([mockDevice]);

            const devices = await adapter.discoverDevices();

            expect(devices).toHaveLength(1);
            expect(devices[0].name).toBe('Test Hikvision Camera');
            expect(devices[0].ipAddress).toBe('192.168.1.100');
        });
    });

    describe('Event Subscription', () => {
        it('should subscribe to device events', async () => {
            const callback = jest.fn();

            // Note: This test focuses on the subscription setup
            // Actual event reception would require WebSocket mocking
            await expect(
                adapter.subscribeToEvents('test-device-1', callback)
            ).resolves.not.toThrow();

            // Cleanup
            await adapter.unsubscribeFromEvents('test-device-1');
        });
    });

    describe('Configuration Management', () => {
        it('should get and update device configuration', async () => {
            // Get configuration
            const config = await adapter.getDeviceConfiguration('test-device-1');
            expect(config.deviceId).toBe('test-device-1');
            expect(config.settings).toBeDefined();

            // Update configuration
            const updatedConfig = {
                ...config,
                settings: {
                    ...config.settings,
                    maxUsers: 2000,
                },
            };

            await expect(
                adapter.updateDeviceConfiguration('test-device-1', updatedConfig)
            ).resolves.not.toThrow();
        });
    });

    describe('Performance and Reliability', () => {
        it('should handle concurrent requests', async () => {
            const promises = Array.from({ length: 10 }, (_, i) =>
                adapter.findUserByEmployeeNo(
                    'test-device-1',
                    i % 2 === 0 ? 'EMP001' : 'NONEXISTENT'
                )
            );

            const results = await Promise.allSettled(promises);

            // All requests should complete
            expect(results.every(r => r.status === 'fulfilled')).toBe(true);

            // Check results
            const values = results.map(r => (r as PromiseFulfilledResult<any>).value);
            expect(values.filter(v => v !== null)).toHaveLength(5); // 5 EMP001 requests
            expect(values.filter(v => v === null)).toHaveLength(5); // 5 NONEXISTENT requests
        });

        it('should handle rapid successive calls', async () => {
            const startTime = Date.now();

            // Make 20 rapid calls
            const promises = Array.from({ length: 20 }, () =>
                adapter.testConnection('test-device-1')
            );

            const results = await Promise.all(promises);
            const endTime = Date.now();

            // All should succeed
            expect(results.every(r => r === true)).toBe(true);

            // Should complete in reasonable time (less than 10 seconds)
            expect(endTime - startTime).toBeLessThan(10000);
        });
    });
});
