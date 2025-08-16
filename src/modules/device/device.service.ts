import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Device, DeviceProtocol, DeviceType, ParameterFormatType } from '@prisma/client';
import { DeviceRepository } from './device.repository';
import { DeviceConfigurationService } from './device-configuration.service';
import { EmployeeSyncService } from './employee-sync.service';
import { DeviceAdapterStrategy } from './device-adapter.strategy';
import { DatabaseUtil } from '@/shared/utils';
import {
    CreateDeviceConfigurationDto,
    CreateDeviceDto,
    CreateDeviceTemplateDto,
    DeviceControlDto,
    DeviceSyncEmployeesDto,
    NetworkScanResultDto,
    PaginationDto,
    PaginationResponseDto,
    PreScannedDeviceCreationDto,
    SimplifiedDeviceCreationDto,
    UpdateDeviceConfigurationDto,
    UpdateDeviceDto,
    UpdateDeviceTemplateDto,
} from '@/shared/dto';
import { DataScope } from '@/shared/interfaces';
import { EncryptionService } from '@/shared/services/encryption.service';
import { DeviceCommand, DeviceDiscoveryConfig, DeviceInfo } from '@/modules/integrations/adapters';
import { CreateWebhookDto } from '@/shared/dto/webhook.dto';
import { LoggerService } from '@/core/logger';

@Injectable()
export class DeviceService {
    constructor(
        private readonly deviceRepository: DeviceRepository,
        private readonly deviceConfigurationService: DeviceConfigurationService,
        private readonly employeeSyncService: EmployeeSyncService,
        private readonly deviceAdapterStrategy: DeviceAdapterStrategy,
        private readonly encryptionService: EncryptionService,
        private readonly logger: LoggerService
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
    }): Promise<DeviceInfo> {
        try {
            this.logger.debug('Starting device auto-discovery', {
                host: connectionDetails.host,
                port: connectionDetails.port,
            });

            // Validate input parameters
            if (!connectionDetails.host || !connectionDetails.port) {
                throw new Error('Host and port are required for device discovery');
            }

            // Create type-safe device config for discovery
            const discoveryConfig: DeviceDiscoveryConfig = {
                protocol: connectionDetails.protocol || DeviceProtocol.HTTP,
                host: connectionDetails.host,
                port: connectionDetails.port,
                username: connectionDetails.username || '',
                password: connectionDetails.password || '',
                brand: connectionDetails.brand || 'unknown',
            };

            // Try to get device information using adapter
            const deviceInfo =
                await this.deviceAdapterStrategy.getDeviceInfoByConfig(discoveryConfig);

            // Extract device details with fallbacks
            const discoveredInfo: DeviceInfo = {
                name: deviceInfo.name || `${connectionDetails.brand} Device`,
                deviceId:
                    deviceInfo.deviceId ||
                    deviceInfo.serialNumber ||
                    `${connectionDetails.host}_${Date.now()}`,
                model: deviceInfo.model || 'Unknown Model',
                serialNumber: deviceInfo.serialNumber || '',
                macAddress: deviceInfo.macAddress || this.extractMacAddress(deviceInfo) || '',
                firmwareVersion: deviceInfo.firmwareVersion || 'Unknown',
                deviceType: deviceInfo.deviceType || 'ACCESS_CONTROL',
                manufacturer: deviceInfo.manufacturer || this.extractManufacturer(deviceInfo),
                capabilities: Array.isArray(deviceInfo.capabilities) ? deviceInfo.capabilities : [],
                status: deviceInfo.status || 'unknown',
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
                name: `${connectionDetails.brand || 'Unknown'} Device`,
                deviceId: `${connectionDetails.host}_${Date.now()}`,
                model: 'Unknown Model',
                serialNumber: '',
                macAddress: '',
                firmwareVersion: 'Unknown',
                deviceType: 'ACCESS_CONTROL',
                manufacturer: connectionDetails.brand || 'Unknown',
                capabilities: [],
                status: 'unknown',
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
     * Create a new device with various options
     */
    async createDevice(
        deviceData: CreateDeviceDto | SimplifiedDeviceCreationDto | PreScannedDeviceCreationDto,
        scope: DataScope,
        createdByUserId: string,
        options?: {
            autoDiscovery?: boolean;
            preScan?: boolean;
            correlationId?: string;
        }
    ): Promise<Device> {
        try {
            let createDeviceDto: CreateDeviceDto;

            // Handle different input types
            if ('host' in deviceData && 'port' in deviceData && !('discoveredInfo' in deviceData)) {
                // SimplifiedDeviceCreationDto
                const simplifiedInfo = deviceData as SimplifiedDeviceCreationDto;

                if (options?.preScan) {
                    const scanResult = await this.scanDeviceForCreationInternal(simplifiedInfo);
                    if (!scanResult.found) {
                        throw new BadRequestException(
                            `Device not found at ${simplifiedInfo.host}:${simplifiedInfo.port}. ${scanResult.error || ''}`
                        );
                    }

                    createDeviceDto = {
                        name: simplifiedInfo.name,
                        type: scanResult.deviceInfo.type || DeviceType.ACCESS_CONTROL,
                        host: simplifiedInfo.host,
                        username: simplifiedInfo.username,
                        password: simplifiedInfo.password,
                        port: simplifiedInfo.port || 80,
                        serialNumber: scanResult.deviceInfo.serialNumber || '',
                        protocol: simplifiedInfo.protocol || DeviceProtocol.HTTP,
                        macAddress: scanResult.deviceInfo.macAddress,
                        manufacturer: scanResult.deviceInfo.manufacturer,
                        model: scanResult.deviceInfo.model,
                        firmware: scanResult.deviceInfo.firmware,
                        description:
                            simplifiedInfo.description ||
                            `Auto-discovered ${scanResult.deviceInfo.manufacturer} device`,
                        branchId: simplifiedInfo.branchId,
                        isActive: true,
                    };
                } else {
                    // Auto-discovery for simplified info
                    const discoveredInfo = await this.discoverDeviceInfo({
                        host: simplifiedInfo.host,
                        port: simplifiedInfo.port || 80,
                        username: simplifiedInfo.username || '',
                        password: simplifiedInfo.password || '',
                        protocol: simplifiedInfo.protocol,
                        brand: 'unknown',
                    });

                    createDeviceDto = {
                        name: simplifiedInfo.name,
                        type: DeviceType.ACCESS_CONTROL,
                        host: simplifiedInfo.host,
                        username: simplifiedInfo.username,
                        password: simplifiedInfo.password,
                        port: simplifiedInfo.port || 80,
                        protocol: simplifiedInfo.protocol || DeviceProtocol.HTTP,
                        macAddress: discoveredInfo.macAddress,
                        manufacturer: discoveredInfo.manufacturer,
                        model: discoveredInfo.model,
                        firmware: discoveredInfo.firmwareVersion,
                        description:
                            simplifiedInfo.description ||
                            `Auto-discovered ${discoveredInfo.manufacturer} device`,
                        branchId: simplifiedInfo.branchId,
                        isActive: true,
                    };
                }
            } else if ('discoveredInfo' in deviceData) {
                // PreScannedDeviceCreationDto
                const preScannedInfo = deviceData as PreScannedDeviceCreationDto;
                createDeviceDto = {
                    name: preScannedInfo.name,
                    type: DeviceType.ACCESS_CONTROL,
                    host: preScannedInfo.host,
                    username: preScannedInfo.username,
                    password: preScannedInfo.password,
                    port: preScannedInfo.port || 80,
                    protocol: preScannedInfo.protocol || DeviceProtocol.HTTP,
                    macAddress: preScannedInfo.discoveredInfo?.macAddress,
                    manufacturer: preScannedInfo.discoveredInfo?.manufacturer,
                    model: preScannedInfo.discoveredInfo?.model,
                    firmware: preScannedInfo.discoveredInfo?.firmware,
                    description: preScannedInfo.description || `Device at ${preScannedInfo.host}`,
                    branchId: preScannedInfo.branchId,
                    isActive: true,
                };
            } else {
                // CreateDeviceDto
                createDeviceDto = deviceData as CreateDeviceDto;
            }

            // Validate branch access
            if (scope.branchIds && !scope.branchIds.includes(createDeviceDto.branchId)) {
                throw new BadRequestException('Branch not accessible within your scope');
            }

            // Auto-discovery if enabled and missing info
            if (
                options?.autoDiscovery &&
                (!createDeviceDto.manufacturer ||
                    !createDeviceDto.model ||
                    !createDeviceDto.firmware)
            ) {
                this.logger.debug('Auto-discovering device information', {
                    host: createDeviceDto.host,
                    port: createDeviceDto.port,
                });

                const discoveredInfo = await this.discoverDeviceInfo({
                    host: createDeviceDto.host,
                    port: createDeviceDto.port,
                    username: createDeviceDto.username,
                    password: createDeviceDto.password,
                    protocol: createDeviceDto.protocol,
                    brand: createDeviceDto.manufacturer,
                });

                createDeviceDto = {
                    ...createDeviceDto,
                    manufacturer: createDeviceDto.manufacturer || discoveredInfo.manufacturer,
                    model: createDeviceDto.model || discoveredInfo.model,
                    firmware: createDeviceDto.firmware || discoveredInfo.firmwareVersion,
                    macAddress: createDeviceDto.macAddress || discoveredInfo.macAddress,
                };
            }

            // Check MAC address uniqueness
            if (createDeviceDto.macAddress) {
                const existingDevice = await this.deviceRepository.findByMacAddress(
                    createDeviceDto.macAddress,
                    scope
                );

                if (existingDevice) {
                    throw new ConflictException('Device with this MAC address already exists');
                }
            }

            createDeviceDto.password = this.encryptionService.encrypt(createDeviceDto.password);

            const device = await this.deviceRepository.create(createDeviceDto, scope);

            this.logger.logUserAction(createdByUserId, 'DEVICE_CREATED', {
                deviceId: device.id,
                deviceName: device.name,
                deviceType: device.type,
                branchId: device.branchId,
                macAddress: device.macAddress,
                manufacturer: device.manufacturer,
                model: device.model,
                autoDiscovered: options?.autoDiscovery || options?.preScan,
                organizationId: scope.organizationId,
                correlationId: options?.correlationId,
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
     * Scan network for device information before creation
     */
    private async scanDeviceForCreationInternal(
        scanInfo: SimplifiedDeviceCreationDto
    ): Promise<NetworkScanResultDto> {
        try {
            const discoveredInfo = await this.discoverDeviceInfo({
                host: scanInfo.host,
                port: scanInfo.port || 80,
                username: scanInfo.username || '',
                password: scanInfo.password || '',
                protocol: scanInfo.protocol,
                brand: scanInfo.protocol,
            });

            return {
                found: true,
                deviceInfo: {
                    name: discoveredInfo.name,
                    manufacturer: discoveredInfo.manufacturer,
                    model: discoveredInfo.model,
                    type: discoveredInfo.deviceType,
                    serialNumber: discoveredInfo.serialNumber,
                    firmware: discoveredInfo.firmwareVersion,
                    macAddress: discoveredInfo.macAddress,
                    capabilities: discoveredInfo.capabilities.map(cap => cap.toString()),
                    status: discoveredInfo.status,
                },
                scannedAt: new Date(),
            };
        } catch (error) {
            return {
                found: false,
                error: error.message,
                scannedAt: new Date(),
            };
        }
    }

    /**
     * Get all devices (scoped to managed branches)
     */
    async getDevices(
        scope: DataScope,
        paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<Device>> {
        const { page, limit } = paginationDto;
        const skip = (page - 1) * limit;

        const [devices, total] = await Promise.all([
            this.deviceRepository.findMany(scope, skip, limit),
            this.deviceRepository.count(scope),
        ]);

        return new PaginationResponseDto(devices, total, page, limit);
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
    async getDeviceById(id: string, scope: DataScope): Promise<Device> {
        const device = await this.deviceRepository.findById(id, scope);
        if (!device) {
            throw new NotFoundException('Device not found');
        }
        return device;
    }

    /**
     * Get device by MAC address
     */
    async getDeviceByMacAddress(macAddress: string, scope: DataScope): Promise<Device> {
        const device = await this.deviceRepository.findByMacAddress(macAddress, scope);
        if (!device) {
            throw new NotFoundException('Device not found');
        }
        return device;
    }

    /**
     * Get device by identifier
     */
    async getDeviceBySerialNumber(serialNumber: string, scope: DataScope): Promise<Device | null> {
        return this.deviceRepository.findByDeviceSerialNumber(serialNumber, scope);
    }

    /**
     * Update device
     */
    async updateDevice(
        id: string,
        updateDeviceDto: UpdateDeviceDto,
        scope: DataScope,
        updatedByUserId: string
    ): Promise<Device> {
        const existingDevice = await this.getDeviceById(id, scope);

        try {
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

            return await this.deviceRepository.update(id, updateDeviceDto, scope);
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
    async deleteDevice(id: string, scope: DataScope, deletedByUserId: string): Promise<void> {
        await this.getDeviceById(id, scope);
        await this.deviceRepository.delete(id, scope);
    }

    /**
     * Search devices
     */
    async searchDevices(searchTerm: string, scope: DataScope): Promise<Device[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }
        const skip = 0;
        const take = 10;
        return this.deviceRepository.searchDevices(searchTerm.trim(), scope, skip, take);
    }

    /**
     * Get device count
     */
    async getDeviceCount(scope: DataScope): Promise<number> {
        return this.deviceRepository.count(scope);
    }

    /**
     * Get device count by branch
     */
    async getDeviceCountByBranch(branchId: string, scope: DataScope): Promise<number> {
        // Validate branch access
        if (scope.branchIds && !scope.branchIds.includes(branchId)) {
            throw new BadRequestException('Branch not accessible within your scope');
        }

        return this.deviceRepository.count(scope, { branchId });
    }

    /**
     * Activate/Deactivate device
     */
    async toggleDeviceStatus(
        id: string,
        isActive: boolean,
        scope: DataScope,
        updatedByUserId: string
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
                previousStatus: existingDevice.isActive,
                newStatus: isActive,
                organizationId: scope.organizationId,
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
        command: DeviceCommand | string,
        scope: DataScope,
        commandByUserId: string
    ) {
        const device = await this.findDeviceById(id, scope);

        if (!device.isActive) {
            throw new BadRequestException('Cannot send command to inactive device');
        }

        const deviceCommand = typeof command === 'string' ? { command: command as any } : command;

        try {
            const result = await this.deviceAdapterStrategy.executeCommand(device, deviceCommand);

            this.logger.logUserAction(commandByUserId, 'DEVICE_COMMAND_SENT', {
                deviceId: id,
                deviceName: device.name,
                command: deviceCommand.command,
                success: result.success,
                message: result.message,
                organizationId: scope.organizationId,
            });

            return result;
        } catch (error) {
            this.logger.logUserAction(commandByUserId, 'DEVICE_COMMAND_FAILED', {
                deviceId: id,
                deviceName: device.name,
                command: deviceCommand.command,
                error: error.message,
                organizationId: scope.organizationId,
            });

            throw error;
        }
    }

    /**
     * Get device health status
     */
    async getDeviceHealth(id: string, scope: DataScope) {
        const device = await this.findDeviceById(id, scope);

        try {
            return await this.deviceAdapterStrategy.getDeviceHealth(device);
        } catch (error) {
            return {
                deviceId: device.id,
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
        const device = await this.findDeviceById(id, scope);

        try {
            const isConnected = await this.deviceAdapterStrategy.testConnection(device);

            // Update last seen if connection is successful
            if (isConnected) {
                await this.deviceRepository.update(id, { lastSeen: new Date() }, scope);
            }

            return {
                success: isConnected,
                message: isConnected ? 'Connection successful' : 'Connection failed',
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    /**
     * Control device actions (open door, reboot, etc.)
     */
    async controlDevice(
        id: string,
        action: string | DeviceControlDto,
        scope: DataScope,
        controlledByUserId: string,
        correlationId?: string,
        parameters?: any
    ) {
        const device = await this.findDeviceById(id, scope);

        if (!device.isActive) {
            throw new BadRequestException('Cannot control inactive device');
        }

        const command =
            typeof action === 'string'
                ? { command: action, parameters }
                : {
                      command: action.action,
                      parameters: action.parameters,
                      timeout: action.timeout,
                  };

        try {
            const result = await this.deviceAdapterStrategy.executeCommand(
                device,
                command as DeviceCommand
            );

            this.logger.logUserAction(controlledByUserId, 'DEVICE_CONTROL_ACTION', {
                deviceId: id,
                deviceName: device.name,
                action: command.command,
                parameters: command.parameters,
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
                action: command.command,
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
        syncedByUserId: string
    ) {
        return this.employeeSyncService.syncEmployeesToDevice(id, syncDto, scope, syncedByUserId);
    }

    /**
     * Get device configuration
     */
    async getDeviceConfiguration(id: string, scope: DataScope) {
        await this.findDeviceById(id, scope);
        return this.deviceConfigurationService.getConfiguration(id, scope);
    }

    /**
     * Create device configuration
     */
    async createDeviceConfiguration(
        id: string,
        configData: CreateDeviceConfigurationDto,
        scope: DataScope,
        createdByUserId: string
    ) {
        await this.findDeviceById(id, scope);
        return this.deviceConfigurationService.createConfiguration(
            configData,
            id,
            scope,
            createdByUserId
        );
    }

    /**
     * Update device configuration
     */
    async updateDeviceConfiguration(
        id: string,
        configData: UpdateDeviceConfigurationDto,
        scope: DataScope,
        updatedByUserId: string
    ) {
        await this.findDeviceById(id, scope);
        return this.deviceConfigurationService.updateConfiguration(
            id,
            configData,
            scope,
            updatedByUserId
        );
    }

    /**
     * Delete device configuration
     */
    async deleteDeviceConfiguration(id: string, scope: DataScope, deletedByUserId: string) {
        await this.findDeviceById(id, scope);
        return this.deviceConfigurationService.deleteConfiguration(id, scope, deletedByUserId);
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
        createdByUserId: string
    ) {
        return this.deviceConfigurationService.createTemplate(templateData, scope, createdByUserId);
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
        updatedByUserId: string
    ) {
        return this.deviceConfigurationService.updateTemplate(
            id,
            templateData,
            scope,
            updatedByUserId
        );
    }

    /**
     * Delete device template
     */
    async deleteDeviceTemplate(id: string, scope: DataScope, deletedByUserId: string) {
        return this.deviceConfigurationService.deleteTemplate(id, scope, deletedByUserId);
    }

    /**
     * Apply template to device
     */
    async applyTemplateToDevice(
        templateId: string,
        deviceId: string,
        scope: DataScope,
        appliedByUserId: string
    ) {
        return this.deviceConfigurationService.applyTemplateToDevice(
            templateId,
            deviceId,
            scope,
            appliedByUserId
        );
    }

    /**
     * Configure webhook for device events
     */
    async configureWebhook(
        id: string,
        webhookConfig: CreateWebhookDto,
        scope: DataScope,
        configuredByUserId: string
    ) {
        const device = await this.findDeviceById(id, scope);

        if (!device.isActive) {
            throw new BadRequestException('Cannot configure webhook for inactive device');
        }

        try {
            const hostId = `webhook_${Date.now()}`;

            // Configure webhook using the adapter
            await this.deviceAdapterStrategy.executeCommand(device, {
                command: 'configure_webhook',
                parameters: {
                    hostId,
                    ...webhookConfig,
                },
            });

            // Save webhook configuration using repository pattern
            const webhookData = await this.deviceRepository.createWebhook({
                deviceId: id,
                hostId,
                url: webhookConfig.url,
                host: webhookConfig.host,
                port: webhookConfig.port,
                eventTypes: webhookConfig.eventTypes,
                protocolType: webhookConfig.protocolType || 'HTTP',
                parameterFormatType: webhookConfig.parameterFormatType || ParameterFormatType.JSON,
                isActive: true,
                createdByUserId: configuredByUserId,
                organizationId: scope.organizationId,
            });

            return {
                id: webhookData.id,
                hostId,
                message: 'Webhook configured successfully',
                configuredAt: new Date(),
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get webhook configuration for device
     */
    async getWebhookConfiguration(id: string, scope: DataScope) {
        const device = await this.findDeviceById(id, scope);
        const webhooks = await this.deviceRepository.findWebhooksByDevice(id, scope);

        return {
            deviceId: id,
            deviceName: device.name,
            webhooks: webhooks.map(webhook => ({
                id: webhook.id,
                hostId: webhook.hostId,
                url: webhook.url,
                host: webhook.host,
                port: webhook.port,
                eventTypes: webhook.eventTypes,
                protocolType: webhook.protocolType,
                parameterFormatType: webhook.parameterFormatType,
                isActive: webhook.isActive,
                triggerCount: webhook.triggerCount,
                lastTriggered: webhook.lastTriggered,
                lastError: webhook.lastError,
                createdAt: webhook.createdAt,
            })),
        };
    }

    /**
     * Remove webhook configuration
     */
    async removeWebhook(id: string, hostId: string, scope: DataScope, removedByUserId: string) {
        const device = await this.findDeviceById(id, scope);
        const webhook = await this.deviceRepository.findWebhookByHostId(id, hostId, scope);
        if (!webhook) {
            throw new NotFoundException('Webhook configuration not found');
        }

        try {
            // Remove webhook from device
            await this.deviceAdapterStrategy.executeCommand(device, {
                command: 'remove_webhook',
                parameters: { hostId },
            });

            // Mark as inactive using repository
            await this.deviceRepository.updateWebhook(webhook.id, {
                isActive: false,
                updatedAt: new Date(),
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Test webhook configuration
     */
    async testWebhook(id: string, hostId: string, scope: DataScope, testedByUserId: string) {
        const device = await this.findDeviceById(id, scope);
        const webhook = await this.deviceRepository.findWebhookByHostId(id, hostId, scope);
        if (!webhook) {
            throw new NotFoundException('Webhook configuration not found');
        }

        try {
            // Test webhook connectivity using the adapter
            const result = await this.deviceAdapterStrategy.executeCommand(device, {
                command: 'test_webhook',
                parameters: { hostId },
            });

            return {
                success: result.success,
                message: result.success ? 'Webhook test successful' : 'Webhook test failed',
                data: result.data,
                userId: testedByUserId,
                testedAt: new Date(),
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                userId: testedByUserId,
                testedAt: new Date(),
            };
        }
    }

    private async findDeviceById(id: string, scope: DataScope): Promise<Device> {
        const device = await this.deviceRepository.findById(id, scope);
        if (!device) {
            throw new NotFoundException('Device not found');
        }
        device.password = this.encryptionService.decrypt(device.password);
        return device;
    }
}
