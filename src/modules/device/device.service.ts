import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Device } from '@prisma/client';
import { DeviceRepository } from './device.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { DatabaseUtil } from '../../shared/utils';
import { CreateDeviceDto, UpdateDeviceDto } from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';
import { DeviceCommand, IDeviceAdapter } from '../../shared/adapters/device.adapter';

@Injectable()
export class DeviceService {
    constructor(
        private readonly deviceRepository: DeviceRepository,
        private readonly logger: LoggerService,
        @Inject('IDeviceAdapter') private readonly deviceAdapter: IDeviceAdapter
    ) {}

    /**
     * Create a new device
     */
    async createDevice(
        createDeviceDto: CreateDeviceDto,
        scope: DataScope,
        createdByUserId: string,
        correlationId?: string
    ): Promise<Device> {
        try {
            // Validate that the branch is accessible within the scope
            if (scope.branchIds && !scope.branchIds.includes(createDeviceDto.branchId)) {
                throw new BadRequestException('Branch not accessible within your scope');
            }

            // Check if device with same MAC address already exists (if provided)
            if (createDeviceDto.macAddress) {
                const existingDevice = await this.deviceRepository.findByMacAddress(
                    createDeviceDto.macAddress,
                    scope
                );

                if (existingDevice) {
                    throw new ConflictException('Device with this MAC address already exists');
                }
            }

            const device = await this.deviceRepository.create(createDeviceDto, scope);

            this.logger.logUserAction(
                createdByUserId,
                'DEVICE_CREATED',
                {
                    deviceId: device.id,
                    deviceName: device.name,
                    deviceType: device.type,
                    branchId: device.branchId,
                    macAddress: device.macAddress,
                },
                scope.organizationId,
                correlationId
            );

            return device;
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                const fields = DatabaseUtil.getUniqueConstraintFields(error);
                throw new ConflictException(`Device with this ${fields.join(', ')} already exists`);
            }
            throw error;
        }
    }

    /**
     * Get all devices (scoped to managed branches)
     */
    async getDevices(scope: DataScope): Promise<Device[]> {
        return this.deviceRepository.findMany({}, scope);
    }

    /**
     * Get devices by branch
     */
    async getDevicesByBranch(branchId: string, scope: DataScope): Promise<Device[]> {
        // Validate branch access
        if (scope.branchIds && !scope.branchIds.includes(branchId)) {
            throw new BadRequestException('Branch not accessible within your scope');
        }

        return this.deviceRepository.findByBranch(branchId, scope);
    }

    /**
     * Get device by ID
     */
    async getDeviceById(id: string, scope: DataScope): Promise<Device | null> {
        return this.deviceRepository.findById(id, scope);
    }

    /**
     * Get device by MAC address
     */
    async getDeviceByMacAddress(macAddress: string, scope: DataScope): Promise<Device | null> {
        return this.deviceRepository.findByMacAddress(macAddress, scope);
    }

    /**
     * Get device by identifier
     */
    async getDeviceByIdentifier(identifier: string, scope: DataScope): Promise<Device | null> {
        return this.deviceRepository.findByDeviceIdentifier(identifier, scope);
    }

    /**
     * Update device
     */
    async updateDevice(
        id: string,
        updateDeviceDto: UpdateDeviceDto,
        scope: DataScope,
        updatedByUserId: string,
        correlationId?: string
    ): Promise<Device> {
        try {
            const existingDevice = await this.deviceRepository.findById(id, scope);
            if (!existingDevice) {
                throw new NotFoundException('Device not found');
            }

            // Validate branch access if changing branch
            if (
                updateDeviceDto.branchId &&
                scope.branchIds &&
                !scope.branchIds.includes(updateDeviceDto.branchId)
            ) {
                throw new BadRequestException('Target branch not accessible within your scope');
            }

            // Check MAC address uniqueness if being updated
            if (
                updateDeviceDto.macAddress &&
                updateDeviceDto.macAddress !== existingDevice.macAddress
            ) {
                const existingByMacAddress = await this.deviceRepository.findByMacAddress(
                    updateDeviceDto.macAddress,
                    scope
                );

                if (existingByMacAddress && existingByMacAddress.id !== id) {
                    throw new ConflictException('Device with this MAC address already exists');
                }
            }

            const updatedDevice = await this.deviceRepository.update(id, updateDeviceDto, scope);

            this.logger.logUserAction(
                updatedByUserId,
                'DEVICE_UPDATED',
                {
                    deviceId: id,
                    changes: updateDeviceDto,
                    oldName: existingDevice.name,
                    newName: updatedDevice.name,
                    oldMacAddress: existingDevice.macAddress,
                    newMacAddress: updatedDevice.macAddress,
                },
                scope.organizationId,
                correlationId
            );

            return updatedDevice;
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                const fields = DatabaseUtil.getUniqueConstraintFields(error);
                throw new ConflictException(`Device with this ${fields.join(', ')} already exists`);
            }
            throw error;
        }
    }

    /**
     * Delete device
     */
    async deleteDevice(
        id: string,
        scope: DataScope,
        deletedByUserId: string,
        correlationId?: string
    ): Promise<void> {
        const existingDevice = await this.deviceRepository.findById(id, scope);
        if (!existingDevice) {
            throw new NotFoundException('Device not found');
        }

        await this.deviceRepository.delete(id, scope);

        this.logger.logUserAction(
            deletedByUserId,
            'DEVICE_DELETED',
            {
                deviceId: id,
                deviceName: existingDevice.name,
                macAddress: existingDevice.macAddress,
                branchId: existingDevice.branchId,
            },
            scope.organizationId,
            correlationId
        );
    }

    /**
     * Search devices
     */
    async searchDevices(searchTerm: string, scope: DataScope): Promise<Device[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        return this.deviceRepository.searchDevices(searchTerm.trim(), scope);
    }

    /**
     * Get device count
     */
    async getDeviceCount(scope: DataScope): Promise<number> {
        return this.deviceRepository.count({}, scope);
    }

    /**
     * Get device count by branch
     */
    async getDeviceCountByBranch(branchId: string, scope: DataScope): Promise<number> {
        // Validate branch access
        if (scope.branchIds && !scope.branchIds.includes(branchId)) {
            throw new BadRequestException('Branch not accessible within your scope');
        }

        return this.deviceRepository.count({ branchId }, scope);
    }

    /**
     * Activate/Deactivate device
     */
    async toggleDeviceStatus(
        id: string,
        isActive: boolean,
        scope: DataScope,
        updatedByUserId: string,
        correlationId?: string
    ): Promise<Device> {
        const existingDevice = await this.deviceRepository.findById(id, scope);
        if (!existingDevice) {
            throw new NotFoundException('Device not found');
        }

        const updatedDevice = await this.deviceRepository.update(id, { isActive }, scope);

        this.logger.logUserAction(
            updatedByUserId,
            isActive ? 'DEVICE_ACTIVATED' : 'DEVICE_DEACTIVATED',
            {
                deviceId: id,
                deviceName: existingDevice.name,
                deviceIdentifier: existingDevice.deviceIdentifier,
                previousStatus: existingDevice.isActive,
                newStatus: isActive,
            },
            scope.organizationId,
            correlationId
        );

        return updatedDevice;
    }

    /**
     * Get device with statistics
     */
    async getDeviceWithStats(id: string, scope: DataScope) {
        const deviceWithStats = await this.deviceRepository.findWithStats(id, scope);

        if (!deviceWithStats) {
            throw new NotFoundException('Device not found');
        }

        return {
            id: deviceWithStats.id,
            branchId: deviceWithStats.branchId,
            name: deviceWithStats.name,
            type: deviceWithStats.type,
            deviceIdentifier: deviceWithStats.deviceIdentifier,
            ipAddress: deviceWithStats.ipAddress,
            isActive: deviceWithStats.isActive,
            lastSeen: deviceWithStats.lastSeen,
            createdAt: deviceWithStats.createdAt,
            updatedAt: deviceWithStats.updatedAt,
            statistics: {
                totalEvents: deviceWithStats._count?.events || 0,
            },
        };
    }

    /**
     * Send command to device
     */
    async sendDeviceCommand(
        id: string,
        command: DeviceCommand,
        scope: DataScope,
        commandByUserId: string,
        correlationId?: string
    ) {
        const device = await this.deviceRepository.findById(id, scope);
        if (!device) {
            throw new NotFoundException('Device not found');
        }

        if (!device.isActive) {
            throw new BadRequestException('Cannot send command to inactive device');
        }

        try {
            const result = await this.deviceAdapter.sendCommand(device.deviceIdentifier, command);

            this.logger.logUserAction(
                commandByUserId,
                'DEVICE_COMMAND_SENT',
                {
                    deviceId: id,
                    deviceName: device.name,
                    command: command.command,
                    success: result.success,
                    message: result.message,
                },
                scope.organizationId,
                correlationId
            );

            return result;
        } catch (error) {
            this.logger.logUserAction(
                commandByUserId,
                'DEVICE_COMMAND_FAILED',
                {
                    deviceId: id,
                    deviceName: device.name,
                    command: command.command,
                    error: error.message,
                },
                scope.organizationId,
                correlationId
            );

            throw error;
        }
    }

    /**
     * Get device health status
     */
    async getDeviceHealth(id: string, scope: DataScope) {
        const device = await this.deviceRepository.findById(id, scope);
        if (!device) {
            throw new NotFoundException('Device not found');
        }

        try {
            const health = await this.deviceAdapter.getDeviceHealth(device.deviceIdentifier);
            return health;
        } catch (error) {
            this.logger.error(`Failed to get device health for ${device.name}`, error, {
                deviceId: id,
                deviceIdentifier: device.deviceIdentifier,
            });

            return {
                deviceId: device.deviceIdentifier,
                status: 'critical' as const,
                uptime: 0,
                lastHealthCheck: new Date(),
                issues: ['Unable to connect to device'],
            };
        }
    }

    /**
     * Test device connection
     */
    async testDeviceConnection(id: string, scope: DataScope) {
        const device = await this.deviceRepository.findById(id, scope);
        if (!device) {
            throw new NotFoundException('Device not found');
        }

        try {
            const isConnected = await this.deviceAdapter.testConnection(device.deviceIdentifier);

            // Update last seen if connection is successful
            if (isConnected) {
                await this.deviceRepository.update(id, { lastSeen: new Date() }, scope);
            }

            return {
                deviceId: id,
                deviceName: device.name,
                connected: isConnected,
                testedAt: new Date(),
            };
        } catch (error) {
            this.logger.error(`Device connection test failed for ${device.name}`, error, {
                deviceId: id,
                deviceIdentifier: device.deviceIdentifier,
            });

            return {
                deviceId: id,
                deviceName: device.name,
                connected: false,
                testedAt: new Date(),
                error: error.message,
            };
        }
    }

    /**
     * Discover new devices
     */
    async discoverDevices(scope: DataScope) {
        try {
            const discoveredDevices = await this.deviceAdapter.discoverDevices();

            // Filter out devices that are already registered
            const existingIdentifiers = await this.deviceRepository.getAllIdentifiers(scope);
            const newDevices = discoveredDevices.filter(
                device => !existingIdentifiers.includes(device.id)
            );

            return {
                totalDiscovered: discoveredDevices.length,
                newDevices: newDevices.length,
                existingDevices: discoveredDevices.length - newDevices.length,
                devices: newDevices.map(device => ({
                    identifier: device.id,
                    name: device.name,
                    type: device.type,
                    ipAddress: device.ipAddress,
                    status: device.status,
                })),
            };
        } catch (error) {
            this.logger.error('Device discovery failed', error);
            throw new BadRequestException('Failed to discover devices');
        }
    }
}
