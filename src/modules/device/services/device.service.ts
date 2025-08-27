import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Device, DeviceConfiguration, DeviceStatus, CredentialType } from '@prisma/client';
import {
    CreateDeviceConfigurationDto,
    CreateDeviceDto,
    DeviceControlDto,
    DeviceSyncEmployeesDto,
    PaginationDto,
    UpdateDeviceConfigurationDto,
    UpdateDeviceDto,
} from '@/shared/dto';
import { DataScope } from '@/shared/interfaces';
import { EncryptionService } from '@/shared/services/encryption.service';
import { DeviceCommand } from '@/modules/integrations/adapters';
import { LoggerService } from '@/core/logger';
import { DeviceRepository } from '../device.repository';
import { DeviceConfigurationService } from './device-configuration.service';
import { EmployeeSyncService } from './employee-sync.service';
import { DeviceAdapterStrategy } from '../device-adapter.strategy';
import { DeviceDiscoveryService } from './device-discovery.service';
import { DeviceTemplateService } from './device-template.service';
import { DeviceWebhookService } from './device-webhook.service';

@Injectable()
export class DeviceService {
    constructor(
        private readonly deviceRepository: DeviceRepository,
        private readonly deviceConfigurationService: DeviceConfigurationService,
        private readonly employeeSyncService: EmployeeSyncService,
        private readonly deviceAdapterStrategy: DeviceAdapterStrategy,
        private readonly encryptionService: EncryptionService,
        private readonly logger: LoggerService,
        private readonly deviceDiscoveryService: DeviceDiscoveryService,
        private readonly deviceTemplateService: DeviceTemplateService,
        private readonly deviceWebhookService: DeviceWebhookService
    ) {}

    // Device Discovery Service Methods
    async discoverDeviceInfo(connectionDetails: {
        host: string;
        port: number;
        username: string;
        password: string;
        protocol: string;
        deviceType: string;
    }) {
        return this.deviceDiscoveryService.discoverDeviceInfo(connectionDetails);
    }

    async scanDeviceForCreationInternal(deviceCreationDto: any, scope: DataScope) {
        return this.deviceDiscoveryService.scanDeviceForCreationInternal(deviceCreationDto, scope);
    }

    // Device Template Service Methods
    async createDeviceTemplate(createDto: any, scope: DataScope) {
        return this.deviceTemplateService.createDeviceTemplate(createDto, scope);
    }

    async getDeviceTemplates(scope: DataScope) {
        return this.deviceTemplateService.getDeviceTemplates(scope);
    }

    async getDeviceTemplateById(id: string, scope: DataScope) {
        return this.deviceTemplateService.getDeviceTemplateById(id, scope);
    }

    async updateDeviceTemplate(id: string, updateDto: any, scope: DataScope) {
        return this.deviceTemplateService.updateDeviceTemplate(id, updateDto, scope);
    }

    async deleteDeviceTemplate(id: string, scope: DataScope, deletedByUserId: string) {
        return this.deviceTemplateService.deleteDeviceTemplate(id, scope, deletedByUserId);
    }

    async applyTemplateToDevice(templateId: string, deviceId: string, scope: DataScope) {
        return this.deviceTemplateService.applyTemplateToDevice(templateId, deviceId, scope);
    }

    async autoApplyTemplateToDevice(deviceId: string, scope: DataScope, appliedByUserId: string) {
        return this.deviceTemplateService.autoApplyTemplateToDevice(
            deviceId,
            scope,
            appliedByUserId
        );
    }

    async getSuggestedTemplates(deviceId: string, scope: DataScope) {
        return this.deviceTemplateService.getSuggestedTemplates(deviceId, scope);
    }

    async autoApplyMatchingTemplate(device: any, scope: DataScope) {
        return this.deviceTemplateService.autoApplyMatchingTemplate(device, scope);
    }

    // Device Webhook Service Methods
    async configureWebhook(deviceId: string, webhookDto: any, scope: DataScope) {
        return this.deviceWebhookService.configureWebhook(deviceId, webhookDto, scope);
    }

    async removeWebhook(id: string, hostId: string, scope: DataScope, removedByUserId: string) {
        return this.deviceWebhookService.removeWebhook(id, hostId, scope, removedByUserId);
    }

    async testWebhook(id: string, hostId: string, scope: DataScope, testedByUserId: string) {
        return this.deviceWebhookService.testWebhook(id, hostId, scope, testedByUserId);
    }

    async createDevice(createDto: CreateDeviceDto, scope: DataScope): Promise<Device> {
        try {
            await this.validateBranchAccess(createDto.branchId, scope);

            const existingDevice = await this.deviceRepository.findBySerialNumber(
                createDto.serialNumber,
                scope
            );

            if (existingDevice) {
                throw new ConflictException(
                    `Device with serial number '${createDto.serialNumber}' already exists`
                );
            }

            const encryptedPassword = createDto.password
                ? this.encryptionService.encrypt(createDto.password)
                : null;

            const data: CreateDeviceDto = {
                name: createDto.name,
                port: createDto.port,
                protocol: createDto.protocol,
                type: createDto.type,
                username: createDto.username,
                branchId: createDto.branchId,
                macAddress: createDto.macAddress,
                manufacturer: createDto.manufacturer,
                serialNumber: createDto.serialNumber,
                model: createDto.model,
                host: createDto.host,
                description: createDto.description,
                isActive: createDto.isActive !== undefined ? createDto.isActive : true,
                status: createDto.status,
                password: encryptedPassword,
                lastSeen: createDto.status === DeviceStatus.ONLINE ? new Date() : null,
            };

            const device = await this.deviceRepository.create({
                ...data,
                organizationId: scope.organizationId,
            });

            return device;
        } catch (error) {
            throw error;
        }
    }

    async getDevices(
        paginationDto: PaginationDto,
        scope: DataScope
    ): Promise<{ data: Device[]; total: number }> {
        const correlationId = `device_list_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        try {
            this.logger.log('Fetching devices', {
                module: 'DeviceService',
                action: 'getDevices',
                correlationId,
                pagination: paginationDto,
                scope,
            });

            const [data, total] = await Promise.all([
                this.deviceRepository.findMany(scope, paginationDto),
                this.deviceRepository.count(scope),
            ]);

            this.logger.log('Devices fetched successfully', {
                module: 'DeviceService',
                action: 'getDevices',
                correlationId,
                deviceCount: data.length,
                totalCount: total,
            });

            return { data, total: total };
        } catch (error) {
            this.logger.error('Failed to fetch devices', error.stack, {
                module: 'DeviceService',
                action: 'getDevices',
                correlationId,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getDevicesByBranch(branchId: string, scope: DataScope): Promise<Device[]> {
        const correlationId = `device_branch_list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Fetching devices by branch', {
                module: 'DeviceService',
                action: 'getDevicesByBranch',
                correlationId,
                branchId,
                scope,
            });

            await this.validateBranchAccess(branchId, scope);

            const devices = await this.deviceRepository.findByBranch(branchId, scope);

            this.logger.log('Devices by branch fetched successfully', {
                module: 'DeviceService',
                action: 'getDevicesByBranch',
                correlationId,
                branchId,
                deviceCount: devices.length,
            });

            return devices;
        } catch (error) {
            this.logger.error('Failed to fetch devices by branch', error.stack, {
                module: 'DeviceService',
                action: 'getDevicesByBranch',
                correlationId,
                branchId,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getDeviceById(id: string, scope: DataScope): Promise<Device> {
        const correlationId = `device_get_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Fetching device by ID', {
                module: 'DeviceService',
                action: 'getDeviceById',
                correlationId,
                deviceId: id,
                scope,
            });

            const device = await this.validateDeviceAccess(id, scope);

            this.logger.log('Device fetched successfully', {
                module: 'DeviceService',
                action: 'getDeviceById',
                correlationId,
                deviceId: id,
                deviceName: device.name,
            });

            return device;
        } catch (error) {
            this.logger.error('Failed to fetch device', error.stack, {
                module: 'DeviceService',
                action: 'getDeviceById',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getDeviceByMacAddress(macAddress: string, scope: DataScope): Promise<Device> {
        const correlationId = `device_mac_get_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Fetching device by MAC address', {
                module: 'DeviceService',
                action: 'getDeviceByMacAddress',
                correlationId,
                macAddress,
                scope,
            });

            const device = await this.deviceRepository.findByMacAddress(macAddress, scope);

            if (!device) {
                throw new NotFoundException(`Device with MAC address '${macAddress}' not found`);
            }

            this.logger.log('Device fetched successfully by MAC address', {
                module: 'DeviceService',
                action: 'getDeviceByMacAddress',
                correlationId,
                deviceId: device.id,
                macAddress,
                deviceName: device.name,
            });

            return device;
        } catch (error) {
            this.logger.error('Failed to fetch device by MAC address', error.stack, {
                module: 'DeviceService',
                action: 'getDeviceByMacAddress',
                correlationId,
                macAddress,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getDeviceBySerialNumber(serialNumber: string, scope: DataScope): Promise<Device | null> {
        const correlationId = `device_serial_get_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Fetching device by serial number', {
                module: 'DeviceService',
                action: 'getDeviceBySerialNumber',
                correlationId,
                serialNumber,
                scope,
            });

            const device = await this.deviceRepository.findBySerialNumber(serialNumber, scope);

            if (device) {
                this.logger.log('Device fetched successfully by serial number', {
                    module: 'DeviceService',
                    action: 'getDeviceBySerialNumber',
                    correlationId,
                    deviceId: device.id,
                    serialNumber,
                    deviceName: device.name,
                });
            } else {
                this.logger.log('Device not found by serial number', {
                    module: 'DeviceService',
                    action: 'getDeviceBySerialNumber',
                    correlationId,
                    serialNumber,
                });
            }

            return device;
        } catch (error) {
            this.logger.error('Failed to fetch device by serial number', error.stack, {
                module: 'DeviceService',
                action: 'getDeviceBySerialNumber',
                correlationId,
                serialNumber,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async updateDevice(id: string, updateDto: UpdateDeviceDto, scope: DataScope): Promise<Device> {
        const correlationId = `device_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Updating device', {
                module: 'DeviceService',
                action: 'updateDevice',
                correlationId,
                deviceId: id,
                scope,
            });

            const device = await this.validateDeviceAccess(id, scope);

            if (updateDto.branchId) {
                await this.validateBranchAccess(updateDto.branchId, scope);
            }

            const updateData: any = { ...updateDto };

            if (updateDto.password) {
                updateData.password = await this.encryptionService.encrypt(updateDto.password);
            }

            const updatedDevice = await this.deviceRepository.update(id, updateData);

            this.logger.log('Device updated successfully', {
                module: 'DeviceService',
                action: 'updateDevice',
                correlationId,
                deviceId: id,
                deviceName: updatedDevice.name,
            });

            return updatedDevice;
        } catch (error) {
            this.logger.error('Failed to update device', error.stack, {
                module: 'DeviceService',
                action: 'updateDevice',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async deleteDevice(id: string, scope: DataScope, deletedByUserId: string): Promise<void> {
        const correlationId = `device_delete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Deleting device', {
                module: 'DeviceService',
                action: 'deleteDevice',
                correlationId,
                deviceId: id,
                deletedByUserId,
                scope,
            });

            const device = await this.validateDeviceAccess(id, scope);

            await this.deviceRepository.delete(id);

            this.logger.log('Device deleted successfully', {
                module: 'DeviceService',
                action: 'deleteDevice',
                correlationId,
                deviceId: id,
                deviceName: device.name,
            });
        } catch (error) {
            this.logger.error('Failed to delete device', error.stack, {
                module: 'DeviceService',
                action: 'deleteDevice',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async searchDevices(searchTerm: string, scope: DataScope): Promise<Device[]> {
        const correlationId = `device_search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Searching devices', {
                module: 'DeviceService',
                action: 'searchDevices',
                correlationId,
                searchTerm,
                scope,
            });

            const devices = await this.deviceRepository.searchDevices(searchTerm, scope);

            this.logger.log('Device search completed', {
                module: 'DeviceService',
                action: 'searchDevices',
                correlationId,
                searchTerm,
                resultCount: devices.length,
            });

            return devices;
        } catch (error) {
            this.logger.error('Failed to search devices', error.stack, {
                module: 'DeviceService',
                action: 'searchDevices',
                correlationId,
                searchTerm,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getDeviceCount(scope: DataScope): Promise<number> {
        const correlationId = `device_count_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Getting device count', {
                module: 'DeviceService',
                action: 'getDeviceCount',
                correlationId,
                scope,
            });

            const count = await this.deviceRepository.count(scope);

            this.logger.log('Device count retrieved', {
                module: 'DeviceService',
                action: 'getDeviceCount',
                correlationId,
                count,
            });

            return count;
        } catch (error) {
            this.logger.error('Failed to get device count', error.stack, {
                module: 'DeviceService',
                action: 'getDeviceCount',
                correlationId,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getDeviceCountByBranch(branchId: string, scope: DataScope): Promise<number> {
        const correlationId = `device_branch_count_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Getting device count by branch', {
                module: 'DeviceService',
                action: 'getDeviceCountByBranch',
                correlationId,
                branchId,
                scope,
            });

            await this.validateBranchAccess(branchId, scope);

            const count = await this.deviceRepository.getCountByBranch(branchId, scope);

            this.logger.log('Device count by branch retrieved', {
                module: 'DeviceService',
                action: 'getDeviceCountByBranch',
                correlationId,
                branchId,
                count,
            });

            return count;
        } catch (error) {
            this.logger.error('Failed to get device count by branch', error.stack, {
                module: 'DeviceService',
                action: 'getDeviceCountByBranch',
                correlationId,
                branchId,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async toggleDeviceStatus(id: string, scope: DataScope): Promise<Device> {
        const correlationId = `device_toggle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Toggling device status', {
                module: 'DeviceService',
                action: 'toggleDeviceStatus',
                correlationId,
                deviceId: id,
                scope,
            });

            const device = await this.validateDeviceAccess(id, scope);

            const newStatus = !device.isActive;
            const updatedDevice = await this.deviceRepository.update(id, {
                isActive: newStatus,
            });

            this.logger.log('Device status toggled successfully', {
                module: 'DeviceService',
                action: 'toggleDeviceStatus',
                correlationId,
                deviceId: id,
                newStatus,
                deviceName: updatedDevice.name,
            });

            return updatedDevice;
        } catch (error) {
            this.logger.error('Failed to toggle device status', error.stack, {
                module: 'DeviceService',
                action: 'toggleDeviceStatus',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getDeviceWithStats(id: string, scope: DataScope) {
        const correlationId = `device_stats_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Getting device with statistics', {
                module: 'DeviceService',
                action: 'getDeviceWithStats',
                correlationId,
                deviceId: id,
                scope,
            });

            const device = await this.validateDeviceAccess(id, scope);

            const stats = await this.deviceRepository.findWithStats(id, scope);

            this.logger.log('Device statistics retrieved', {
                module: 'DeviceService',
                action: 'getDeviceWithStats',
                correlationId,
                deviceId: id,
                deviceName: device.name,
            });

            return {
                device,
                statistics: stats,
            };
        } catch (error) {
            this.logger.error('Failed to get device with statistics', error.stack, {
                module: 'DeviceService',
                action: 'getDeviceWithStats',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async sendDeviceCommand(id: string, command: DeviceCommand, scope: DataScope): Promise<any> {
        const correlationId = `device_command_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Sending command to device', {
                module: 'DeviceService',
                action: 'sendDeviceCommand',
                correlationId,
                deviceId: id,
                command: command.command,
                scope,
            });

            const device = await this.deviceRepository.findById(id, scope);
            const adapter = this.deviceAdapterStrategy.getAdapter(device);
            const result = await adapter.sendCommand(device, command);

            this.logger.log('Command sent to device successfully', {
                module: 'DeviceService',
                action: 'sendDeviceCommand',
                correlationId,
                deviceId: id,
                command: command.command,
                result,
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to send command to device', error.stack, {
                module: 'DeviceService',
                action: 'sendDeviceCommand',
                correlationId,
                deviceId: id,
                command: command.command,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getDeviceHealth(id: string, scope: DataScope) {
        const correlationId = `device_health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Getting device health', {
                module: 'DeviceService',
                action: 'getDeviceHealth',
                correlationId,
                deviceId: id,
                scope,
            });

            const device = await this.validateDeviceAccess(id, scope);

            const health = {
                id: device.id,
                name: device.name,
                status: device.status,
                isActive: device.isActive,
                lastSeen: device.lastSeen,
                uptime: this.calculateUptime(device.lastSeen),
                responseTime: await this.testResponseTime(device),
            };

            this.logger.log('Device health retrieved', {
                module: 'DeviceService',
                action: 'getDeviceHealth',
                correlationId,
                deviceId: id,
                deviceName: device.name,
                status: health.status,
            });

            return health;
        } catch (error) {
            this.logger.error('Failed to get device health', error.stack, {
                module: 'DeviceService',
                action: 'getDeviceHealth',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async testDeviceConnection(id: string, scope: DataScope) {
        const correlationId = `device_test_connection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Testing device connection', {
                module: 'DeviceService',
                action: 'testDeviceConnection',
                correlationId,
                deviceId: id,
                scope,
            });

            const device = await this.deviceRepository.findById(id, scope);
            const adapter = this.deviceAdapterStrategy.getAdapter(device);
            const result = await adapter.testConnection(device);

            await this.deviceRepository.update(id, {
                status: result ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE,
                lastSeen: new Date(),
            });

            this.logger.log('Device connection test completed', {
                module: 'DeviceService',
                action: 'testDeviceConnection',
                correlationId,
                deviceId: id,
                success: result,
                deviceName: device.name,
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to test device connection', error.stack, {
                module: 'DeviceService',
                action: 'testDeviceConnection',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async controlDevice(id: string, controlDto: DeviceControlDto, scope: DataScope): Promise<any> {
        const correlationId = `device_control_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Controlling device', {
                module: 'DeviceService',
                correlationId,
                deviceId: id,
                action: controlDto.command,
                scope,
            });

            const device = await this.deviceRepository.findById(id, scope);
            const adapter = this.deviceAdapterStrategy.getAdapter(device);
            const result = await adapter.sendCommand(device, controlDto);

            this.logger.log('Device controlled successfully', {
                module: 'DeviceService',
                correlationId,
                deviceId: id,
                action: controlDto.command,
                result,
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to control device', error.stack, {
                module: 'DeviceService',
                correlationId,
                deviceId: id,
                action: controlDto.command,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async syncEmployeesToDevice(
        id: string,
        syncDto: DeviceSyncEmployeesDto,
        scope: DataScope,
        userId: string
    ): Promise<any> {
        const correlationId = `device_sync_employees_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Syncing employees to device', {
                module: 'DeviceService',
                action: 'syncEmployeesToDevice',
                correlationId,
                deviceId: id,
                employeeCount: syncDto.employeeIds?.length || 0,
                scope,
            });

            const device = await this.validateDeviceAccess(id, scope);

            const result = await this.employeeSyncService.syncEmployeesToDevice(
                id,
                syncDto,
                scope,
                userId
            );

            this.logger.log('Employees synced to device successfully', {
                module: 'DeviceService',
                action: 'syncEmployeesToDevice',
                correlationId,
                deviceId: id,
                result,
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to sync employees to device', error.stack, {
                module: 'DeviceService',
                action: 'syncEmployeesToDevice',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getDeviceConfiguration(id: string, scope: DataScope): Promise<DeviceConfiguration> {
        const correlationId = `device_config_get_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Getting device configuration', {
                module: 'DeviceService',
                action: 'getDeviceConfiguration',
                correlationId,
                deviceId: id,
                scope,
            });

            const device = await this.validateDeviceAccess(id, scope);

            const config = await this.deviceConfigurationService.getConfiguration(id, scope);

            this.logger.log('Device configuration retrieved', {
                module: 'DeviceService',
                action: 'getDeviceConfiguration',
                correlationId,
                deviceId: id,
                deviceName: device.name,
            });

            return config;
        } catch (error) {
            this.logger.error('Failed to get device configuration', error.stack, {
                module: 'DeviceService',
                action: 'getDeviceConfiguration',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async createDeviceConfiguration(
        id: string,
        createDto: CreateDeviceConfigurationDto,
        scope: DataScope,
        userId: string
    ): Promise<DeviceConfiguration> {
        const correlationId = `device_config_create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Creating device configuration', {
                module: 'DeviceService',
                action: 'createDeviceConfiguration',
                correlationId,
                deviceId: id,
                scope,
            });

            await this.validateDeviceAccess(id, scope);

            const config = await this.deviceConfigurationService.createConfiguration(
                createDto,
                id,
                scope,
                userId
            );

            this.logger.log('Device configuration created', {
                module: 'DeviceService',
                action: 'createDeviceConfiguration',
                correlationId,
                deviceId: id,
                configId: config.id,
            });

            return config;
        } catch (error) {
            this.logger.error('Failed to create device configuration', error.stack, {
                module: 'DeviceService',
                action: 'createDeviceConfiguration',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async updateDeviceConfiguration(
        id: string,
        updateDto: UpdateDeviceConfigurationDto,
        scope: DataScope,
        userId: string
    ): Promise<DeviceConfiguration> {
        const correlationId = `device_config_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Updating device configuration', {
                module: 'DeviceService',
                action: 'updateDeviceConfiguration',
                correlationId,
                deviceId: id,
                scope,
            });

            const device = await this.validateDeviceAccess(id, scope);

            const config = await this.deviceConfigurationService.updateConfiguration(
                id,
                updateDto,
                scope,
                userId
            );

            this.logger.log('Device configuration updated', {
                module: 'DeviceService',
                action: 'updateDeviceConfiguration',
                correlationId,
                deviceId: id,
                configId: config.id,
            });

            return config;
        } catch (error) {
            this.logger.error('Failed to update device configuration', error.stack, {
                module: 'DeviceService',
                action: 'updateDeviceConfiguration',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async deleteDeviceConfiguration(
        id: string,
        scope: DataScope,
        deletedByUserId: string
    ): Promise<void> {
        const correlationId = `device_config_delete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Deleting device configuration', {
                module: 'DeviceService',
                action: 'deleteDeviceConfiguration',
                correlationId,
                deviceId: id,
                deletedByUserId,
                scope,
            });

            const device = await this.validateDeviceAccess(id, scope);

            await this.deviceConfigurationService.deleteConfiguration(id, scope, deletedByUserId);

            this.logger.log('Device configuration deleted', {
                module: 'DeviceService',
                action: 'deleteDeviceConfiguration',
                correlationId,
                deviceId: id,
                deviceName: device.name,
            });
        } catch (error) {
            this.logger.error('Failed to delete device configuration', error.stack, {
                module: 'DeviceService',
                action: 'deleteDeviceConfiguration',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getEmployeeSyncStatus(id: string, scope: DataScope) {
        const device = await this.validateDeviceAccess(id, scope);

        const status = await this.employeeSyncService.getSyncStatus(id, scope);
        return status;
    }

    async retryFailedSyncs(id: string, scope: DataScope, retriedByUserId: string): Promise<any> {
        const correlationId = `device_sync_retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Retrying failed syncs', {
                module: 'DeviceService',
                action: 'retryFailedSyncs',
                correlationId,
                deviceId: id,
                retriedByUserId,
                scope,
            });

            const device = await this.validateDeviceAccess(id, scope);

            const result = await this.employeeSyncService.retryFailedSyncs(
                id,
                scope,
                retriedByUserId
            );

            this.logger.log('Failed syncs retried', {
                module: 'DeviceService',
                action: 'retryFailedSyncs',
                correlationId,
                deviceId: id,
                result,
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to retry failed syncs', error.stack, {
                module: 'DeviceService',
                action: 'retryFailedSyncs',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getEmployeeSyncHistory(employeeId: string, scope: DataScope) {
        const correlationId = `device_sync_history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Getting employee sync history', {
                module: 'DeviceService',
                action: 'getEmployeeSyncHistory',
                correlationId,
                employeeId,
                scope,
            });

            const history = await this.employeeSyncService.getEmployeeSyncHistory(
                employeeId,
                scope
            );

            this.logger.log('Employee sync history retrieved', {
                module: 'DeviceService',
                action: 'getEmployeeSyncHistory',
                correlationId,
                employeeId,
                recordCount: history.length,
            });

            return history;
        } catch (error) {
            this.logger.error('Failed to get employee sync history', error.stack, {
                module: 'DeviceService',
                action: 'getEmployeeSyncHistory',
                correlationId,
                employeeId,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    // ========== CREDENTIAL SYNC METHODS ==========

    async syncEmployeesWithFaceCredentials(
        id: string,
        scope: DataScope,
        userId: string
    ) {
        const correlationId = `face_credential_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Syncing employees with face credentials to device', {
                module: 'DeviceService',
                action: 'syncEmployeesWithFaceCredentials',
                correlationId,
                deviceId: id,
                scope,
            });

            const device = await this.validateDeviceAccess(id, scope);

            const result = await this.employeeSyncService.syncEmployeesWithFaceCredentials(
                id,
                scope,
                userId
            );

            this.logger.log('Face credentials synced to device successfully', {
                module: 'DeviceService',
                action: 'syncEmployeesWithFaceCredentials',
                correlationId,
                deviceId: id,
                deviceName: device.name,
                result,
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to sync face credentials to device', error.stack, {
                module: 'DeviceService',
                action: 'syncEmployeesWithFaceCredentials',
                correlationId,
                deviceId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getEmployeesWithCredentialType(
        id: string,
        credentialType: string,
        scope: DataScope
    ) {
        const correlationId = `get_employees_credentials_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Getting employees with credential type for device', {
                module: 'DeviceService',
                action: 'getEmployeesWithCredentialType',
                correlationId,
                deviceId: id,
                credentialType,
                scope,
            });

            const device = await this.validateDeviceAccess(id, scope);

            const result = await this.employeeSyncService.getEmployeesWithCredentialType(
                id,
                credentialType as any,
                scope
            );

            this.logger.log('Employees with credential type retrieved successfully', {
                module: 'DeviceService',
                action: 'getEmployeesWithCredentialType',
                correlationId,
                deviceId: id,
                deviceName: device.name,
                credentialType,
                totalEmployees: result.totalEmployees,
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to get employees with credential type', error.stack, {
                module: 'DeviceService',
                action: 'getEmployeesWithCredentialType',
                correlationId,
                deviceId: id,
                credentialType,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    // ========== PRIVATE HELPER METHODS ==========

    private async validateDeviceAccess(id: string, scope: DataScope): Promise<Device> {
        const device = await this.deviceRepository.findById(id, scope);

        if (!device) {
            throw new NotFoundException(`Device with ID '${id}' not found`);
        }

        return device;
    }

    private async validateBranchAccess(branchId: string, scope: DataScope): Promise<void> {
        if (!scope.branchIds?.includes(branchId)) {
            throw new NotFoundException(`Branch with ID '${branchId}' not found or access denied`);
        }
    }

    private calculateUptime(lastSeen: Date | null): string {
        if (!lastSeen) return 'Never';

        const now = new Date();
        const diff = now.getTime() - new Date(lastSeen).getTime();
        const minutes = Math.floor(diff / 60000);

        if (minutes < 60) return `${minutes}m`;
        if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
        return `${Math.floor(minutes / 1440)}d`;
    }

    private async testResponseTime(device: Device): Promise<number> {
        try {
            const startTime = Date.now();
            await this.deviceAdapterStrategy.getAdapter(device).testConnection(device);
            return Date.now() - startTime;
        } catch {
            return -1;
        }
    }
}
