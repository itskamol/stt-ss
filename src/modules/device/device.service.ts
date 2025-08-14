import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Device, DeviceProtocol } from '@prisma/client';
import { DeviceRepository } from './device.repository';
import { DeviceConfigurationService } from './device-configuration.service';
import { EmployeeSyncService } from './employee-sync.service';
import { DeviceAdapterStrategy } from './device-adapter.strategy';
import { LoggerService } from '@/core/logger';
import { DatabaseUtil } from '@/shared/utils';
import {
    CreateDeviceConfigurationDto,
    CreateDeviceDto,
    CreateDeviceTemplateDto,
    DeviceControlDto,
    DeviceSyncEmployeesDto,
    UpdateDeviceConfigurationDto,
    UpdateDeviceDto,
    UpdateDeviceTemplateDto,
} from '@/shared/dto';
import { DataScope } from '@/shared/interfaces';
import { EncryptionService } from '@/shared/services/encryption.service';
import { DeviceCommand } from '@/modules/integrations/adapters';

@Injectable()
export class DeviceService {
    constructor(
        private readonly deviceRepository: DeviceRepository,
        private readonly deviceConfigurationService: DeviceConfigurationService,
        private readonly employeeSyncService: EmployeeSyncService,
        private readonly deviceAdapterStrategy: DeviceAdapterStrategy,
        private readonly logger: LoggerService,
        private readonly encryptionService: EncryptionService
    ) {}

    /**
     * Auto-discover device information from connection details
     */
    async discoverDeviceInfo(connectionDetails: {
        host: string;
        port: number;
        username: string;
        password: string;
        brand: string;
        protocol?: DeviceProtocol;
    }) {
        try {
            this.logger.debug('Starting device auto-discovery', {
                host: connectionDetails.host,
                port: connectionDetails.port,
            });

            // Create temporary device config for discovery
            const tempDeviceConfig = {
                type: 'ACCESS_CONTROL' as any,
                protocol: connectionDetails.protocol || 'HTTP',
                host: connectionDetails.host,
                port: connectionDetails.port,
                username: connectionDetails.username,
                password: connectionDetails.password,
                brand: connectionDetails.brand,
            };

            // Try to get device information using adapter
            const deviceInfo =
                await this.deviceAdapterStrategy.getDeviceInfoByConfig(tempDeviceConfig);

            // Extract device details
            const discoveredInfo = {
                manufacturer: this.extractManufacturer(deviceInfo),
                model: deviceInfo.name || 'Unknown Model',
                firmware: deviceInfo.firmwareVersion || 'Unknown',
                macAddress: this.extractMacAddress(deviceInfo),
                deviceIdentifier: deviceInfo.id || `${connectionDetails.host}_${Date.now()}`,
                capabilities: deviceInfo.capabilities || [],
                status: deviceInfo.status || 'UNKNOWN',
            };

            this.logger.debug('Device auto-discovery completed', {
                host: connectionDetails.host,
                discoveredInfo,
            });

            return discoveredInfo;
        } catch (error) {
            this.logger.warn('Device auto-discovery failed, using defaults', {
                host: connectionDetails.host,
                error: error.message,
            });

            // Return default values if discovery fails
            return {
                manufacturer: 'Unknown',
                model: 'Unknown Model',
                firmware: 'Unknown',
                macAddress: null,
                deviceIdentifier: `${connectionDetails.host}_${Date.now()}`,
                capabilities: [],
                status: 'UNKNOWN',
            };
        }
    }

    /**
     * Extract manufacturer from device info
     */
    private extractManufacturer(deviceInfo: any): string {
        const name = (deviceInfo.name || '').toLowerCase();
        const type = (deviceInfo.type || '').toLowerCase();

        if (name.includes('hikvision') || type.includes('hikvision')) {
            return 'Hikvision';
        }
        if (name.includes('zkteco') || type.includes('zkteco')) {
            return 'ZKTeco';
        }
        if (name.includes('dahua') || type.includes('dahua')) {
            return 'Dahua';
        }
        if (name.includes('suprema') || type.includes('suprema')) {
            return 'Suprema';
        }
        if (name.includes('anviz') || type.includes('anviz')) {
            return 'Anviz';
        }

        return 'Unknown';
    }

    /**
     * Extract MAC address from device info
     */
    private extractMacAddress(deviceInfo: any): string | null {
        // Try to extract MAC address from various possible fields
        if (deviceInfo.macAddress) {
            return deviceInfo.macAddress;
        }
        if (deviceInfo.networkInfo?.macAddress) {
            return deviceInfo.networkInfo.macAddress;
        }
        if (deviceInfo.hardware?.macAddress) {
            return deviceInfo.hardware.macAddress;
        }

        return null;
    }

    /**
     * Create a new device with auto-discovery
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

            // Auto-discover device information if not provided
            let deviceData = { ...createDeviceDto };

            if (!deviceData.manufacturer || !deviceData.model || !deviceData.firmware) {
                this.logger.debug('Auto-discovering device information', {
                    host: deviceData.host,
                    port: deviceData.port,
                });

                const discoveredInfo = await this.discoverDeviceInfo({
                    host: deviceData.host,
                    port: deviceData.port,
                    username: deviceData.username,
                    password: deviceData.password,
                    protocol: deviceData.protocol,
                    brand:deviceData.manufacturer
                });

                // Fill in missing information with discovered data
                deviceData = {
                    ...deviceData,
                    manufacturer: deviceData.manufacturer || discoveredInfo.manufacturer,
                    model: deviceData.model || discoveredInfo.model,
                    firmware: deviceData.firmware || discoveredInfo.firmware,
                    macAddress: deviceData.macAddress || discoveredInfo.macAddress,
                    deviceIdentifier:
                        deviceData.deviceIdentifier || discoveredInfo.deviceIdentifier,
                };

                this.logger.debug('Device information auto-filled', {
                    original: createDeviceDto,
                    enhanced: deviceData,
                });
            }

            // Check if device with same MAC address already exists (if provided)
            if (deviceData.macAddress) {
                const existingDevice = await this.deviceRepository.findByMacAddress(
                    deviceData.macAddress,
                    scope
                );

                if (existingDevice) {
                    throw new ConflictException('Device with this MAC address already exists');
                }
            }

            // Check if device identifier already exists
            if (deviceData.deviceIdentifier) {
                const existingByIdentifier = await this.deviceRepository.findByDeviceIdentifier(
                    deviceData.deviceIdentifier,
                    scope
                );

                if (existingByIdentifier) {
                    // Generate a unique identifier if the discovered one already exists
                    deviceData.deviceIdentifier = `${deviceData.host}_${Date.now()}`;
                }
            }

            deviceData.password = this.encryptionService.encrypt(deviceData.password);

            const device = await this.deviceRepository.create(deviceData, scope);

            this.logger.logUserAction(createdByUserId, 'DEVICE_CREATED', {
                deviceId: device.id,
                deviceName: device.name,
                deviceType: device.type,
                branchId: device.branchId,
                macAddress: device.macAddress,
                manufacturer: device.manufacturer,
                model: device.model,
                autoDiscovered: !createDeviceDto.manufacturer || !createDeviceDto.model,
                organizationId: scope.organizationId,
                correlationId,
            });

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
     * Create device with minimal information (auto-discovery enabled)
     */
    async createDeviceWithAutoDiscovery(
        basicInfo: {
            name: string;
            host: string;
            port: number;
            username: string;
            password: string;
            branchId: string;
            organizationId: string;
            departmentId?: string;
            protocol?: string;
            description?: string;
        },
        scope: DataScope,
        createdByUserId: string,
        correlationId?: string
    ): Promise<Device> {
        this.logger.debug('Creating device with auto-discovery', {
            name: basicInfo.name,
            host: basicInfo.host,
            port: basicInfo.port,
        });

        // Discover device information
        const discoveredInfo = await this.discoverDeviceInfo({
            host: basicInfo.host,
            port: basicInfo.port,
            username: basicInfo.username,
            password: basicInfo.password,
            protocol: basicInfo.protocol as DeviceProtocol,
            brand: 'unknown'
        });

        // Create full device DTO with discovered information
        const createDeviceDto: CreateDeviceDto = {
            name: basicInfo.name,
            type: 'ACCESS_CONTROL' as any,
            deviceIdentifier: discoveredInfo.deviceIdentifier,
            host: basicInfo.host,
            username: basicInfo.username,
            password: basicInfo.password,
            port: basicInfo.port,
            protocol: (basicInfo.protocol as DeviceProtocol) || DeviceProtocol.HTTP,
            macAddress: discoveredInfo.macAddress,
            manufacturer: discoveredInfo.manufacturer,
            model: discoveredInfo.model,
            firmware: discoveredInfo.firmware,
            description:
                basicInfo.description || `Auto-discovered ${discoveredInfo.manufacturer} device`,
            branchId: basicInfo.branchId,
            isActive: true,
            timeout: 5000,
            retryAttempts: 3,
            keepAlive: true,
        };

        return this.createDevice(createDeviceDto, scope, createdByUserId, correlationId);
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

            if (updateDeviceDto.password) {
                updateDeviceDto.password = this.encryptionService.encrypt(updateDeviceDto.password);
            }

            const updatedDevice = await this.deviceRepository.update(id, updateDeviceDto, scope);

            this.logger.logUserAction(updatedByUserId, 'DEVICE_UPDATED', {
                deviceId: id,
                changes: updateDeviceDto,
                oldName: existingDevice.name,
                newName: updatedDevice.name,
                oldMacAddress: existingDevice.macAddress,
                newMacAddress: updatedDevice.macAddress,
                organizationId: scope.organizationId,
                correlationId,
            });

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

        this.logger.logUserAction(deletedByUserId, 'DEVICE_DELETED', {
            deviceId: id,
            deviceName: existingDevice.name,
            macAddress: existingDevice.macAddress,
            branchId: existingDevice.branchId,
            organizationId: scope.organizationId,
            correlationId,
        });
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
                organizationId: scope.organizationId,
                correlationId,
            }
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
            host: deviceWithStats.host,
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
            const result = await this.deviceAdapterStrategy.executeCommand(device, command);

            this.logger.logUserAction(commandByUserId, 'DEVICE_COMMAND_SENT', {
                deviceId: id,
                deviceName: device.name,
                command: command.command,
                success: result.success,
                message: result.message,
                organizationId: scope.organizationId,
                correlationId,
            });

            return result;
        } catch (error) {
            this.logger.logUserAction(commandByUserId, 'DEVICE_COMMAND_FAILED', {
                deviceId: id,
                deviceName: device.name,
                command: command.command,
                error: error.message,
                organizationId: scope.organizationId,
                correlationId,
            });

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
            const health = await this.deviceAdapterStrategy.getDeviceHealth(device);
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
            const isConnected = await this.deviceAdapterStrategy.testConnection(device);

            // Update last seen if connection is successful
            if (isConnected) {
                await this.deviceRepository.update(id, { lastSeen: new Date() }, scope);
            }

            return {
                success: isConnected,
                message: "Connected",
            };
        } catch (error) {
            this.logger.error(`Device connection test failed for ${device.name}`, error, {
                deviceId: id,
                deviceIdentifier: device.deviceIdentifier,
            });

            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Discover new devices
     */
    async discoverDevices(scope: DataScope) {
        try {
            const discoveredDevices = await this.deviceAdapterStrategy.discoverDevices();

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
                    host: device.host,
                    status: device.status,
                })),
            };
        } catch (error) {
            this.logger.error('Device discovery failed', error);
            throw new BadRequestException('Failed to discover devices');
        }
    }

    /**
     * Control device actions (open door, reboot, etc.)
     */
    async controlDevice(
        id: string,
        controlDto: DeviceControlDto,
        scope: DataScope,
        controlledByUserId: string,
        correlationId?: string
    ) {
        const device = await this.deviceRepository.findById(id, scope);
        if (!device) {
            throw new NotFoundException('Device not found');
        }

        if (!device.isActive) {
            throw new BadRequestException('Cannot control inactive device');
        }

        try {
            const result = await this.deviceAdapterStrategy.executeCommand(device, {
                command: controlDto.action as any,
                parameters: controlDto.parameters,
                timeout: controlDto.timeout,
            });

            this.logger.logUserAction(controlledByUserId, 'DEVICE_CONTROL_ACTION', {
                deviceId: id,
                deviceName: device.name,
                action: controlDto.action,
                parameters: controlDto.parameters,
                success: result.success,
                message: result.message,
                organizationId: scope.organizationId,
                correlationId,
            });

            return result;
        } catch (error) {
            this.logger.logUserAction(controlledByUserId, 'DEVICE_CONTROL_FAILED', {
                deviceId: id,
                deviceName: device.name,
                action: controlDto.action,
                error: error.message,
                organizationId: scope.organizationId,
                correlationId,
            });

            throw error;
        }
    }

    /**
     * Sync employees to device
     */
    async syncEmployeesToDevice(
        id: string,
        syncDto: DeviceSyncEmployeesDto,
        scope: DataScope,
        syncedByUserId: string,
        correlationId?: string
    ) {
        return this.employeeSyncService.syncEmployeesToDevice(
            id,
            syncDto,
            scope,
            syncedByUserId,
            correlationId
        );
    }

    /**
     * Get device configuration
     */
    async getDeviceConfiguration(id: string, scope: DataScope) {
        const device = await this.deviceRepository.findById(id, scope);
        if (!device) {
            throw new NotFoundException('Device not found');
        }

        return this.deviceConfigurationService.getConfiguration(id, scope);
    }

    /**
     * Create device configuration
     */
    async createDeviceConfiguration(
        id: string,
        configData: CreateDeviceConfigurationDto,
        scope: DataScope,
        createdByUserId: string,
        correlationId?: string
    ) {
        const device = await this.deviceRepository.findById(id, scope);
        if (!device) {
            throw new NotFoundException('Device not found');
        }

        return this.deviceConfigurationService.createConfiguration(
            configData,
            id,
            scope,
            createdByUserId,
            correlationId
        );
    }

    /**
     * Update device configuration
     */
    async updateDeviceConfiguration(
        id: string,
        configData: UpdateDeviceConfigurationDto,
        scope: DataScope,
        updatedByUserId: string,
        correlationId?: string
    ) {
        const device = await this.deviceRepository.findById(id, scope);
        if (!device) {
            throw new NotFoundException('Device not found');
        }

        return this.deviceConfigurationService.updateConfiguration(
            id,
            configData,
            scope,
            updatedByUserId,
            correlationId
        );
    }

    /**
     * Delete device configuration
     */
    async deleteDeviceConfiguration(
        id: string,
        scope: DataScope,
        deletedByUserId: string,
        correlationId?: string
    ) {
        const device = await this.deviceRepository.findById(id, scope);
        if (!device) {
            throw new NotFoundException('Device not found');
        }

        return this.deviceConfigurationService.deleteConfiguration(
            id,
            scope,
            deletedByUserId,
            correlationId
        );
    }

    /**
     * Get employee sync status for device
     */
    async getEmployeeSyncStatus(id: string, scope: DataScope) {
        return this.employeeSyncService.getSyncStatus(id, scope);
    }

    /**
     * Retry failed syncs for device
     */
    async retryFailedSyncs(id: string, scope: DataScope, retriedByUserId: string) {
        return this.employeeSyncService.retryFailedSyncs(id, scope, retriedByUserId);
    }

    /**
     * Get employee sync history
     */
    async getEmployeeSyncHistory(employeeId: string, scope: DataScope) {
        return this.employeeSyncService.getEmployeeSyncHistory(employeeId, scope);
    }

    /**
     * Create device template
     */
    async createDeviceTemplate(
        templateData: CreateDeviceTemplateDto,
        scope: DataScope,
        createdByUserId: string,
        correlationId?: string
    ) {
        return this.deviceConfigurationService.createTemplate(
            templateData,
            scope,
            createdByUserId,
            correlationId
        );
    }

    /**
     * Get device templates
     */
    async getDeviceTemplates(scope: DataScope) {
        return this.deviceConfigurationService.getTemplates(scope);
    }

    /**
     * Get device template by ID
     */
    async getDeviceTemplateById(id: string, scope: DataScope) {
        return this.deviceConfigurationService.getTemplateById(id, scope);
    }

    /**
     * Update device template
     */
    async updateDeviceTemplate(
        id: string,
        templateData: UpdateDeviceTemplateDto,
        scope: DataScope,
        updatedByUserId: string,
        correlationId?: string
    ) {
        return this.deviceConfigurationService.updateTemplate(
            id,
            templateData,
            scope,
            updatedByUserId,
            correlationId
        );
    }

    /**
     * Delete device template
     */
    async deleteDeviceTemplate(
        id: string,
        scope: DataScope,
        deletedByUserId: string,
        correlationId?: string
    ) {
        return this.deviceConfigurationService.deleteTemplate(
            id,
            scope,
            deletedByUserId,
            correlationId
        );
    }

    /**
     * Apply template to device
     */
    async applyTemplateToDevice(
        templateId: string,
        deviceId: string,
        scope: DataScope,
        appliedByUserId: string,
        correlationId?: string
    ) {
        return this.deviceConfigurationService.applyTemplateToDevice(
            templateId,
            deviceId,
            scope,
            appliedByUserId,
            correlationId
        );
    }
}
