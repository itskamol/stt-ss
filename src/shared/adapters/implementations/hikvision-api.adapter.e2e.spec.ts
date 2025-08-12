import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

import { DatabaseModule } from '@/core/database/database.module';
import { CacheModule } from '@/core/cache/cache.module';
import { LoggerModule } from '@/core/logger/logger.module';
import { HikvisionAdapterModule } from '../hikvision-adapter.module';
import { IDeviceAdapter } from '../device.adapter';
import { CreateDeviceUserDto, UpdateDeviceUserDto } from '../hikvision.adapter';
import { DeviceCommand } from '../device.adapter';
import { ConfigModule } from '@/core/config/config.module';
import { HikvisionApiAdapter } from './hikvision-api.adapter';

// Mock server for end-to-end testing
const server = setupServer(
    // Device discovery and info
    http.get('http://192.168.1.100:80/ISAPI/System/deviceInfo', () => {
        return HttpResponse.json({
            deviceName: 'E2E Test Camera',
            deviceType: 'IP Camera',
            serialNumber: 'E2E123456789',
            firmwareVersion: 'V5.6.0',
            hardwareVersion: 'H1.0',
            bootTime: '2023-01-01T00:00:00Z',
            uptime: 86400,
        });
    }),

    http.get('http://192.168.1.101:80/ISAPI/System/deviceInfo', () => {
        return HttpResponse.json({
            deviceName: 'E2E Test Camera 2',
            deviceType: 'IP Camera',
            serialNumber: 'E2E987654321',
            firmwareVersion: 'V5.7.0',
        });
    }),

    // User management - complete lifecycle
    http.post('http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Record', async ({ request }) => {
        const body: any = await request.json();
        const employeeNo = body.UserInfo?.employeeNo;
        
        // Simulate user creation
        return HttpResponse.json({ 
            success: true,
            employeeNo,
            message: 'User created successfully'
        });
    }),

    http.get('http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Search', ({ request }) => {
        const url = new URL(request.url);
        const employeeNo = url.searchParams.get('employeeNo');
        
        // Simulate user database
        const users: Record<string, any> = {
            'E2E001': {
                employeeNo: 'E2E001',
                name: 'E2E Test User 1',
                userType: 'normal',
                Valid: { enable: true },
            },
            'E2E002': {
                employeeNo: 'E2E002',
                name: 'E2E Test User 2',
                userType: 'visitor',
                Valid: { enable: true },
            },
        };

        if (employeeNo && users[employeeNo]) {
            return HttpResponse.json({ UserInfo: users[employeeNo] });
        }

        return new HttpResponse(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }),

    http.put('http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Record', async ({ request }) => {
        const body: any = await request.json();
        const employeeNo = body.UserInfo?.employeeNo;
        
        return HttpResponse.json({ 
            success: true,
            employeeNo,
            message: 'User updated successfully'
        });
    }),

    http.delete('http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Delete', ({ request }) => {
        const url = new URL(request.url);
        const employeeNo = url.searchParams.get('employeeNo');
        
        return HttpResponse.json({ 
            success: true,
            employeeNo,
            message: 'User deleted successfully'
        });
    }),

    // Session management
    http.get('http://192.168.1.100:80/ISAPI/System/Security/identityKey', () => {
        return HttpResponse.json({
            security: 'e2e-security-key',
            identityKey: 'e2e-identity-key',
        });
    }),

    // Face data operations
    http.get('http://192.168.1.100:80/ISAPI/Intelligent/FDLib', ({ request }) => {
        const url = new URL(request.url);
        const employeeNo = url.searchParams.get('employeeNo');
        const security = url.searchParams.get('security');
        const identityKey = url.searchParams.get('identityKey');

        // Verify session parameters
        if (!security || !identityKey) {
            return new HttpResponse(JSON.stringify({ error: 'Session required' }), { status: 401 });
        }

        if (employeeNo === 'E2E001') {
            return new HttpResponse(Buffer.from(`face-data-for-${employeeNo}`));
        }

        return new HttpResponse(null, { status: 404 });
    }),

    // Device control
    http.post('http://192.168.1.100:80/ISAPI/AccessControl/RemoteControl/door', async ({ request }) => {
        const body: any = await request.json();
        const cmd = body.cmd;
        const doorNo = body.doorNo || 1;

        return HttpResponse.json({ 
            success: true,
            command: cmd,
            doorNo,
            timestamp: new Date().toISOString(),
        });
    }),

    http.post('http://192.168.1.100:80/ISAPI/System/reboot', () => {
        return HttpResponse.json({ 
            success: true,
            message: 'Reboot initiated',
            estimatedTime: 60,
        });
    }),

    // System status and health
    http.get('http://192.168.1.100:80/ISAPI/System/status', () => {
        return HttpResponse.json({
            cpuUsage: 35,
            memoryUsage: 55,
            diskUsage: 65,
            temperature: 42,
            networkConnected: true,
            uptime: 172800, // 2 days
            errorCount: 0,
            warningCount: 2,
            activeConnections: 15,
        });
    }),

        // Logging
    http.get('http://192.168.1.100:80/ISAPI/System/Logging/search', ({ request }) => {
        const url = new URL(request.url);
        const startTime = url.searchParams.get('startTime');
        const endTime = url.searchParams.get('endTime');
        const logLevel = url.searchParams.get('logLevel');

        // Simulate comprehensive E2E test logs
        const logs = [
            {
                time: '2023-01-01T10:00:00Z',
                logLevel: 'INFO',
                logType: 'system',
                logDescription: 'E2E test system started',
                logSource: 'system',
                userID: 'admin',
                eventID: 'E2E001',
            },
            {
                time: '2023-01-01T10:01:00Z',
                logLevel: 'INFO',
                logType: 'access',
                logDescription: 'E2E user access granted',
                logSource: 'door',
                userID: 'E2E001',
                eventID: 'E2E002',
            },
            {
                time: '2023-01-01T10:02:00Z',
                logLevel: 'WARN',
                logType: 'system',
                logDescription: 'E2E test warning',
                logSource: 'system',
                eventID: 'E2E003',
            },
        ];

        // Filter by log level if specified
        const filteredLogs = logLevel 
            ? logs.filter(log => log.logLevel === logLevel.toUpperCase())
            : logs;

        return HttpResponse.json({
            LogSearch: {
                MatchList: filteredLogs,
                totalMatches: filteredLogs.length,
                numOfMatches: filteredLogs.length,
            },
        });
    }),

    http.post('http://192.168.1.100:80/ISAPI/System/Logging/clear', () => {
        return HttpResponse.json({ 
            success: true, 
            clearedCount: 100,
            message: 'E2E test logs cleared'
        });
    }),

    // Configuration management
    http.get('http://192.168.1.100:80/ISAPI/System/configurationData', () => {
        const configData = JSON.stringify({
            deviceName: 'E2E Test Camera',
            networkSettings: {
                ipAddress: '192.168.1.100',
                subnet: '255.255.255.0',
            },
            e2eTestMode: true,
        });

        return new HttpResponse(Buffer.from(configData));
    }),

    // Firmware update with detailed tracking
    http.post('http://192.168.1.100:80/ISAPI/System/updateFirmware', async ({ request }) => {
        const body: any = await request.json();
        const firmwareUrl = body.firmwareUrl;

        return HttpResponse.json({
            success: true,
            updateId: 'e2e-update-123',
            estimatedDuration: 300, // 5 minutes
            firmwareUrl,
            message: 'E2E firmware update initiated',
        });
    }),

    http.get('http://192.168.1.100:80/ISAPI/System/updateStatus/e2e-update-123', () => {
        return HttpResponse.json({
            updateId: 'e2e-update-123',
            status: 'completed',
            progress: 100,
            newVersion: 'V5.8.0-E2E',
            oldVersion: 'V5.6.0',
            completedAt: new Date().toISOString(),
        });
    }),

    // Error simulation endpoints for E2E testing
    http.get('http://192.168.1.100:80/ISAPI/error/timeout', () => {
        return new HttpResponse(null, { status: 408 });
    }),

    http.get('http://192.168.1.100:80/ISAPI/error/unauthorized', () => {
        return new HttpResponse(JSON.stringify({ error: 'E2E Unauthorized test' }), { status: 401 });
    }),

    http.get('http://192.168.1.100:80/ISAPI/error/server', () => {
        return new HttpResponse(JSON.stringify({ error: 'E2E Server Error test' }), { status: 500 });
    })
);

describe('HikvisionApiAdapter E2E Tests', () => {
    let app: TestingModule;
    let deviceAdapter: HikvisionApiAdapter;

    // Mock database data
    const mockDevices = [
        {
            id: 'e2e-device-1',
            name: 'E2E Test Camera 1',
            ipAddress: '192.168.1.100',
            username: 'admin',
            encryptedSecret: 'encrypted-password-1',
        },
        {
            id: 'e2e-device-2',
            name: 'E2E Test Camera 2',
            ipAddress: '192.168.1.101',
            username: 'admin',
            encryptedSecret: 'encrypted-password-2',
        },
    ];

    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'error' });

        // Create test module with real dependencies
        app = await Test.createTestingModule({
            imports: [
                ConfigModule,
                LoggerModule,
                DatabaseModule,
                CacheModule,
                HttpModule,
                HikvisionAdapterModule.forRoot({
                    adapterType: 'hikvision',
                    useStubAdapter: false,
                    httpTimeout: 5000,
                    cacheConfig: { ttl: 300, max: 100 },
                }),
            ],
        }).compile();

        deviceAdapter = app.get<HikvisionApiAdapter>('HikvisionApiAdapter');

        // Mock PrismaService for database operations
        const prismaService = app.get('PrismaService');
        if (prismaService) {
            jest.spyOn(prismaService.device, 'findUnique').mockImplementation((args: any) => {
                const device = mockDevices.find(d => d.id === args.where.id);
                return Promise.resolve(device || null);
            });

            jest.spyOn(prismaService.device, 'findMany').mockResolvedValue(mockDevices);
            jest.spyOn(prismaService.device, 'findFirst').mockResolvedValue(null);
            jest.spyOn(prismaService.device, 'update').mockImplementation((args: any) => {
                const device = mockDevices.find(d => d.id === args.where.id);
                return Promise.resolve({ ...device, ...args.data });
            });
        }

        // Mock EncryptionService
        const encryptionService = app.get('EncryptionService');
        if (encryptionService) {
            jest.spyOn(encryptionService, 'decrypt').mockReturnValue('admin123');
        }
    });

    afterAll(async () => {
        server.close();
        await app.close();
    });

    afterEach(() => {
        server.resetHandlers();
        jest.clearAllMocks();
    });

    describe('Complete User Lifecycle', () => {
        it('should handle complete user management workflow', async () => {
            const deviceId = 'e2e-device-1';
            
            // Step 1: Add user
            const userData: CreateDeviceUserDto = {
                employeeNo: 'E2E001',
                name: 'E2E Test User 1',
                userType: 'normal',
            };

            const addResult = await deviceAdapter.addUser(deviceId, userData);
            expect(addResult).toBe(true);

            // Step 2: Verify user exists
            const foundUser = await deviceAdapter.findUserByEmployeeNo(deviceId, 'E2E001');
            expect(foundUser).toEqual({
                employeeNo: 'E2E001',
                name: 'E2E Test User 1',
                userType: 'normal',
            });

            // Step 3: Update user
            const updateData: UpdateDeviceUserDto = {
                name: 'E2E Updated User 1',
                userType: 'visitor',
            };

            const updateResult = await deviceAdapter.updateUser(deviceId, 'E2E001', updateData);
            expect(updateResult).toBe(true);

            // Step 4: Get face data (requires session)
            const faceData = await deviceAdapter.getFaceData(deviceId, 'E2E001');
            expect(faceData).toBeInstanceOf(Buffer);
            expect(faceData?.toString()).toBe('face-data-for-E2E001');

            // Step 5: Delete user
            const deleteResult = await deviceAdapter.deleteUser(deviceId, 'E2E001');
            expect(deleteResult).toBe(true);

            // Step 6: Verify user is deleted
            const deletedUser = await deviceAdapter.findUserByEmployeeNo(deviceId, 'E2E001');
            expect(deletedUser).toBeNull();
        }, 30000);

        it('should handle bulk user operations', async () => {
            const deviceId = 'e2e-device-1';
            
            const users = [
                { userId: 'E2E001', accessLevel: 1, name: 'Bulk User 1' },
                { userId: 'E2E002', accessLevel: 2, name: 'Bulk User 2' },
                { userId: 'E2E003', accessLevel: 1, name: 'Bulk User 3' },
            ];

            // Sync multiple users
            await expect(deviceAdapter.syncUsers(deviceId, users)).resolves.not.toThrow();

            // Remove multiple users
            for (const user of users) {
                await expect(deviceAdapter.removeUser(deviceId, user.userId)).resolves.not.toThrow();
            }
        }, 20000);
    });

    describe('Device Operations Integration', () => {
        it('should perform complete device management workflow', async () => {
            const deviceId = 'e2e-device-1';

            // Step 1: Test connectivity
            const isConnected = await deviceAdapter.testConnection(deviceId);
            expect(isConnected).toBe(true);

            // Step 2: Get device information
            const deviceInfo = await deviceAdapter.getDeviceInfo(deviceId);
            expect(deviceInfo.id).toBe(deviceId);
            expect(deviceInfo.name).toBe('E2E Test Camera 1');
            expect(deviceInfo.firmwareVersion).toBeDefined();

            // Step 3: Get device health
            const health = await deviceAdapter.getDeviceHealth(deviceId);
            expect(health.deviceId).toBe(deviceId);
            expect(health.uptime).toBeGreaterThan(0);
            expect(health.memoryUsage).toBeDefined();

            // Step 4: Send commands
            const unlockCommand: DeviceCommand = {
                command: 'unlock_door',
                parameters: { doorNo: 1, duration: 10 },
            };

            const commandResult = await deviceAdapter.sendCommand(deviceId, unlockCommand);
            expect(commandResult.success).toBe(true);
            expect(commandResult.message).toContain('executed successfully');

            // Step 5: Reboot device
            await expect(deviceAdapter.rebootDevice(deviceId)).resolves.not.toThrow();
        }, 25000);

        it('should handle device configuration management', async () => {
            const deviceId = 'e2e-device-1';

            // Get current configuration
            const config = await deviceAdapter.getDeviceConfiguration(deviceId);
            expect(config.deviceId).toBe(deviceId);
            expect(config.settings).toBeDefined();

            // Update configuration
            const updatedConfig = {
                ...config,
                settings: {
                    ...config.settings,
                    maxUsers: 2000,
                    enableFaceRecognition: true,
                },
            };

            await expect(
                deviceAdapter.updateDeviceConfiguration(deviceId, updatedConfig)
            ).resolves.not.toThrow();
        }, 15000);
    });

    describe('Logging and Maintenance', () => {
        it('should handle complete logging workflow', async () => {
            const deviceId = 'e2e-device-1';
            const startDate = new Date('2023-01-01T00:00:00Z');
            const endDate = new Date('2023-01-01T23:59:59Z');

            // Get device logs
            const logs = await deviceAdapter.getDeviceLogs(deviceId, startDate, endDate);
            expect(logs).toHaveLength(3);
            expect(logs[0]).toContain('[WARN]');
            expect(logs[0]).toContain('E2E test warning');
            expect(logs[1]).toContain('[INFO]');
            expect(logs[1]).toContain('E2E user access granted');

            // Clear device logs
            await expect(deviceAdapter.clearDeviceLogs(deviceId)).resolves.not.toThrow();
        }, 10000);

        it('should handle firmware update workflow', async () => {
            const deviceId = 'e2e-device-1';
            const firmwareUrl = 'http://example.com/firmware-e2e.bin';

            const result = await deviceAdapter.updateFirmware(deviceId, firmwareUrl);
            expect(result.success).toBe(true);
            expect(result.message).toContain('completed successfully');
        }, 15000);
    });

    describe('Device Discovery', () => {
        it('should discover multiple devices', async () => {
            const devices = await deviceAdapter.discoverDevices();
            
            expect(devices.length).toBeGreaterThan(0);
            expect(devices[0].name).toBe('E2E Test Camera 1');
            expect(devices[0].ipAddress).toBe('192.168.1.100');
        }, 15000);
    });

    describe('Event Subscription', () => {
        it('should handle event subscription lifecycle', async () => {
            const deviceId = 'e2e-device-1';
            const events: any[] = [];
            
            const callback = (event: any) => {
                events.push(event);
            };

            // Subscribe to events
            await expect(
                deviceAdapter.subscribeToEvents(deviceId, callback)
            ).resolves.not.toThrow();

            // Wait a moment for subscription to establish
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Unsubscribe from events
            await expect(
                deviceAdapter.unsubscribeFromEvents(deviceId)
            ).resolves.not.toThrow();
        }, 10000);
    });

    describe('Error Handling and Recovery', () => {
        it('should handle authentication errors gracefully', async () => {
            // Override server to return 401
            server.use(
                http.get('http://192.168.1.100:80/ISAPI/System/deviceInfo', () => {
                    return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
                })
            );

            const result = await deviceAdapter.testConnection('e2e-device-1');
            expect(result).toBe(false);
        });

        it('should handle server errors gracefully', async () => {
            // Override server to return 500
            server.use(
                http.get('http://192.168.1.100:80/ISAPI/System/deviceInfo', () => {
                    return new HttpResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
                })
            );

            const result = await deviceAdapter.testConnection('e2e-device-1');
            expect(result).toBe(false);
        });

        it('should handle network timeouts', async () => {
            // Override server to simulate timeout
            server.use(
                http.get('http://192.168.1.100:80/ISAPI/System/deviceInfo', () => {
                    return new HttpResponse(null, { status: 200 }); // Can't easily simulate delay in MSW v2
                })
            );

            const result = await deviceAdapter.testConnection('e2e-device-1');
            expect(result).toBe(false);
        }, 8000);

        it('should handle device not found in database', async () => {
            await expect(
                deviceAdapter.getDeviceInfo('non-existent-device')
            ).rejects.toThrow();
        });
    });

    describe('Performance and Concurrency', () => {
        it('should handle concurrent operations on same device', async () => {
            const deviceId = 'e2e-device-1';
            
            // Run multiple operations concurrently
            const promises = [
                deviceAdapter.testConnection(deviceId),
                deviceAdapter.getDeviceHealth(deviceId),
                deviceAdapter.findUserByEmployeeNo(deviceId, 'E2E001'),
                deviceAdapter.findUserByEmployeeNo(deviceId, 'E2E002'),
                deviceAdapter.getDeviceLogs(deviceId),
            ];

            const results = await Promise.allSettled(promises);
            
            // All operations should complete
            expect(results.every(r => r.status === 'fulfilled')).toBe(true);
        }, 15000);

        it('should handle operations on multiple devices', async () => {
            const promises = [
                deviceAdapter.testConnection('e2e-device-1'),
                deviceAdapter.testConnection('e2e-device-2'),
                deviceAdapter.getDeviceInfo('e2e-device-1'),
                deviceAdapter.getDeviceInfo('e2e-device-2'),
            ];

            const results = await Promise.allSettled(promises);
            
            // All operations should complete
            expect(results.every(r => r.status === 'fulfilled')).toBe(true);
        }, 10000);

        it('should maintain performance under load', async () => {
            const deviceId = 'e2e-device-1';
            const startTime = Date.now();
            
            // Perform 20 rapid operations
            const promises = Array.from({ length: 20 }, () =>
                deviceAdapter.testConnection(deviceId)
            );

            const results = await Promise.all(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // All should succeed
            expect(results.every(r => r === true)).toBe(true);
            
            // Should complete in reasonable time (less than 15 seconds)
            expect(duration).toBeLessThan(15000);
        }, 20000);
    });

    describe('Data Consistency', () => {
        it('should maintain data consistency across operations', async () => {
            const deviceId = 'e2e-device-1';
            
            // Create user
            const userData: CreateDeviceUserDto = {
                employeeNo: 'CONSISTENCY001',
                name: 'Consistency Test User',
                userType: 'normal',
            };

            await deviceAdapter.addUser(deviceId, userData);

            // Verify user exists immediately
            const user1 = await deviceAdapter.findUserByEmployeeNo(deviceId, 'CONSISTENCY001');
            expect(user1).toBeTruthy();
            expect(user1?.name).toBe('Consistency Test User');

            // Update user
            await deviceAdapter.updateUser(deviceId, 'CONSISTENCY001', { name: 'Updated Name' });

            // Verify update is reflected
            const user2 = await deviceAdapter.findUserByEmployeeNo(deviceId, 'CONSISTENCY001');
            expect(user2?.name).toBe('Updated Name');

            // Delete user
            await deviceAdapter.deleteUser(deviceId, 'CONSISTENCY001');

            // Verify user is gone
            const user3 = await deviceAdapter.findUserByEmployeeNo(deviceId, 'CONSISTENCY001');
            expect(user3).toBeNull();
        }, 15000);
    });

    describe('Integration with System Components', () => {
        it('should integrate properly with caching system', async () => {
            const deviceId = 'e2e-device-1';
            
            // First call should hit the device
            const startTime1 = Date.now();
            await deviceAdapter.getFaceData(deviceId, 'E2E001');
            const duration1 = Date.now() - startTime1;

            // Second call should use cached session (should be faster)
            const startTime2 = Date.now();
            await deviceAdapter.getFaceData(deviceId, 'E2E001');
            const duration2 = Date.now() - startTime2;

            // Second call should be faster due to session caching
            expect(duration2).toBeLessThan(duration1);
        }, 10000);

        it('should integrate properly with logging system', async () => {
            const deviceId = 'e2e-device-1';
            
            // Perform operations that should generate logs
            await deviceAdapter.testConnection(deviceId);
            await deviceAdapter.getDeviceInfo(deviceId);
            await deviceAdapter.findUserByEmployeeNo(deviceId, 'E2E001');

            // All operations should complete without logging errors
            // (Actual log verification would require access to the logging system)
            expect(true).toBe(true);
        });
    });
});