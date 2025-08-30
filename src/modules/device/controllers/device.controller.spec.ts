import { Test, TestingModule } from '@nestjs/testing';
import { DeviceController } from './device.controller';
import {
    CreateDeviceDto,
    PaginationResponseDto,
} from '@/shared/dto';
import { DataScope, UserContext } from '@/shared/interfaces';
import { DeviceProtocol } from '@prisma/client';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DeviceService } from '../services/device.service';
import { DeviceDiscoveryService } from '../services/device-discovery.service';
import { DeviceTemplateService } from '../services/device-template.service';
import { DeviceWebhookService } from '../services/device-webhook.service';
import { PaginationService } from '@/shared/services/pagination.service';
import { LoggerService } from '@/core/logger';

describe('DeviceController', () => {
    let controller: DeviceController;
    let deviceService: jest.Mocked<DeviceService>;

    const mockUserContext: UserContext = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        roles: ['ADMIN'],
        permissions: [PERMISSIONS.DEVICE.CREATE, PERMISSIONS.DEVICE.READ_ALL],
    };

    const mockDataScope: DataScope = {
        organizationId: 'org-123',
        branchIds: ['branch-123'],
    };

    const mockDevice = {
        id: 'device-123',
        organizationId: 'org-123',
        branchId: 'branch-123',
        departmentId: 'dept-123',
        name: 'Main Door Reader',
        type: 'CARD_READER' as any,
        serialNumber: 'READER-001',
        host: '192.168.1.100',
        username: 'admin',
        password: 'password123',
        port: 8080,
        protocol: DeviceProtocol.TCP,
        macAddress: '00:11:22:33:44:55',
        manufacturer: 'DeviceCorp',
        model: 'Reader-X1',
        firmware: 'v1.2.3',
        description: 'Main entrance card reader',
        status: 'ONLINE' as any,
        isActive: true,
        lastSeen: new Date(),
        timeout: 5000,
        retryAttempts: 3,
        keepAlive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const mockDeviceService = {
            createDevice: jest.fn(),
            getDevices: jest.fn(),
            getDeviceById: jest.fn(),
            deleteDevice: jest.fn(),
        };

              const module: TestingModule = await Test.createTestingModule({
            controllers: [DeviceController],
            providers: [
                {
                    provide: DeviceService,
                    useValue: mockDeviceService,
                },
                {
                    provide: DeviceDiscoveryService,
                    useValue: {},
                },
                {
                    provide: DeviceTemplateService,
                    useValue: {},
                },
                {
                    provide: DeviceWebhookService,
                    useValue: {},
                },
                {
                    provide: PaginationService,
                    useValue: {
                        paginate: jest.fn().mockImplementation(async (dataPromise, totalPromise, page, limit) => {
                            const data = await dataPromise;
                            const total = await totalPromise;
                            return new PaginationResponseDto(data, total, page, limit);
                        }),
                    },
                },
                {
                    provide: LoggerService,
                    useValue: {
                        log: jest.fn(),
                        error: jest.fn(),
                        warn: jest.fn(),
                        debug: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get<DeviceController>(DeviceController);
        deviceService = module.get(DeviceService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createDevice', () => {
        it('should create a device successfully', async () => {
            const createDto: CreateDeviceDto = {
                name: 'Main Door Reader',
                branchId: 'branch-123',
                host: '192.168.1.100',
                manufacturer: 'hikvision',
            };

            deviceService.createDevice.mockResolvedValue(mockDevice as any);

            const result = await controller.createDevice(createDto, mockUserContext, mockDataScope);

            expect(deviceService.createDevice).toHaveBeenCalledWith(
                createDto,
                mockDataScope
            );
            expect(result.id).toBe(mockDevice.id);
        });
    });

    describe('getDevices', () => {
        it('should return paginated devices', async () => {
            deviceService.getDevices.mockResolvedValue({ data: [mockDevice], total: 1 } as any);

            const result = await controller.getDevices(mockDataScope, { page: 1, limit: 10 } as any);

            expect(deviceService.getDevices).toHaveBeenCalledWith(
                {
                    page: 1,
                    limit: 10,
                },
                mockDataScope,
            );

            expect(result).toBeInstanceOf(PaginationResponseDto);
            expect(result.data).toEqual([mockDevice]);
            expect(result.total).toBe(1);
        });
    });

    describe('getDeviceById', () => {
        it('should return a device by ID', async () => {
            deviceService.getDeviceById.mockResolvedValue(mockDevice as any);

            const result = await controller.getDeviceById('device-123', mockDataScope);

            expect(deviceService.getDeviceById).toHaveBeenCalledWith('device-123', mockDataScope);
            expect(result.id).toBe(mockDevice.id);
        });
    });

    describe('deleteDevice', () => {
        it('should delete a device successfully', async () => {
            deviceService.deleteDevice.mockResolvedValue();

            await controller.deleteDevice('device-123', mockUserContext, mockDataScope);

            expect(deviceService.deleteDevice).toHaveBeenCalledWith(
                'device-123',
                mockDataScope,
                mockUserContext.sub
            );
        });
    });
});
