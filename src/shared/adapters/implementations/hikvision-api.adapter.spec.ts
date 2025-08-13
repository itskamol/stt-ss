import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { DeviceStatus, DeviceType } from '@prisma/client';

import { PrismaService } from '@/core/database/prisma.service';
import { EncryptionService } from '@/shared/services/encryption.service';
import { HikvisionApiAdapter } from './hikvision-api.adapter';
import {
    CreateDeviceUserDto,
    UpdateDeviceUserDto,
    HIKVISION_CONFIG,
    HikvisionCacheKeys,
} from '../hikvision.adapter';
import {
    NotFoundException,
    UnauthorizedException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { CacheService } from '@/core/cache/cache.service';
import { LoggerService } from '@/core/logger';
import { HikvisionSessionService } from '@/shared/services/hikvision-session.service';
import { HikvisionUserManagementService } from '@/shared/services/hikvision-user-management.service';
import { HikvisionDeviceControlService } from '@/shared/services/hikvision-device-control.service';
import { HikvisionDiscoveryService } from '@/shared/services/hikvision-discovery.service';
import { HikvisionEventMonitoringService } from '@/shared/services/hikvision-event-monitoring.service';
import { HikvisionMaintenanceService } from '@/shared/services/hikvision-maintenance.service';

describe('HikvisionApiAdapter', () => {
    let adapter: HikvisionApiAdapter;
    let httpService: jest.Mocked<HttpService>;
    let prismaService: any;
    let encryptionService: jest.Mocked<EncryptionService>;
    let cacheService: jest.Mocked<CacheService>;
    let loggerService: jest.Mocked<LoggerService>;
    let sessionService: jest.Mocked<HikvisionSessionService>;
    let userManagementService: jest.Mocked<HikvisionUserManagementService>;
    let deviceControlService: jest.Mocked<HikvisionDeviceControlService>;
    let discoveryService: jest.Mocked<HikvisionDiscoveryService>;
    let eventMonitoringService: jest.Mocked<HikvisionEventMonitoringService>;
    let maintenanceService: jest.Mocked<HikvisionMaintenanceService>;

    const mockDevice = {
        id: 'test-device-1',
        name: 'Test Hikvision Camera',
        ipAddress: '192.168.1.100',
        username: 'admin',
        encryptedSecret: 'encrypted-password',
        macAddress: '00:11:22:33:44:55',
        firmwareVersion: 'v2.1.0',
        lastSeen: new Date(),
    };

    const mockDecryptedPassword = 'admin123';

    beforeEach(async () => {
        const mockHttpService = {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
        };

        const mockPrismaService = {
            device: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
            },
        };

        const mockEncryptionService = {
            decrypt: jest.fn(),
            encrypt: jest.fn(),
        };

        const mockCacheManager = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
        };

        const mockLoggerService = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
            setContext: jest.fn(),
            logUserAction: jest.fn(),
            logSecurityEvent: jest.fn(),
          };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HikvisionApiAdapter,
                { provide: HttpService, useValue: mockHttpService },
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: EncryptionService, useValue: mockEncryptionService },
                { provide: CacheService, useValue: mockCacheManager },
                { provide: LoggerService, useValue: mockLoggerService },
                { provide: HikvisionSessionService, useValue: { getSecureSession: jest.fn() } },
                { provide: HikvisionUserManagementService, useValue: { addUser: jest.fn(), updateUser: jest.fn(), deleteUser: jest.fn(), findUserByEmployeeNo: jest.fn(), syncUsers: jest.fn() } },
                { provide: HikvisionDeviceControlService, useValue: { sendCommand: jest.fn() } },
                { provide: HikvisionDiscoveryService, useValue: { getDeviceInfo: jest.fn() } },
                { provide: HikvisionEventMonitoringService, useValue: { getFaceData: jest.fn() } },
                { provide: HikvisionMaintenanceService, useValue: {} },
            ],
        }).compile();

        adapter = module.get<HikvisionApiAdapter>(HikvisionApiAdapter);
        httpService = module.get(HttpService);
        prismaService = module.get(PrismaService);
        encryptionService = module.get(EncryptionService);
        cacheService = module.get(CacheService);
        loggerService = module.get(LoggerService);
        sessionService = module.get(HikvisionSessionService);
        userManagementService = module.get(HikvisionUserManagementService);
        deviceControlService = module.get(HikvisionDeviceControlService);
        discoveryService = module.get(HikvisionDiscoveryService);
        eventMonitoringService = module.get(HikvisionEventMonitoringService);
        maintenanceService = module.get(HikvisionMaintenanceService);

        // Setup default mocks
        prismaService.device.findUnique.mockResolvedValue(mockDevice);
        encryptionService.decrypt.mockReturnValue(mockDecryptedPassword);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getDeviceInfo', () => {
        it('should return device info with online status when device responds', async () => {
            const mockResponse = {
                data: {
                    firmwareVersion: 'v2.2.0',
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await adapter.getDeviceInfo('test-device-1');

            expect(result).toEqual({
                id: 'test-device-1',
                name: 'Test Hikvision Camera',
                type: DeviceType.CAMERA,
                status: DeviceStatus.ONLINE,
                ipAddress: '192.168.1.100',
                macAddress: '00:11:22:33:44:55',
                firmwareVersion: 'v2.2.0',
                lastSeen: expect.any(Date),
                capabilities: [
                    {
                        type: DeviceType.CAMERA,
                        enabled: true,
                        configuration: {
                            faceRecognition: true,
                            accessControl: true,
                        },
                    },
                ],
            });
        });

        it('should return device info with offline status when device is unreachable', async () => {
            httpService.get.mockReturnValue(throwError(() => new Error('Connection refused')) as any);

            const result = await adapter.getDeviceInfo('test-device-1');

            expect(result.status).toBe(DeviceStatus.OFFLINE);
            expect(result.id).toBe('test-device-1');
        });

        it('should throw NotFoundException when device is not found in database', async () => {
            prismaService.device.findUnique.mockResolvedValue(null);

            await expect(adapter.getDeviceInfo('non-existent')).rejects.toThrow(NotFoundException);
        });
    });

    describe('testConnection', () => {
        it('should return true when device is reachable', async () => {
            httpService.get.mockReturnValue(of({ data: {} }) as any);

            const result = await adapter.testConnection('test-device-1');

            expect(result).toBe(true);
            expect(httpService.get).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/System/deviceInfo',
                expect.objectContaining({
                    auth: { username: 'admin', password: mockDecryptedPassword },
                    timeout: 5000,
                })
            );
        });

        it('should return false when device is unreachable', async () => {
            httpService.get.mockReturnValue(throwError(() => new Error('Connection timeout')) as any);

            const result = await adapter.testConnection('test-device-1');

            expect(result).toBe(false);
        });
    });

    describe('addUser', () => {
        const userData: CreateDeviceUserDto = {
            employeeNo: 'EMP001',
            name: 'John Doe',
            userType: 'normal',
        };

        it('should successfully add user to device', async () => {
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const result = await adapter.addUser('test-device-1', userData);

            expect(result).toBe(true);
            expect(httpService.post).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Record',
                expect.objectContaining({
                    UserInfo: expect.objectContaining({
                        employeeNo: 'EMP001',
                        name: 'John Doe',
                        userType: 'normal',
                    }),
                }),
                expect.objectContaining({
                    auth: { username: 'admin', password: mockDecryptedPassword },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );
        });

        it('should throw BadRequestException for invalid employee number', async () => {
            const invalidUserData = { ...userData, employeeNo: 'invalid@employee#' };

            await expect(adapter.addUser('test-device-1', invalidUserData)).rejects.toThrow(BadRequestException);
        });

        it('should throw UnauthorizedException when device returns 401', async () => {
            const error = { response: { status: 401, statusText: 'Unauthorized' } };
            httpService.post.mockReturnValue(throwError(() => error) as any);

            await expect(adapter.addUser('test-device-1', userData)).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('updateUser', () => {
        const updateData: UpdateDeviceUserDto = {
            name: 'Jane Doe',
            userType: 'visitor',
        };

        it('should successfully update user on device', async () => {
            httpService.put.mockReturnValue(of({ data: { success: true } }) as any);

            const result = await adapter.updateUser('test-device-1', 'EMP001', updateData);

            expect(result).toBe(true);
            expect(httpService.put).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Record?format=json&employeeNo=EMP001',
                expect.objectContaining({
                    UserInfo: expect.objectContaining({
                        employeeNo: 'EMP001',
                        name: 'Jane Doe',
                        userType: 'visitor',
                    }),
                }),
                expect.any(Object)
            );
        });

        it('should handle partial updates', async () => {
            httpService.put.mockReturnValue(of({ data: { success: true } }) as any);

            await adapter.updateUser('test-device-1', 'EMP001', { name: 'New Name' });

            expect(httpService.put).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    UserInfo: {
                        employeeNo: 'EMP001',
                        name: 'New Name',
                    },
                }),
                expect.any(Object)
            );
        });
    });

    describe('deleteUser', () => {
        it('should successfully delete user from device', async () => {
            httpService.delete.mockReturnValue(of({ data: { success: true } }) as any);

            const result = await adapter.deleteUser('test-device-1', 'EMP001');

            expect(result).toBe(true);
            expect(httpService.delete).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Delete?format=json&employeeNo=EMP001',
                expect.objectContaining({
                    auth: { username: 'admin', password: mockDecryptedPassword },
                })
            );
        });

        it('should throw appropriate exception on device error', async () => {
            const error = { response: { status: 404, statusText: 'Not Found' } };
            httpService.delete.mockReturnValue(throwError(() => error) as any);

            await expect(adapter.deleteUser('test-device-1', 'EMP001')).rejects.toThrow(NotFoundException);
        });
    });

    describe('findUserByEmployeeNo', () => {
        it('should return user info when user exists', async () => {
            const mockResponse = {
                data: {
                    UserInfo: {
                        employeeNo: 'EMP001',
                        name: 'John Doe',
                        userType: 'normal',
                    },
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await adapter.findUserByEmployeeNo('test-device-1', 'EMP001');

            expect(result).toEqual({
                employeeNo: 'EMP001',
                name: 'John Doe',
                userType: 'normal',
            });
        });

        it('should return null when user does not exist', async () => {
            const error = { response: { status: 404 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            const result = await adapter.findUserByEmployeeNo('test-device-1', 'EMP001');

            expect(result).toBeNull();
        });
    });

    describe('getFaceData', () => {
        it('should return face data buffer when data exists', async () => {
            const mockSession = { security: 'test-key', identityKey: 'test-identity' };
            const mockFaceData = Buffer.from('fake-face-data');
            
            cacheService.getCachedData.mockResolvedValue({
                ...mockSession,
                expiresAt: Date.now() + 300000, // 5 minutes from now
            });
            
            httpService.get.mockReturnValue(of({ data: mockFaceData }) as any);

            const result = await adapter.getFaceData('test-device-1', 'EMP001');

            expect(result).toEqual(mockFaceData);
            expect(httpService.get).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/Intelligent/FDLib',
                expect.objectContaining({
                    params: expect.objectContaining({
                        employeeNo: 'EMP001',
                        security: 'test-key',
                        identityKey: 'test-identity',
                    }),
                    responseType: 'arraybuffer',
                })
            );
        });

        it('should return null when face data does not exist', async () => {
            const mockSession = { security: 'test-key', identityKey: 'test-identity' };
            cacheService.getCachedData.mockResolvedValue({
                ...mockSession,
                expiresAt: Date.now() + 300000,
            });

            const error = { response: { status: 404 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            const result = await adapter.getFaceData('test-device-1', 'EMP001');

            expect(result).toBeNull();
        });
    });

    describe('getSecureSession', () => {
        it('should return cached session when available and not expired', async () => {
            const cachedSession = {
                security: 'cached-key',
                identityKey: 'cached-identity',
                expiresAt: Date.now() + 300000, // 5 minutes from now
            };
            cacheService.getCachedData.mockResolvedValue(cachedSession);

            // Access private method through any cast for testing
            const result = await (adapter as any).getSecureSession('test-device-1');

            expect(result).toEqual({
                security: 'cached-key',
                identityKey: 'cached-identity',
            });
            expect(httpService.get).not.toHaveBeenCalled();
        });

        it('should acquire new session when cache is empty', async () => {
            cacheService.get.mockResolvedValue(null);
            
            const mockResponse = {
                data: {
                    security: 'new-key',
                    identityKey: 'new-identity',
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await (adapter as any).getSecureSession('test-device-1');

            expect(result).toEqual({
                security: 'new-key',
                identityKey: 'new-identity',
            });
            expect(cacheService.set).toHaveBeenCalledWith(
                HikvisionCacheKeys.session('test-device-1'),
                expect.objectContaining({
                    security: 'new-key',
                    identityKey: 'new-identity',
                    expiresAt: expect.any(Number),
                }),
                HIKVISION_CONFIG.SESSION_CACHE_TTL
            );
        });

        it('should acquire new session when cached session is expired', async () => {
            const expiredSession = {
                security: 'expired-key',
                identityKey: 'expired-identity',
                expiresAt: Date.now() - 1000, // 1 second ago
            };
            cacheService.getCachedData.mockResolvedValue(expiredSession);

            const mockResponse = {
                data: {
                    security: 'fresh-key',
                    identityKey: 'fresh-identity',
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await (adapter as any).getSecureSession('test-device-1');

            expect(result).toEqual({
                security: 'fresh-key',
                identityKey: 'fresh-identity',
            });
        });
    });

    describe('sendCommand', () => {
        it('should successfully send unlock door command', async () => {
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const command = { command: 'unlock_door' as const };
            const result = await adapter.sendCommand('test-device-1', command);

            expect(result.success).toBe(true);
            expect(result.message).toContain('unlock_door executed successfully');
            expect(httpService.post).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/AccessControl/RemoteControl/door',
                expect.objectContaining({ cmd: 'open' }),
                expect.any(Object)
            );
        });

        it('should successfully send lock door command', async () => {
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const command = { command: 'lock_door' as const };
            const result = await adapter.sendCommand('test-device-1', command);

            expect(result.success).toBe(true);
            expect(httpService.post).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/AccessControl/RemoteControl/door',
                expect.objectContaining({ cmd: 'close' }),
                expect.any(Object)
            );
        });

        it('should handle sync_users command by delegating', async () => {
            const command = { command: 'sync_users' as const };
            const result = await adapter.sendCommand('test-device-1', command);

            expect(result.success).toBe(true);
            expect(result.message).toContain('delegated to syncUsers method');
        });

        it('should return failure result when command fails', async () => {
            const error = { response: { status: 500, statusText: 'Internal Server Error' } };
            httpService.post.mockReturnValue(throwError(() => error) as any);

            const command = { command: 'unlock_door' as const };
            const result = await adapter.sendCommand('test-device-1', command);

            expect(result.success).toBe(false);
            expect(result.message).toContain('error');
        });
    });

    describe('syncUsers', () => {
        it('should sync multiple users successfully', async () => {
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const users = [
                { userId: 'EMP001', accessLevel: 1 },
                { userId: 'EMP002', accessLevel: 2 },
            ];

            await adapter.syncUsers('test-device-1', users);

            expect(httpService.post).toHaveBeenCalledTimes(2);
        });

        it('should throw exception when sync fails', async () => {
            const error = { response: { status: 400, statusText: 'Bad Request' } };
            httpService.post.mockReturnValue(throwError(() => error) as any);

            const users = [{ userId: 'EMP001', accessLevel: 1 }];

            await expect(adapter.syncUsers('test-device-1', users)).rejects.toThrow(BadRequestException);
        });
    });

    describe('error handling', () => {
        it('should handle device not found in database', async () => {
            prismaService.device.findUnique.mockResolvedValue(null);

            await expect(adapter.testConnection('non-existent')).rejects.toThrow(NotFoundException);
        });

        it('should handle missing device configuration', async () => {
            const incompleteDevice = { ...mockDevice, ipAddress: null };
            prismaService.device.findUnique.mockResolvedValue(incompleteDevice);

            await expect(adapter.testConnection('test-device-1')).rejects.toThrow(NotFoundException);
        });
    });
});