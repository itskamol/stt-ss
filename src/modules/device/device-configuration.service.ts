import { Injectable } from '@nestjs/common';
import { DeviceConfiguration, DeviceTemplate } from '@prisma/client';
import { PrismaService } from '@/core/database/prisma.service';
import { LoggerService } from '@/core/logger/logger.service';
import { 
    CreateDeviceConfigurationDto, 
    CreateDeviceTemplateDto,
    UpdateDeviceConfigurationDto,
    UpdateDeviceTemplateDto
} from '@/shared/dto';
import { DataScope } from '@/shared/interfaces';
import { DatabaseUtil } from '@/shared/utils';

@Injectable()
export class DeviceConfigurationService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: LoggerService
    ) {}

    /**
     * Create device configuration
     */
    async createConfiguration(
        data: CreateDeviceConfigurationDto,
        deviceId: string,
        scope: DataScope,
        createdByUserId: string,
        correlationId?: string
    ): Promise<DeviceConfiguration> {
        try {
            // Verify device exists and is accessible
            const device = await this.prisma.device.findFirst({
                where: {
                    id: deviceId,
                    organizationId: scope.organizationId,
                },
            });

            if (!device) {
                throw new Error('Device not found or not accessible');
            }

            const configuration = await this.prisma.deviceConfiguration.create({
                data: {
                    deviceId,
                    networkDhcp: data.networkDhcp,
                    networkStaticIp: data.networkStaticIp,
                    networkSubnet: data.networkSubnet,
                    networkGateway: data.networkGateway,
                    networkDns: data.networkDns,
                    timezone: data.timezone,
                    ntpServer: data.ntpServer,
                    syncInterval: data.syncInterval,
                    defaultAccessLevel: data.defaultAccessLevel,
                    allowUnknownCards: data.allowUnknownCards,
                    offlineMode: data.offlineMode,
                    maxUsers: data.maxUsers,
                    biometricThreshold: data.biometricThreshold,
                    duressFingerEnabled: data.duressFingerEnabled,
                    antiPassbackEnabled: data.antiPassbackEnabled,
                    eventBufferSize: data.eventBufferSize,
                    uploadInterval: data.uploadInterval,
                    retryAttempts: data.retryAttempts,
                },
            });

            this.logger.logUserAction(
                createdByUserId,
                'DEVICE_CONFIGURATION_CREATED',
                {
                    deviceId,
                    configurationId: configuration.id,
                    settings: data,
                },
                scope.organizationId,
                correlationId
            );

            return configuration;
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                throw new Error('Device configuration already exists');
            }
            throw error;
        }
    }

    /**
     * Get device configuration
     */
    async getConfiguration(deviceId: string, scope: DataScope): Promise<DeviceConfiguration | null> {
        return this.prisma.deviceConfiguration.findFirst({
            where: {
                device: {
                    id: deviceId,
                    organizationId: scope.organizationId,
                },
            },
        });
    }

    /**
     * Update device configuration
     */
    async updateConfiguration(
        deviceId: string,
        data: UpdateDeviceConfigurationDto,
        scope: DataScope,
        updatedByUserId: string,
        correlationId?: string
    ): Promise<DeviceConfiguration> {
        // Verify device exists and is accessible
        const device = await this.prisma.device.findFirst({
            where: {
                id: deviceId,
                organizationId: scope.organizationId,
            },
        });

        if (!device) {
            throw new Error('Device not found or not accessible');
        }

        const existingConfig = await this.prisma.deviceConfiguration.findFirst({
            where: { deviceId },
        });

        if (!existingConfig) {
            throw new Error('Device configuration not found');
        }

        const updateData: any = {};
        
        // Build update data dynamically
        Object.keys(data).forEach(key => {
            if (data[key] !== undefined) {
                updateData[key] = data[key];
            }
        });

        const updatedConfiguration = await this.prisma.deviceConfiguration.update({
            where: { id: existingConfig.id },
            data: updateData,
        });

        this.logger.logUserAction(
            updatedByUserId,
            'DEVICE_CONFIGURATION_UPDATED',
            {
                deviceId,
                configurationId: existingConfig.id,
                changes: data,
            },
            scope.organizationId,
            correlationId
        );

        return updatedConfiguration;
    }

    /**
     * Delete device configuration
     */
    async deleteConfiguration(
        deviceId: string,
        scope: DataScope,
        deletedByUserId: string,
        correlationId?: string
    ): Promise<void> {
        // Verify device exists and is accessible
        const device = await this.prisma.device.findFirst({
            where: {
                id: deviceId,
                organizationId: scope.organizationId,
            },
        });

        if (!device) {
            throw new Error('Device not found or not accessible');
        }

        const configuration = await this.prisma.deviceConfiguration.findFirst({
            where: { deviceId },
        });

        if (!configuration) {
            throw new Error('Device configuration not found');
        }

        await this.prisma.deviceConfiguration.delete({
            where: { id: configuration.id },
        });

        this.logger.logUserAction(
            deletedByUserId,
            'DEVICE_CONFIGURATION_DELETED',
            {
                deviceId,
                configurationId: configuration.id,
            },
            scope.organizationId,
            correlationId
        );
    }

    /**
     * Create device template
     */
    async createTemplate(
        data: CreateDeviceTemplateDto,
        scope: DataScope,
        createdByUserId: string,
        correlationId?: string
    ): Promise<DeviceTemplate> {
        try {
            const template = await this.prisma.deviceTemplate.create({
                data: {
                    name: data.name,
                    manufacturer: data.manufacturer,
                    model: data.model,
                    organizationId: scope.organizationId,
                    defaultSettings: data.defaultSettings || {},
                    endpoints: data.endpoints || {},
                    capabilities: data.capabilities || {},
                    protocol: data.protocol || {},
                    isActive: true,
                },
            });

            this.logger.logUserAction(
                createdByUserId,
                'DEVICE_TEMPLATE_CREATED',
                {
                    templateId: template.id,
                    name: data.name,
                    manufacturer: data.manufacturer,
                    model: data.model,
                },
                scope.organizationId,
                correlationId
            );

            return template;
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                throw new Error('Device template with this name already exists');
            }
            throw error;
        }
    }

    /**
     * Get device templates
     */
    async getTemplates(scope: DataScope): Promise<DeviceTemplate[]> {
        return this.prisma.deviceTemplate.findMany({
            where: {
                organizationId: scope.organizationId,
                isActive: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Get device template by ID
     */
    async getTemplateById(id: string, scope: DataScope): Promise<DeviceTemplate | null> {
        return this.prisma.deviceTemplate.findFirst({
            where: {
                id,
                organizationId: scope.organizationId,
            },
        });
    }

    /**
     * Update device template
     */
    async updateTemplate(
        id: string,
        data: UpdateDeviceTemplateDto,
        scope: DataScope,
        updatedByUserId: string,
        correlationId?: string
    ): Promise<DeviceTemplate> {
        const existingTemplate = await this.prisma.deviceTemplate.findFirst({
            where: {
                id,
                organizationId: scope.organizationId,
            },
        });

        if (!existingTemplate) {
            throw new Error('Device template not found');
        }

        const updateData: any = {};
        
        // Build update data dynamically
        Object.keys(data).forEach(key => {
            if (data[key] !== undefined) {
                updateData[key] = data[key];
            }
        });

        const updatedTemplate = await this.prisma.deviceTemplate.update({
            where: { id },
            data: updateData,
        });

        this.logger.logUserAction(
            updatedByUserId,
            'DEVICE_TEMPLATE_UPDATED',
            {
                templateId: id,
                changes: data,
            },
            scope.organizationId,
            correlationId
        );

        return updatedTemplate;
    }

    /**
     * Delete device template
     */
    async deleteTemplate(
        id: string,
        scope: DataScope,
        deletedByUserId: string,
        correlationId?: string
    ): Promise<void> {
        const template = await this.prisma.deviceTemplate.findFirst({
            where: {
                id,
                organizationId: scope.organizationId,
            },
        });

        if (!template) {
            throw new Error('Device template not found');
        }

        await this.prisma.deviceTemplate.delete({
            where: { id },
        });

        this.logger.logUserAction(
            deletedByUserId,
            'DEVICE_TEMPLATE_DELETED',
            {
                templateId: id,
                name: template.name,
            },
            scope.organizationId,
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
    ): Promise<DeviceConfiguration> {
        const template = await this.getTemplateById(templateId, scope);
        if (!template) {
            throw new Error('Device template not found');
        }

        const device = await this.prisma.device.findFirst({
            where: {
                id: deviceId,
                organizationId: scope.organizationId,
            },
        });

        if (!device) {
            throw new Error('Device not found or not accessible');
        }

        // Convert template settings to configuration
        const settings = template.defaultSettings as any;
        const configData: CreateDeviceConfigurationDto = {
            networkDhcp: settings.networkDhcp ?? true,
            networkStaticIp: settings.networkStaticIp,
            networkSubnet: settings.networkSubnet,
            networkGateway: settings.networkGateway,
            networkDns: settings.networkDns,
            timezone: settings.timezone ?? 'UTC',
            ntpServer: settings.ntpServer,
            syncInterval: settings.syncInterval ?? 60,
            defaultAccessLevel: settings.defaultAccessLevel ?? 1,
            allowUnknownCards: settings.allowUnknownCards ?? false,
            offlineMode: settings.offlineMode ?? true,
            maxUsers: settings.maxUsers ?? 1000,
            biometricThreshold: settings.biometricThreshold ?? 5,
            duressFingerEnabled: settings.duressFingerEnabled ?? false,
            antiPassbackEnabled: settings.antiPassbackEnabled ?? false,
            eventBufferSize: settings.eventBufferSize ?? 1000,
            uploadInterval: settings.uploadInterval ?? 30,
            retryAttempts: settings.retryAttempts ?? 3,
        };

        // Check if configuration already exists
        const existingConfig = await this.getConfiguration(deviceId, scope);
        if (existingConfig) {
            // Update existing configuration
            return this.updateConfiguration(
                deviceId,
                configData as UpdateDeviceConfigurationDto,
                scope,
                appliedByUserId,
                correlationId
            );
        } else {
            // Create new configuration
            return this.createConfiguration(
                configData,
                deviceId,
                scope,
                appliedByUserId,
                correlationId
            );
        }
    }

    /**
     * Get default configuration for device type
     */
    async getDefaultConfiguration(deviceType: string): Promise<CreateDeviceConfigurationDto> {
        const defaultConfigs: Record<string, CreateDeviceConfigurationDto> = {
            ACCESS_CONTROL: {
                networkDhcp: true,
                timezone: 'UTC',
                syncInterval: 60,
                defaultAccessLevel: 1,
                allowUnknownCards: false,
                offlineMode: true,
                maxUsers: 1000,
                biometricThreshold: 5,
                duressFingerEnabled: false,
                antiPassbackEnabled: true,
                eventBufferSize: 1000,
                uploadInterval: 30,
                retryAttempts: 3,
            },
            TIME_CLOCK: {
                networkDhcp: true,
                timezone: 'UTC',
                syncInterval: 30,
                defaultAccessLevel: 1,
                allowUnknownCards: false,
                offlineMode: true,
                maxUsers: 500,
                biometricThreshold: 7,
                duressFingerEnabled: false,
                antiPassbackEnabled: false,
                eventBufferSize: 500,
                uploadInterval: 15,
                retryAttempts: 3,
            },
            BIOMETRIC: {
                networkDhcp: true,
                timezone: 'UTC',
                syncInterval: 45,
                defaultAccessLevel: 2,
                allowUnknownCards: false,
                offlineMode: true,
                maxUsers: 2000,
                biometricThreshold: 8,
                duressFingerEnabled: true,
                antiPassbackEnabled: true,
                eventBufferSize: 2000,
                uploadInterval: 45,
                retryAttempts: 5,
            },
            CAMERA: {
                networkDhcp: true,
                timezone: 'UTC',
                syncInterval: 120,
                defaultAccessLevel: 1,
                allowUnknownCards: false,
                offlineMode: false,
                maxUsers: 100,
                biometricThreshold: 5,
                duressFingerEnabled: false,
                antiPassbackEnabled: false,
                eventBufferSize: 2000,
                uploadInterval: 60,
                retryAttempts: 3,
            },
        };

        return defaultConfigs[deviceType] || defaultConfigs.ACCESS_CONTROL;
    }
}