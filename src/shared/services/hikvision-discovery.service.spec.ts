import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

import { PrismaService } from '@/core/database/prisma.service';
import { EncryptionService } from './encryption.service';
import { 
    ConfigurationValidationResult,
    DeviceConfigurationTemplate,
    DiscoveredDevice,
    HikvisionDiscoveryService,
    NetworkDiscoveryOptions 
} from './hikvision-discovery.service';
import { DeviceConfiguration, DeviceSchedule, DeviceAccessRule } from '../adapters/device.adapter';
import { DeviceType } from '@prisma/client';

describe('HikvisionDiscoveryService', () => {
    let service: HikvisionDiscoveryService;
    let httpService: jest.Mocked<HttpService>;
    let prismaService: any;
    let encryptionService: jest.Mocked<EncryptionService>;

    const mockDevice = {
        id: 'test-device-1',
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
        };

        const mockPrismaService = {
            device: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
            },
        };

        const mockEncryptionService = {
            decrypt: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HikvisionDiscoveryService,
                { provide: HttpService, useValue: mockHttpService },
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: EncryptionService, useValue: mockEncryptionService },
            ],
        }).compile();

        service = module.get<HikvisionDiscoveryService>(HikvisionDiscoveryService);
        httpService = module.get(HttpService);
        prismaService = module.get(PrismaService);
        encryptionService = module.get(EncryptionService);

        // Setup default mocks
        prismaService.device.findUnique.mockResolvedValue(mockDevice);
        encryptionService.decrypt.mockReturnValue(mockDecryptedPassword);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('discoverDevices', () => {
        it('should discover devices via network scan', async () => {
            // Mock HTTP responses for device scan
            httpService.get
                .mockReturnValueOnce(of({ 
                    status: 401, 
                    headers: { 'www-authenticate': 'Digest realm="Hikvision"' },
                    data: { deviceType: 'IP Camera', serialNumber: 'SN123' }
                }) as any)
                .mockReturnValueOnce(throwError(() => new Error('Connection refused')) as any);

            // Mock database check
            prismaService.device.findFirst.mockResolvedValue(null);

            const options: NetworkDiscoveryOptions = {
                networkRange: '192.168.1.0/24',
                timeout: 1000,
                maxConcurrent: 2,
                ports: [80],
                useUPnP: false,
                useBroadcast: false,
            };

            const result = await service.discoverDevices(options);

            expect(result).toHaveLength(1);
            expect(result[0].ipAddress).toBe('192.168.1.1');
            expect(result[0].discoveryMethod).toBe('scan');
            expect(result[0].isConfigured).toBe(false);
        });

        it('should mark devices as configured if they exist in database', async () => {
            httpService.get.mockReturnValue(of({ 
                status: 401, 
                headers: { 'www-authenticate': 'Digest realm="Hikvision"' },
                data: {}
            }) as any);

            // Mock device exists in database
            prismaService.device.findFirst.mockResolvedValue(mockDevice);

            const options: NetworkDiscoveryOptions = {
                networkRange: '192.168.1.0/24',
                timeout: 1000,
                maxConcurrent: 1,
                ports: [80],
                useUPnP: false,
                useBroadcast: false,
            };

            const result = await service.discoverDevices(options);

            expect(result[0].isConfigured).toBe(true);
        });

        it('should handle discovery errors gracefully', async () => {
            httpService.get.mockReturnValue(throwError(() => new Error('Network error')) as any);

            const options: NetworkDiscoveryOptions = {
                networkRange: '192.168.1.0/24',
                timeout: 1000,
                maxConcurrent: 1,
                ports: [80],
                useUPnP: false,
                useBroadcast: false,
            };

            const result = await service.discoverDevices(options);

            expect(result).toHaveLength(0);
        });
    });

    describe('getDeviceConfiguration', () => {
        it('should retrieve device configuration', async () => {
            const mockDeviceInfo = {
                deviceName: 'Test Camera',
                deviceType: 'IP Camera',
                firmwareVersion: 'V5.6.0',
            };

            const mockAccessSettings = {
                maxUsers: 1000,
                enableFaceRecognition: true,
            };

            httpService.get
                .mockReturnValueOnce(of({ data: mockDeviceInfo }) as any)
                .mockReturnValueOnce(of({ data: mockAccessSettings }) as any);

            const result = await service.getDeviceConfiguration('test-device-1');

            expect(result.deviceId).toBe('test-device-1');
            expect(result.settings).toEqual({
                ...mockDeviceInfo,
                accessControl: mockAccessSettings,
            });
            expect(result.schedules).toBeDefined();
            expect(result.accessRules).toBeDefined();
        });

        it('should handle missing access control settings', async () => {
            const mockDeviceInfo = {
                deviceName: 'Test Camera',
                deviceType: 'IP Camera',
            };

            httpService.get
                .mockReturnValueOnce(of({ data: mockDeviceInfo }) as any)
                .mockReturnValueOnce(throwError(() => ({ response: { status: 404 } })) as any);

            const result = await service.getDeviceConfiguration('test-device-1');

            expect(result.settings.accessControl).toEqual({});
        });

        it('should throw exception on device error', async () => {
            const error = { response: { status: 500 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            await expect(service.getDeviceConfiguration('test-device-1')).rejects.toThrow();
        });
    });

    describe('updateDeviceConfiguration', () => {
        it('should update device configuration', async () => {
            const configuration: Partial<DeviceConfiguration> = {
                settings: {
                    maxUsers: 2000,
                    enableFaceRecognition: true,
                },
                schedules: [
                    {
                        id: 'test-schedule',
                        name: 'Test Schedule',
                        startTime: '09:00',
                        endTime: '17:00',
                        daysOfWeek: [1, 2, 3, 4, 5],
                        enabled: true,
                    },
                ],
            };

            // Mock successful updates (private methods are called)
            await expect(service.updateDeviceConfiguration('test-device-1', configuration)).resolves.not.toThrow();
        });

        it('should handle update errors', async () => {
            prismaService.device.findUnique.mockResolvedValue(null);

            const configuration: Partial<DeviceConfiguration> = {
                settings: { maxUsers: 2000 },
            };

            await expect(service.updateDeviceConfiguration('test-device-1', configuration)).rejects.toThrow();
        });
    });

    describe('applyConfigurationTemplate', () => {
        it('should apply configuration template', async () => {
            const template: DeviceConfigurationTemplate = {
                name: 'Test Template',
                description: 'Test template description',
                deviceType: DeviceType.CAMERA,
                settings: {
                    maxUsers: 1000,
                    enableFaceRecognition: true,
                },
                schedules: [],
                accessRules: [],
                networkSettings: {
                    dhcp: false,
                    staticIp: '192.168.1.100',
                },
            };

            await expect(service.applyConfigurationTemplate('test-device-1', template)).resolves.not.toThrow();
        });
    });

    describe('validateDeviceConfiguration', () => {
        it('should validate valid configuration', async () => {
            const configuration: DeviceConfiguration = {
                deviceId: 'test-device-1',
                settings: {
                    timeout: 5000,
                    maxUsers: 1000,
                },
                schedules: [
                    {
                        id: 'test-schedule',
                        name: 'Test Schedule',
                        startTime: '09:00',
                        endTime: '17:00',
                        daysOfWeek: [1, 2, 3, 4, 5],
                        enabled: true,
                    },
                ],
                accessRules: [
                    {
                        id: 'test-rule',
                        name: 'Test Rule',
                        userGroups: ['employees'],
                        timeSchedules: ['test-schedule'],
                        enabled: true,
                    },
                ],
            };

            const result = await service.validateDeviceConfiguration('test-device-1', configuration);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect configuration errors', async () => {
            const configuration: DeviceConfiguration = {
                deviceId: 'test-device-1',
                settings: {
                    timeout: 500, // Too low
                },
                schedules: [
                    {
                        id: 'invalid-schedule',
                        name: 'Invalid Schedule',
                        startTime: '', // Missing
                        endTime: '', // Missing
                        daysOfWeek: [],
                        enabled: true,
                    },
                ],
                accessRules: [
                    {
                        id: 'invalid-rule',
                        name: 'Invalid Rule',
                        userGroups: [], // Empty
                        timeSchedules: [],
                        enabled: true,
                    },
                ],
            };

            const result = await service.validateDeviceConfiguration('test-device-1', configuration);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors).toContain('Timeout must be at least 1000ms');
            expect(result.errors).toContain('Schedule Invalid Schedule must have start and end times');
            expect(result.errors).toContain('Access rule Invalid Rule must have at least one user group');
        });

        it('should provide warnings for suboptimal configuration', async () => {
            const configuration: DeviceConfiguration = {
                deviceId: 'test-device-1',
                settings: {
                    maxUsers: 15000, // High number
                },
                schedules: [
                    {
                        id: 'no-days-schedule',
                        name: 'No Days Schedule',
                        startTime: '09:00',
                        endTime: '17:00',
                        daysOfWeek: [], // No active days
                        enabled: true,
                    },
                ],
                accessRules: [
                    {
                        id: 'no-schedule-rule',
                        name: 'No Schedule Rule',
                        userGroups: ['employees'],
                        timeSchedules: [], // No schedules
                        enabled: true,
                    },
                ],
            };

            const result = await service.validateDeviceConfiguration('test-device-1', configuration);

            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings).toContain('Maximum users exceeds recommended limit of 10000');
            expect(result.warnings).toContain('Schedule No Days Schedule has no active days');
            expect(result.warnings).toContain('Access rule No Schedule Rule has no time schedules');
        });

        it('should provide configuration suggestions', async () => {
            const configuration: DeviceConfiguration = {
                deviceId: 'test-device-1',
                settings: {},
                schedules: [], // Empty
                accessRules: [], // Empty
            };

            const result = await service.validateDeviceConfiguration('test-device-1', configuration);

            expect(result.suggestions.length).toBeGreaterThan(0);
            expect(result.suggestions).toContain('Consider adding time schedules for better access control');
            expect(result.suggestions).toContain('Consider adding access rules to control user permissions');
        });
    });

    describe('getDefaultConfigurationTemplates', () => {
        it('should return default configuration templates', () => {
            const templates = service.getDefaultConfigurationTemplates();

            expect(templates.length).toBeGreaterThan(0);
            expect(templates[0].name).toBe('Basic Access Control');
            expect(templates[0].deviceType).toBe(DeviceType.CAMERA);
            expect(templates[0].schedules.length).toBeGreaterThan(0);
            expect(templates[0].accessRules.length).toBeGreaterThan(0);
        });

        it('should include high security template', () => {
            const templates = service.getDefaultConfigurationTemplates();
            const highSecurityTemplate = templates.find(t => t.name === 'High Security');

            expect(highSecurityTemplate).toBeDefined();
            expect(highSecurityTemplate!.settings.requireDualAuthentication).toBe(true);
            expect(highSecurityTemplate!.settings.enableAntiPassback).toBe(true);
            expect(highSecurityTemplate!.networkSettings).toBeDefined();
        });
    });

    describe('private methods', () => {
        it('should generate IP range for /24 network', () => {
            // Test private method through public interface
            const options: NetworkDiscoveryOptions = {
                networkRange: '192.168.1.0/24',
                timeout: 100,
                maxConcurrent: 1,
                ports: [80],
                useUPnP: false,
                useBroadcast: false,
            };

            // Mock to prevent actual network calls
            httpService.get.mockReturnValue(throwError(() => new Error('No response')) as any);

            expect(service.discoverDevices(options)).resolves.toEqual([]);
        });

        it('should identify Hikvision devices correctly', async () => {
            // Test through network scan
            httpService.get.mockReturnValue(of({ 
                status: 401,
                headers: { 'server': 'Hikvision-Webs' },
                data: {}
            }) as any);

            prismaService.device.findFirst.mockResolvedValue(null);

            const options: NetworkDiscoveryOptions = {
                networkRange: '192.168.1.0/24',
                timeout: 100,
                maxConcurrent: 1,
                ports: [80],
                useUPnP: false,
                useBroadcast: false,
            };

            const result = await service.discoverDevices(options);
            expect(result.length).toBeGreaterThan(0);
        });
    });
});