import { Test, TestingModule } from '@nestjs/testing';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { CreateDeviceDto, DeviceCommandDto, UpdateDeviceDto } from '../../shared/dto';
import { DataScope, UserContext } from '../../shared/interfaces';

describe('DeviceController', () => {
    let controller: DeviceController;
    let deviceService: jest.Mocked<DeviceService>;

    const mockUserContext: UserContext = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        roles: ['ADMIN'],
        permissions: ['device:create', 'device:read:all'],
    };

    const mockDataScope: DataScope = {
        organizationId: 'org-123',
        branchIds: ['branch-123'],
    };

    const mockDevice = {
        id: 'device-123',
        organizationId: 'org-123',
        branchId: 'branch-123',
        name: 'Main Door Reader',
        type: 'CARD_READER' as any,
        deviceIdentifier: 'READER-001',
        ipAddress: '192.168.1.100',
        macAddress: '00:11:22:33:44:55',
        model: 'Reader-X1',
        description: 'Main entrance card reader',
        status: 'ONLINE' as any,
        isActive: true,
        lastSeenAt: new Date(),
        lastSeen: new Date(),
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
                type: 'card_reader',
                deviceIdentifier: 'READER-001',
                branchId: 'branch-123',
                ipAddress: '192.168.1.100',
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
            expect(result).toEqual({
                id: mockDevice.id,
                organizationId: mockDevice.organizationId,
                branchId: mockDevice.branchId,
                name: mockDevice.name,
                type: mockDevice.type,
                deviceIdentifier: mockDevice.deviceIdentifier,
                ipAddress: mockDevice.ipAddress,
                description: mockDevice.description,
                isActive: mockDevice.isActive,
                lastSeen: mockDevice.lastSeen,
                createdAt: mockDevice.createdAt,
                updatedAt: mockDevice.updatedAt,
            });
        });
    });

    describe('getDevices', () => {
        it('should return paginated devices', async () => {
            const devices = [mockDevice];
            deviceService.getDevices.mockResolvedValue(devices);

            const result = await controller.getDevices(mockDataScope, { page: 1, limit: 10 });

            expect(deviceService.getDevices).toHaveBeenCalledWith(mockDataScope);
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
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

        it('should throw error when device not found', async () => {
            deviceService.getDeviceById.mockResolvedValue(null);

            await expect(controller.getDeviceById('nonexistent', mockDataScope)).rejects.toThrow(
                'Device not found'
            );
        });
    });

    describe('getDeviceByIdentifier', () => {
        it('should return a device by identifier', async () => {
            deviceService.getDeviceByIdentifier.mockResolvedValue(mockDevice);

            const result = await controller.getDeviceByIdentifier('READER-001', mockDataScope);

            expect(deviceService.getDeviceByIdentifier).toHaveBeenCalledWith(
                'READER-001',
                mockDataScope
            );
            expect(result.deviceIdentifier).toBe(mockDevice.deviceIdentifier);
        });

        it('should throw error when device not found by identifier', async () => {
            deviceService.getDeviceByIdentifier.mockResolvedValue(null);

            await expect(
                controller.getDeviceByIdentifier('NONEXISTENT', mockDataScope)
            ).rejects.toThrow('Device not found');
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
            expect(result.description).toBe('Updated description');
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

            const result = await controller.getDeviceWithStats('device-123', mockDataScope);

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
                status: 'healthy' as const,
                uptime: 86400,
                lastHealthCheck: new Date(),
            };

            deviceService.getDeviceHealth.mockResolvedValue(healthStatus);

            const result = await controller.getDeviceHealth('device-123', mockDataScope);

            expect(deviceService.getDeviceHealth).toHaveBeenCalledWith('device-123', mockDataScope);
            expect(result.status).toBe('healthy');
            expect(result.uptime).toBe(86400);
        });
    });

    describe('testDeviceConnection', () => {
        it('should test device connection successfully', async () => {
            const connectionResult = {
                deviceId: 'device-123',
                deviceName: 'Main Door Reader',
                connected: true,
                testedAt: new Date(),
            };

            deviceService.testDeviceConnection.mockResolvedValue(connectionResult);

            const result = await controller.testDeviceConnection('device-123', mockDataScope);

            expect(deviceService.testDeviceConnection).toHaveBeenCalledWith(
                'device-123',
                mockDataScope
            );
            expect(result.connected).toBe(true);
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

    describe('discoverDevices', () => {
        it('should discover new devices', async () => {
            const discoveryResult = {
                totalDiscovered: 3,
                newDevices: 1,
                existingDevices: 2,
                devices: [
                    {
                        identifier: 'NEW-DEVICE-001',
                        name: 'New Card Reader',
                        type: 'card_reader' as any,
                        ipAddress: '192.168.1.105',
                        status: 'online' as any,
                    },
                ],
            };

            deviceService.discoverDevices.mockResolvedValue(discoveryResult);

            const result = await controller.discoverDevices(mockDataScope);

            expect(deviceService.discoverDevices).toHaveBeenCalledWith(mockDataScope);
            expect(result.totalDiscovered).toBe(3);
            expect(result.newDevices).toBe(1);
            expect(result.devices).toHaveLength(1);
        });
    });
});
