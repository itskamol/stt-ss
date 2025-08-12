import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

import { EncryptionService } from './encryption.service';
import { PrismaService } from '@/core/database/prisma.service';
import {
    HikvisionDeviceConfigService,
    DeviceConnectionTest,
    DeviceSystemInfo,
    DeviceNetworkInfo,
    DeviceCapabilities
} from './hikvision-device-config.service';
import { HikvisionDeviceConfig, HIKVISION_CONFIG } from '../adapters/hikvision.adapter';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

describe('HikvisionDeviceConfigService', () => {
    let service: HikvisionDeviceConfigService;
    let httpService: jest.Mocked<HttpService>;
    let encryptionService: jest.Mocked<EncryptionService>;
    let prismaService: any;

    const mockDevice = {
        id: 'test-device-1',
        name: 'Test Hikvision Camera',
        ipAddress: '192.168.1.100',
        username: 'admin',
        encryptedSecret: 'encrypted-password',
    };

    const mockDecryptedPassword = 'admin123';

    beforeEach(async () => {
        const mockHttpService = {
            get: jest.fn(),
            put: jest.fn(),
            post: jest.fn(),
        };

        const mockEncryptionService = {
            decrypt: jest.fn(),
        };

        const mockPrismaService = {
            device: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HikvisionDeviceConfigService,
                { provide: HttpService, useValue: mockHttpService },
                { provide: EncryptionService, useValue: mockEncryptionService },
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<HikvisionDeviceConfigService>(HikvisionDeviceConfigService);
        httpService = module.get(HttpService);
        encryptionService = module.get(EncryptionService);
        prismaService = module.get(PrismaService);

        // Setup default mocks
        prismaService.device.findUnique.mockResolvedValue(mockDevice);
        encryptionService.decrypt.mockReturnValue(mockDecryptedPassword);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('testDeviceConnection', () => {
        it('should return successful connection test', async () => {
            httpService.get.mockReturnValue(of({ data: {} }) as any);

            const result = await service.testDeviceConnection('test-device-1');

            expect(result.success).toBe(true);
            expect(result.deviceId).toBe('test-device-1');
            expect(result.responseTime).toBeGreaterThan(0);
            expect(result.timestamp).toBeInstanceOf(Date);
            expect(result.error).toBeUndefined();
        });

        it('should return failed connection test with error details', async () => {
            const error = new Error('Connection timeout');
            httpService.get.mockReturnValue(throwError(() => error) as any);

            const result = await service.testDeviceConnection('test-device-1');

            expect(result.success).toBe(false);
            expect(result.deviceId).toBe('test-device-1');
            expect(result.responseTime).toBeGreaterThan(0);
            expect(result.error).toBe('Connection timeout');
        });

        it('should use correct endpoint and authentication', async () => {
            httpService.get.mockReturnValue(of({ data: {} }) as any);

            await service.testDeviceConnection('test-device-1');

            expect(httpService.get).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/System/deviceInfo',
                expect.objectContaining({
                    auth: { username: 'admin', password: mockDecryptedPassword },
                    timeout: 5000,
                })
            );
        });
    });

    describe('getDeviceSystemInfo', () => {
        it('should return device system information', async () => {
            const mockResponse = {
                data: {
                    deviceName: 'Test Camera',
                    deviceType: 'IP Camera',
                    serialNumber: 'SN123456789',
                    firmwareVersion: 'V5.6.0',
                    hardwareVersion: 'H1.0',
                    bootTime: '2023-01-01T00:00:00Z',
                    uptime: 86400,
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await service.getDeviceSystemInfo('test-device-1');

            expect(result).toEqual({
                deviceName: 'Test Camera',
                deviceType: 'IP Camera',
                serialNumber: 'SN123456789',
                firmwareVersion: 'V5.6.0',
                hardwareVersion: 'H1.0',
                bootTime: new Date('2023-01-01T00:00:00Z'),
                uptime: 86400,
            });
        });

        it('should handle missing optional fields', async () => {
            const mockResponse = {
                data: {
                    deviceName: 'Test Camera',
                    deviceType: 'IP Camera',
                    serialNumber: 'SN123456789',
                    firmwareVersion: 'V5.6.0',
                    hardwareVersion: 'H1.0',
                    // Missing bootTime and uptime
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await service.getDeviceSystemInfo('test-device-1');

            expect(result!.bootTime).toBeUndefined();
            expect(result!.uptime).toBe(0);
        });

        it('should return null when device is unreachable', async () => {
            const error = { response: { status: 500 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            const result = await service.getDeviceSystemInfo('test-device-1');

            expect(result).toBeNull();
        });
    });

    describe('getDeviceNetworkInfo', () => {
        it('should return device network information', async () => {
            const mockResponse = {
                data: {
                    ipAddress: '192.168.1.100',
                    macAddress: '00:11:22:33:44:55',
                    gateway: '192.168.1.1',
                    subnetMask: '255.255.255.0',
                    dns: '8.8.8.8',
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await service.getDeviceNetworkInfo('test-device-1');

            expect(result).toEqual({
                ipAddress: '192.168.1.100',
                macAddress: '00:11:22:33:44:55',
                gateway: '192.168.1.1',
                subnet: '255.255.255.0',
                dns: ['8.8.8.8'],
            });
        });

        it('should use device IP as fallback', async () => {
            const mockResponse = {
                data: {
                    // Missing ipAddress in response
                    macAddress: '00:11:22:33:44:55',
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await service.getDeviceNetworkInfo('test-device-1');

            expect(result!.ipAddress).toBe('192.168.1.100'); // From device config
        });

        it('should return null on error', async () => {
            const error = { response: { status: 404 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            const result = await service.getDeviceNetworkInfo('test-device-1');

            expect(result).toBeNull();
        });
    });

    describe('getDeviceCapabilities', () => {
        it('should return device capabilities', async () => {
            const mockResponse = {
                data: {
                    maxUsers: 2000,
                    maxCards: 2000,
                    maxFingerprints: 1000,
                    maxFaces: 1000,
                    supportedFeatures: ['face_recognition', 'card_reader'],
                    videoFormats: ['H.264', 'H.265'],
                    audioFormats: ['G.711'],
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await service.getDeviceCapabilities('test-device-1');

            expect(result).toEqual({
                maxUsers: 2000,
                maxCards: 2000,
                maxFingerprints: 1000,
                maxFaces: 1000,
                supportedFeatures: ['face_recognition', 'card_reader'],
                videoFormats: ['H.264', 'H.265'],
                audioFormats: ['G.711'],
            });
        });

        it('should use default values for missing fields', async () => {
            const mockResponse = {
                data: {
                    // Missing most fields
                    supportedFeatures: ['basic'],
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await service.getDeviceCapabilities('test-device-1');

            expect(result!.maxUsers).toBe(1000); // Default value
            expect(result!.supportedFeatures).toEqual(['basic']);
        });
    });

    describe('updateDeviceNetworkConfig', () => {
        it('should update device network configuration', async () => {
            httpService.put.mockReturnValue(of({ data: { success: true } }) as any);
            prismaService.device.update.mockResolvedValue(mockDevice);

            const networkConfig = {
                ipAddress: '192.168.1.101',
                gateway: '192.168.1.1',
            };

            const result = await service.updateDeviceNetworkConfig('test-device-1', networkConfig);

            expect(result).toBe(true);
            expect(httpService.put).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/System/Network/interfaces/1',
                expect.objectContaining({
                    NetworkInterface: expect.objectContaining({
                        id: 1,
                        ipAddress: '192.168.1.101',
                        gateway: '192.168.1.1',
                    }),
                }),
                expect.any(Object)
            );
            expect(prismaService.device.update).toHaveBeenCalledWith({
                where: { id: 'test-device-1' },
                data: { ipAddress: '192.168.1.101' },
            });
        });

        it('should not update database if IP address not changed', async () => {
            httpService.put.mockReturnValue(of({ data: { success: true } }) as any);

            const networkConfig = {
                gateway: '192.168.1.1',
            };

            await service.updateDeviceNetworkConfig('test-device-1', networkConfig);

            expect(prismaService.device.update).not.toHaveBeenCalled();
        });

        it('should throw exception on device error', async () => {
            const error = { response: { status: 400, statusText: 'Bad Request' } };
            httpService.put.mockReturnValue(throwError(() => error) as any);

            const networkConfig = { ipAddress: '192.168.1.101' };

            await expect(
                service.updateDeviceNetworkConfig('test-device-1', networkConfig)
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('validateDeviceConfig', () => {
        it('should return empty array for valid configuration', async () => {
            const config: Partial<HikvisionDeviceConfig> = {
                ipAddress: '192.168.1.100',
                port: 80,
                username: 'admin',
                timeout: 5000,
            };

            const errors = await service.validateDeviceConfig(config);

            expect(errors).toEqual([]);
        });

        it('should return errors for invalid configuration', async () => {
            const config: Partial<HikvisionDeviceConfig> = {
                ipAddress: 'invalid-ip',
                port: 70000, // Invalid port
                username: '', // Empty username
                timeout: 500, // Too short timeout
            };

            const errors = await service.validateDeviceConfig(config);

            expect(errors).toContain('Invalid IP address format');
            expect(errors).toContain('Port must be between 1 and 65535');
            expect(errors).toContain('Username cannot be empty');
            expect(errors).toContain('Timeout must be at least 1000ms');
        });
    });

    describe('createDeviceConfigFromTemplate', () => {
        it('should create device configuration from template', async () => {
            const result = await service.createDeviceConfigFromTemplate('test-device-1', 'default');

            expect(result.deviceId).toBe('test-device-1');
            expect(result.settings).toEqual({
                timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                maxRetries: HIKVISION_CONFIG.MAX_RETRIES,
                retryDelay: HIKVISION_CONFIG.RETRY_DELAY,
            });
            expect(result.schedules).toBeDefined();
            expect(result.accessRules).toBeDefined();
            expect(result.schedules!.length).toBeGreaterThan(0);
            expect(result.accessRules!.length).toBeGreaterThan(0);
        });
    });

    describe('backupDeviceConfiguration', () => {
        it('should backup device configuration', async () => {
            const mockBackupData = Buffer.from('backup-data');
            httpService.get.mockReturnValue(of({ data: mockBackupData }) as any);

            const result = await service.backupDeviceConfiguration('test-device-1');

            expect(result.deviceId).toBe('test-device-1');
            expect(result.timestamp).toBeInstanceOf(Date);
            expect(result.data).toEqual(mockBackupData);
            expect(result.size).toBe(mockBackupData.length);
            expect(httpService.get).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/System/configurationData',
                expect.objectContaining({
                    timeout: 30000,
                    responseType: 'arraybuffer',
                })
            );
        });

        it('should throw exception on backup failure', async () => {
            const error = { response: { status: 500 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            await expect(
                service.backupDeviceConfiguration('test-device-1')
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('restoreDeviceConfiguration', () => {
        it('should restore device configuration', async () => {
            httpService.put.mockReturnValue(of({ data: { success: true } }) as any);

            const backupData = Buffer.from('backup-data');
            const result = await service.restoreDeviceConfiguration('test-device-1', backupData);

            expect(result).toBe(true);
            expect(httpService.put).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/System/configurationData',
                backupData,
                expect.objectContaining({
                    timeout: 60000,
                    headers: {
                        'Content-Type': 'application/octet-stream',
                    },
                })
            );
        });

        it('should throw exception on restore failure', async () => {
            const error = { response: { status: 400 } };
            httpService.put.mockReturnValue(throwError(() => error) as any);

            const backupData = Buffer.from('backup-data');

            await expect(
                service.restoreDeviceConfiguration('test-device-1', backupData)
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('error handling', () => {
        it('should handle device not found in database', async () => {
            prismaService.device.findUnique.mockResolvedValue(null);

            await expect(
                service.testDeviceConnection('non-existent')
            ).rejects.toThrow('Device configuration not found or incomplete');
        });

        it('should handle incomplete device configuration', async () => {
            const incompleteDevice = { ...mockDevice, ipAddress: null };
            prismaService.device.findUnique.mockResolvedValue(incompleteDevice);

            await expect(
                service.testDeviceConnection('test-device-1')
            ).rejects.toThrow('Device configuration not found or incomplete');
        });
    });
});