import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

import { EncryptionService } from './encryption.service';
import { 
    HikvisionMaintenanceService,
    LogQueryOptions,
    FirmwareUpdateOptions,
    MaintenanceTask 
} from './hikvision-maintenance.service';
import { HikvisionDeviceConfig } from '../adapters/hikvision.adapter';

describe('HikvisionMaintenanceService', () => {
    let service: HikvisionMaintenanceService;
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
        };

        const mockEncryptionService = {
            decrypt: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HikvisionMaintenanceService,
                { provide: HttpService, useValue: mockHttpService },
                { provide: EncryptionService, useValue: mockEncryptionService },
            ],
        }).compile();

        service = module.get<HikvisionMaintenanceService>(HikvisionMaintenanceService);
        httpService = module.get(HttpService);
        encryptionService = module.get(EncryptionService);

        // Setup default mocks
        encryptionService.decrypt.mockReturnValue(mockDecryptedPassword);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getDeviceLogs', () => {
        it('should retrieve device logs successfully', async () => {
            const mockLogResponse = {
                LogSearch: {
                    MatchList: [
                        {
                            time: '2023-01-01T12:00:00Z',
                            logLevel: 'INFO',
                            logType: 'system',
                            logDescription: 'System started',
                            logSource: 'system',
                            userID: 'admin',
                            eventID: 'EVT001',
                        },
                        {
                            time: '2023-01-01T12:01:00Z',
                            logLevel: 'ERROR',
                            logType: 'access',
                            logDescription: 'Access denied',
                            logSource: 'door',
                            userID: 'user123',
                            eventID: 'EVT002',
                        },
                    ],
                },
            };

            httpService.get.mockReturnValue(of({ data: mockLogResponse }) as any);

            const options: LogQueryOptions = {
                startDate: new Date('2023-01-01T00:00:00Z'),
                endDate: new Date('2023-01-01T23:59:59Z'),
                level: 'info',
                limit: 100,
            };

            const result = await service.getDeviceLogs(mockDevice, options);

            expect(result).toHaveLength(2);
            expect(result[0].level).toBe('error'); // Should be sorted by timestamp desc
            expect(result[0].message).toBe('Access denied');
            expect(result[0].timestamp).toEqual(new Date('2023-01-01T12:01:00Z'));
            expect(result[1].level).toBe('info');
            expect(result[1].message).toBe('System started');

            expect(httpService.get).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/System/Logging/search',
                expect.objectContaining({
                    auth: { username: 'admin', password: mockDecryptedPassword },
                    params: expect.objectContaining({
                        format: 'json',
                        logLevel: 'info',
                        maxResults: 100,
                    }),
                })
            );
        });

        it('should handle single log entry response', async () => {
            const mockLogResponse = {
                LogSearch: {
                    MatchList: {
                        time: '2023-01-01T12:00:00Z',
                        logLevel: 'WARN',
                        logType: 'system',
                        logDescription: 'Warning message',
                    },
                },
            };

            httpService.get.mockReturnValue(of({ data: mockLogResponse }) as any);

            const result = await service.getDeviceLogs(mockDevice);

            expect(result).toHaveLength(1);
            expect(result[0].level).toBe('warn');
            expect(result[0].message).toBe('Warning message');
        });

        it('should handle empty log response', async () => {
            const mockLogResponse = { LogSearch: {} };
            httpService.get.mockReturnValue(of({ data: mockLogResponse }) as any);

            const result = await service.getDeviceLogs(mockDevice);

            expect(result).toHaveLength(0);
        });

        it('should throw exception on device error', async () => {
            const error = { response: { status: 500 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            await expect(service.getDeviceLogs(mockDevice)).rejects.toThrow();
        });

        it('should map log levels correctly', async () => {
            const mockLogResponse = {
                LogSearch: {
                    MatchList: [
                        { time: '2023-01-01T12:00:00Z', logLevel: 'DEBUG', logDescription: 'Debug message' },
                        { time: '2023-01-01T12:01:00Z', logLevel: 'INFORMATION', logDescription: 'Info message' },
                        { time: '2023-01-01T12:02:00Z', logLevel: 'WARNING', logDescription: 'Warning message' },
                        { time: '2023-01-01T12:03:00Z', logLevel: 'CRITICAL', logDescription: 'Critical message' },
                        { time: '2023-01-01T12:04:00Z', logLevel: 'UNKNOWN', logDescription: 'Unknown message' },
                    ],
                },
            };

            httpService.get.mockReturnValue(of({ data: mockLogResponse }) as any);

            const result = await service.getDeviceLogs(mockDevice);

            expect(result[4].level).toBe('debug');
            expect(result[3].level).toBe('info');
            expect(result[2].level).toBe('warn');
            expect(result[1].level).toBe('critical');
            expect(result[0].level).toBe('info'); // Unknown maps to info
        });
    });

    describe('clearDeviceLogs', () => {
        it('should clear device logs successfully', async () => {
            const mockResponse = {
                data: { clearedCount: 150 },
            };
            httpService.post.mockReturnValue(of(mockResponse) as any);

            const options = {
                olderThan: new Date('2023-01-01T00:00:00Z'),
                category: 'system',
            };

            const result = await service.clearDeviceLogs(mockDevice, options);

            expect(result.success).toBe(true);
            expect(result.clearedCount).toBe(150);
            expect(result.message).toBe('Device logs cleared successfully');

            expect(httpService.post).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/System/Logging/clear',
                expect.objectContaining({
                    beforeTime: '2023-01-01T00:00:00.000Z',
                    logType: 'system',
                }),
                expect.objectContaining({
                    auth: { username: 'admin', password: mockDecryptedPassword },
                })
            );
        });

        it('should handle clear logs failure gracefully', async () => {
            const error = { response: { status: 403, statusText: 'Forbidden' } };
            httpService.post.mockReturnValue(throwError(() => error) as any);

            const result = await service.clearDeviceLogs(mockDevice);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to clear logs');
        });
    });

    describe('updateFirmware', () => {
        it('should update firmware successfully', async () => {
            // Mock current firmware version
            httpService.get.mockReturnValueOnce(of({ 
                data: { firmwareVersion: 'V5.6.0' } 
            }) as any);

            // Mock backup creation
            httpService.get.mockReturnValueOnce(of({ 
                data: Buffer.from('backup-data') 
            }) as any);

            // Mock firmware update initiation
            httpService.post.mockReturnValueOnce(of({ 
                data: { updateId: 'update-123' } 
            }) as any);

            // Mock update status monitoring
            httpService.get.mockReturnValue(of({ 
                data: { status: 'completed', newVersion: 'V5.7.0' } 
            }) as any);

            const options: FirmwareUpdateOptions = {
                firmwareUrl: 'http://example.com/firmware.bin',
                version: 'V5.7.0',
                backupBeforeUpdate: true,
                rebootAfterUpdate: true,
            };

            const result = await service.updateFirmware(mockDevice, options);

            expect(result.success).toBe(true);
            expect(result.previousVersion).toBe('V5.6.0');
            expect(result.newVersion).toBe('V5.7.0');
            expect(result.backupCreated).toBe(true);
            expect(result.rebootRequired).toBe(true);
            expect(result.duration).toBeGreaterThan(0);
        });

        it('should handle firmware update failure', async () => {
            // Mock current firmware version
            httpService.get.mockReturnValueOnce(of({ 
                data: { firmwareVersion: 'V5.6.0' } 
            }) as any);

            // Mock firmware update failure
            const error = { response: { status: 500, statusText: 'Internal Server Error' } };
            httpService.post.mockReturnValue(throwError(() => error) as any);

            const options: FirmwareUpdateOptions = {
                firmwareUrl: 'http://example.com/firmware.bin',
                backupBeforeUpdate: false,
            };

            const result = await service.updateFirmware(mockDevice, options);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Firmware update failed');
            expect(result.error).toBeDefined();
            expect(result.duration).toBeGreaterThan(0);
        });

        it('should continue update even if backup fails', async () => {
            // Mock current firmware version
            httpService.get.mockReturnValueOnce(of({ 
                data: { firmwareVersion: 'V5.6.0' } 
            }) as any);

            // Mock backup failure
            httpService.get.mockReturnValueOnce(throwError(() => new Error('Backup failed')) as any);

            // Mock successful firmware update
            httpService.post.mockReturnValueOnce(of({ 
                data: { updateId: 'update-123' } 
            }) as any);

            httpService.get.mockReturnValue(of({ 
                data: { status: 'completed', newVersion: 'V5.7.0' } 
            }) as any);

            const options: FirmwareUpdateOptions = {
                firmwareUrl: 'http://example.com/firmware.bin',
                backupBeforeUpdate: true,
            };

            const result = await service.updateFirmware(mockDevice, options);

            expect(result.success).toBe(true);
            expect(result.backupCreated).toBeUndefined(); // Backup failed
        });
    });

    describe('executeMaintenanceTask', () => {
        it('should execute maintenance task successfully', async () => {
            const mockTask: MaintenanceTask = {
                id: 'test-task',
                name: 'Test Task',
                description: 'Test maintenance task',
                type: 'diagnostic',
                priority: 'medium',
                estimatedDuration: 5,
                execute: jest.fn().mockResolvedValue({
                    taskId: 'test-task',
                    success: true,
                    message: 'Task completed successfully',
                    startTime: new Date(),
                    endTime: new Date(),
                    duration: 1000,
                    details: { result: 'ok' },
                }),
            };

            const result = await service.executeMaintenanceTask(mockDevice, mockTask);

            expect(result.success).toBe(true);
            expect(result.taskId).toBe('test-task');
            expect(result.message).toBe('Task completed successfully');
            expect(result.duration).toBeGreaterThan(0);
            expect(mockTask.execute).toHaveBeenCalledWith(mockDevice);
        });

        it('should handle task execution failure', async () => {
            const mockTask: MaintenanceTask = {
                id: 'failing-task',
                name: 'Failing Task',
                description: 'Task that fails',
                type: 'diagnostic',
                priority: 'low',
                estimatedDuration: 5,
                execute: jest.fn().mockRejectedValue(new Error('Task failed')),
            };

            const result = await service.executeMaintenanceTask(mockDevice, mockTask);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Task execution failed');
            expect(result.errors).toContain('Task failed');
        });

        it('should check prerequisites before execution', async () => {
            const mockTask: MaintenanceTask = {
                id: 'prereq-task',
                name: 'Task with Prerequisites',
                description: 'Task that requires prerequisites',
                type: 'diagnostic',
                priority: 'high',
                estimatedDuration: 10,
                prerequisites: ['network_connectivity'],
                execute: jest.fn(),
            };

            // Mock device info call for prerequisite check
            httpService.get.mockReturnValue(of({ 
                data: { firmwareVersion: 'V5.6.0' } 
            }) as any);

            const result = await service.executeMaintenanceTask(mockDevice, mockTask);

            expect(result.success).toBe(true);
            expect(mockTask.execute).toHaveBeenCalled();
        });

        it('should fail if prerequisites are not met', async () => {
            const mockTask: MaintenanceTask = {
                id: 'prereq-task',
                name: 'Task with Prerequisites',
                description: 'Task that requires prerequisites',
                type: 'diagnostic',
                priority: 'high',
                estimatedDuration: 10,
                prerequisites: ['network_connectivity'],
                execute: jest.fn(),
            };

            // Mock device unreachable for prerequisite check
            httpService.get.mockReturnValue(throwError(() => new Error('Connection failed')) as any);

            const result = await service.executeMaintenanceTask(mockDevice, mockTask);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Prerequisites not met');
            expect(mockTask.execute).not.toHaveBeenCalled();
        });
    });

    describe('getDefaultMaintenanceTasks', () => {
        it('should return default maintenance tasks', () => {
            const tasks = service.getDefaultMaintenanceTasks();

            expect(tasks.length).toBeGreaterThan(0);
            
            const logCleanupTask = tasks.find(t => t.id === 'log-cleanup');
            expect(logCleanupTask).toBeDefined();
            expect(logCleanupTask!.type).toBe('cleanup');
            expect(logCleanupTask!.execute).toBeDefined();

            const backupTask = tasks.find(t => t.id === 'config-backup');
            expect(backupTask).toBeDefined();
            expect(backupTask!.type).toBe('backup');
            expect(backupTask!.priority).toBe('high');

            const healthCheckTask = tasks.find(t => t.id === 'health-check');
            expect(healthCheckTask).toBeDefined();
            expect(healthCheckTask!.type).toBe('diagnostic');
        });

        it('should have executable tasks', async () => {
            const tasks = service.getDefaultMaintenanceTasks();
            const logCleanupTask = tasks.find(t => t.id === 'log-cleanup')!;

            // Mock clear logs response
            httpService.post.mockReturnValue(of({ data: { clearedCount: 50 } }) as any);

            const result = await logCleanupTask.execute(mockDevice);

            expect(result.success).toBe(true);
            expect(result.taskId).toBe('log-cleanup');
            expect(result.details?.clearedCount).toBe(50);
        });
    });
});