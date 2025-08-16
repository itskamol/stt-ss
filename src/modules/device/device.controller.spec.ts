import { Test, TestingModule } from '@nestjs/testing';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import {
    CreateDeviceDto,
    DeviceCommandDto,
    PaginationResponseDto,
    UpdateDeviceDto,
} from '@/shared/dto';
import { DataScope, UserContext } from '@/shared/interfaces';
import { DeviceProtocol, DeviceStatus, DeviceType } from '@prisma/client';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';

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
            getDevicesByBranch: jest.fn(),
            getDeviceById: jest.fn(),
            getDeviceByIdentifier: jest.fn(),
            updateDevice: jest.fn(),
            deleteDevice: jest.fn(),
            searchDevices: jest.fn(),
            getDeviceCount: jest.fn(),
            getDeviceCountByBranch: jest.fn(),
            toggleDeviceStatus: jest.fn(),
            getDeviceWithStats: jest.fn(),
            getDeviceHealth: jest.fn(),
            testDeviceConnection: jest.fn(),
            sendDeviceCommand: jest.fn(),
            discoverDevices: jest.fn(),
            createDeviceWithSimplifiedInfo: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DeviceController],
            providers: [
                {
                    provide: DeviceService,
                    useValue: mockDeviceService,
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
                type: DeviceType.CARD_READER,
                serialNumber: 'READER-001',
                branchId: 'branch-123',
                host: '192.168.1.100',
                description: 'Main entrance card reader',
                isActive: true,
            };

            deviceService.createDevice.mockResolvedValue(mockDevice);

            const result = await controller.createDevice(createDto, mockUserContext, mockDataScope);

            expect(deviceService.createDevice).toHaveBeenCalledWith(
                createDto,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.id).toBe(mockDevice.id);
        });
    });

    describe('getDevices', () => {
        it('should return paginated devices', async () => {
            const paginatedResponse = new PaginationResponseDto([mockDevice], 1, 1, 10);
            deviceService.getDevices.mockResolvedValue(paginatedResponse as any);

            const result = await controller.getDevices(mockDataScope, { page: 1, limit: 10 });

            expect(deviceService.getDevices).toHaveBeenCalledWith(mockDataScope, { page: 1, limit: 10 });
            expect(result).toEqual(paginatedResponse);
        });
    });

    describe('getDevicesByBranch', () => {
        it('should return devices for a specific branch', async () => {
            const devices = [mockDevice];
            deviceService.getDevicesByBranch.mockResolvedValue(devices);

            const result = await controller.getDevicesByBranch('branch-123', mockDataScope);

            expect(deviceService.getDevicesByBranch).toHaveBeenCalledWith(
                'branch-123',
                mockDataScope
            );
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(mockDevice.id);
        });
    });

    describe('getDeviceById', () => {
        it('should return a device by ID', async () => {
            deviceService.getDeviceById.mockResolvedValue(mockDevice);

            const result = await controller.getDeviceById('device-123', mockDataScope);

            expect(deviceService.getDeviceById).toHaveBeenCalledWith('device-123', mockDataScope);
            expect(result.id).toBe(mockDevice.id);
        });
    });

    describe('getDeviceBySerialNumber', () => {
        it('should return a device by identifier', async () => {
            deviceService.getDeviceBySerialNumber.mockResolvedValue(mockDevice);

            const result = await controller.getDeviceByIdentifier('READER-001', mockDataScope);

            expect(deviceService.getDeviceBySerialNumber).toHaveBeenCalledWith(
                'READER-001',
                mockDataScope
            );
            expect(result.serialNumber).toBe(mockDevice.serialNumber);
        });

        it('should throw error when device not found by identifier', async () => {
            deviceService.getDeviceBySerialNumber.mockResolvedValue(null);

            await expect(
                controller.getDeviceByIdentifier('NONEXISTENT', mockDataScope)
            ).rejects.toThrow();
        });
    });

    describe('updateDevice', () => {
        it('should update a device successfully', async () => {
            const updateDto: UpdateDeviceDto = {
                name: 'Updated Door Reader',
                description: 'Updated description',
            };

            const updatedDevice = {
                ...mockDevice,
                name: 'Updated Door Reader',
                description: 'Updated description',
            };
            deviceService.updateDevice.mockResolvedValue(updatedDevice);

            const result = await controller.updateDevice(
                'device-123',
                updateDto,
                mockUserContext,
                mockDataScope
            );

            expect(deviceService.updateDevice).toHaveBeenCalledWith(
                'device-123',
                updateDto,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.name).toBe('Updated Door Reader');
        });
    });

    describe('toggleDeviceStatus', () => {
        it('should toggle device status successfully', async () => {
            const deactivatedDevice = { ...mockDevice, isActive: false };
            deviceService.toggleDeviceStatus.mockResolvedValue(deactivatedDevice);

            const result = await controller.toggleDeviceStatus(
                'device-123',
                false,
                mockUserContext,
                mockDataScope
            );

            expect(deviceService.toggleDeviceStatus).toHaveBeenCalledWith(
                'device-123',
                false,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.isActive).toBe(false);
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

    describe('searchDevices', () => {
        it('should return empty array for short search terms', async () => {
            const result = await controller.searchDevices('a', mockDataScope);

            expect(result).toEqual([]);
            expect(deviceService.searchDevices).not.toHaveBeenCalled();
        });

        it('should search devices with valid search term', async () => {
            const devices = [mockDevice];
            deviceService.searchDevices.mockResolvedValue(devices);

            const result = await controller.searchDevices('reader', mockDataScope);

            expect(deviceService.searchDevices).toHaveBeenCalledWith('reader', mockDataScope);
            expect(result).toHaveLength(1);
        });
    });

    describe('getDeviceCount', () => {
        it('should return device count', async () => {
            deviceService.getDeviceCount.mockResolvedValue(5);

            const result = await controller.getDeviceCount(mockDataScope);

            expect(deviceService.getDeviceCount).toHaveBeenCalledWith(mockDataScope);
            expect(result.count).toBe(5);
        });
    });

    describe('getDeviceCountByBranch', () => {
        it('should return device count for a branch', async () => {
            deviceService.getDeviceCountByBranch.mockResolvedValue(3);

            const result = await controller.getDeviceCountByBranch('branch-123', mockDataScope);

            expect(deviceService.getDeviceCountByBranch).toHaveBeenCalledWith(
                'branch-123',
                mockDataScope
            );
            expect(result.count).toBe(3);
        });
    });

    describe('getDeviceWithStats', () => {
        it('should return device with statistics', async () => {
            const deviceWithStats = {
                ...mockDevice,
                statistics: {
                    totalEvents: 150,
                },
            };

            deviceService.getDeviceWithStats.mockResolvedValue(deviceWithStats);

            const result: any = await controller.getDeviceWithStats('device-123', mockDataScope);

            expect(deviceService.getDeviceWithStats).toHaveBeenCalledWith(
                'device-123',
                mockDataScope
            );
            expect(result.statistics.totalEvents).toBe(150);
        });
    });

    describe('getDeviceHealth', () => {
        it('should return device health status', async () => {
            const healthStatus = {
                deviceId: 'READER-001',
                status: DeviceStatus.ONLINE,
                uptime: 86400,
                lastHealthCheck: new Date(),
            };

            deviceService.getDeviceHealth.mockResolvedValue(healthStatus as any);

            const result = await controller.getDeviceHealth('device-123', mockDataScope);

            expect(deviceService.getDeviceHealth).toHaveBeenCalledWith('device-123', mockDataScope);
            expect(result.status).toBe(DeviceStatus.ONLINE);
            expect(result.uptime).toBe(86400);
        });
    });

    describe('testDeviceConnection', () => {
        it('should test device connection successfully', async () => {
            const connectionResult: any = {
                success: true,
                message: 'Connected',
            };

            deviceService.testDeviceConnection.mockResolvedValue(connectionResult);

            const result = await controller.testDeviceConnection('device-123', mockDataScope);

            expect(deviceService.testDeviceConnection).toHaveBeenCalledWith(
                'device-123',
                mockDataScope
            );
            expect(result.success).toBe(true);
        });
    });

    describe('sendDeviceCommand', () => {
        it('should send command to device successfully', async () => {
            const commandDto: DeviceCommandDto = {
                command: 'unlock_door',
                parameters: { duration: 5 },
                timeout: 30,
            };

            const commandResult = {
                success: true,
                message: 'Command executed successfully',
                executedAt: new Date(),
            };

            deviceService.sendDeviceCommand.mockResolvedValue(commandResult);

            const result = await controller.sendDeviceCommand(
                'device-123',
                commandDto,
                mockUserContext,
                mockDataScope
            );

            expect(deviceService.sendDeviceCommand).toHaveBeenCalledWith(
                'device-123',
                {
                    command: commandDto.command,
                    parameters: commandDto.parameters,
                    timeout: commandDto.timeout,
                },
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.success).toBe(true);
        });
    });
});
