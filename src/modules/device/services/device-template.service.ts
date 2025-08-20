import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Device, DeviceTemplate } from '@prisma/client';
import { DeviceRepository } from '../device.repository';
import { DeviceAdapterStrategy } from '../device-adapter.strategy';
import { CreateDeviceTemplateDto, UpdateDeviceTemplateDto } from '@/shared/dto';
import { DataScope } from '@/shared/interfaces';
import { LoggerService } from '@/core/logger';

@Injectable()
export class DeviceTemplateService {
    constructor(
        private readonly deviceRepository: DeviceRepository,
        private readonly deviceAdapterStrategy: DeviceAdapterStrategy,
        private readonly logger: LoggerService
    ) {}

    async createDeviceTemplate(
        createDto: CreateDeviceTemplateDto,
        scope: DataScope
    ): Promise<DeviceTemplate> {
        const correlationId = `template_create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Creating device template', {
                module: 'DeviceTemplateService',
                action: 'createDeviceTemplate',
                correlationId,
                templateName: createDto.name,
                scope,
            });

            const existingTemplate = await this.deviceRepository.findTemplateByName(
                createDto.name,
                scope.organizationId
            );

            if (existingTemplate) {
                throw new BadRequestException(
                    `Template with name '${createDto.name}' already exists`
                );
            }

            const template = await this.deviceRepository.createTemplate({
                ...createDto,
                organizationId: scope.organizationId,
                createdBy: scope.organizationId,
            });

            this.logger.log('Device template created successfully', {
                module: 'DeviceTemplateService',
                action: 'createDeviceTemplate',
                correlationId,
                templateId: template.id,
                templateName: template.name,
            });

            return template;
        } catch (error) {
            this.logger.error('Failed to create device template', error.stack, {
                module: 'DeviceTemplateService',
                action: 'createDeviceTemplate',
                correlationId,
                templateName: createDto.name,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getDeviceTemplates(scope: DataScope): Promise<DeviceTemplate[]> {
        const correlationId = `template_list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Fetching device templates', {
                module: 'DeviceTemplateService',
                action: 'getDeviceTemplates',
                correlationId,
                scope,
            });

            const templates = await this.deviceRepository.findTemplates(scope.organizationId);

            this.logger.log('Device templates fetched successfully', {
                module: 'DeviceTemplateService',
                action: 'getDeviceTemplates',
                correlationId,
                templateCount: templates.length,
            });

            return templates;
        } catch (error) {
            this.logger.error('Failed to fetch device templates', error.stack, {
                module: 'DeviceTemplateService',
                action: 'getDeviceTemplates',
                correlationId,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getDeviceTemplateById(id: string, scope: DataScope): Promise<DeviceTemplate> {
        const correlationId = `template_get_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Fetching device template by ID', {
                module: 'DeviceTemplateService',
                action: 'getDeviceTemplateById',
                correlationId,
                templateId: id,
                scope,
            });

            const template = await this.deviceRepository.findTemplateById(
                id,
                scope.organizationId
            );

            if (!template) {
                throw new NotFoundException(`Device template with ID '${id}' not found`);
            }

            this.logger.log('Device template fetched successfully', {
                module: 'DeviceTemplateService',
                action: 'getDeviceTemplateById',
                correlationId,
                templateId: id,
                templateName: template.name,
            });

            return template;
        } catch (error) {
            this.logger.error('Failed to fetch device template', error.stack, {
                module: 'DeviceTemplateService',
                action: 'getDeviceTemplateById',
                correlationId,
                templateId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async updateDeviceTemplate(
        id: string,
        updateDto: UpdateDeviceTemplateDto,
        scope: DataScope
    ): Promise<DeviceTemplate> {
        const correlationId = `template_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Updating device template', {
                module: 'DeviceTemplateService',
                action: 'updateDeviceTemplate',
                correlationId,
                templateId: id,
                scope,
            });

            const existingTemplate = await this.deviceRepository.findTemplateById(
                id,
                scope.organizationId
            );
            if (!existingTemplate) {
                throw new NotFoundException(`Device template with ID '${id}' not found`);
            }

            const updatedTemplate = await this.deviceRepository.updateTemplate(id, updateDto);

            this.logger.log('Device template updated successfully', {
                module: 'DeviceTemplateService',
                action: 'updateDeviceTemplate',
                correlationId,
                templateId: id,
                templateName: updatedTemplate.name,
            });

            return updatedTemplate;
        } catch (error) {
            this.logger.error('Failed to update device template', error.stack, {
                module: 'DeviceTemplateService',
                action: 'updateDeviceTemplate',
                correlationId,
                templateId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async deleteDeviceTemplate(
        id: string,
        scope: DataScope,
        deletedByUserId: string
    ): Promise<void> {
        const correlationId = `template_delete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Deleting device template', {
                module: 'DeviceTemplateService',
                action: 'deleteDeviceTemplate',
                correlationId,
                templateId: id,
                deletedByUserId,
                scope,
            });

            const existingTemplate = await this.deviceRepository.findTemplateById(
                id,
                scope.organizationId
            );
            if (!existingTemplate) {
                throw new NotFoundException(`Device template with ID '${id}' not found`);
            }

            await this.deviceRepository.deleteTemplate(id);

            this.logger.log('Device template deleted successfully', {
                module: 'DeviceTemplateService',
                action: 'deleteDeviceTemplate',
                correlationId,
                templateId: id,
                templateName: existingTemplate.name,
            });
        } catch (error) {
            this.logger.error('Failed to delete device template', error.stack, {
                module: 'DeviceTemplateService',
                action: 'deleteDeviceTemplate',
                correlationId,
                templateId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async applyTemplateToDevice(
        templateId: string,
        deviceId: string,
        scope: DataScope
    ): Promise<void> {
        const correlationId = `template_apply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Applying template to device', {
                module: 'DeviceTemplateService',
                action: 'applyTemplateToDevice',
                correlationId,
                templateId,
                deviceId,
                scope,
            });

            const template = await this.deviceRepository.findTemplateById(
                templateId,
                scope.organizationId
            );
            if (!template) {
                throw new NotFoundException(`Device template with ID '${templateId}' not found`);
            }

            const device = await this.deviceRepository.findById(deviceId, scope);
            if (!device) {
                throw new NotFoundException(`Device with ID '${deviceId}' not found`);
            }

            const adapter = this.deviceAdapterStrategy.getAdapter({
                protocol: device.protocol,
                host: device.host,
                port: device.port,
                username: device.username,
                password: device.password,
            } as any);

            // Apply template configuration to device
            const config = {
                deviceId: device.id,
                settings: {},
            };
            await adapter.updateDeviceConfiguration(device as Device, config);

            this.logger.log('Template applied to device successfully', {
                module: 'DeviceTemplateService',
                action: 'applyTemplateToDevice',
                correlationId,
                templateId,
                deviceId,
                templateName: template.name,
                deviceName: device.name,
            });
        } catch (error) {
            this.logger.error('Failed to apply template to device', error.stack, {
                module: 'DeviceTemplateService',
                action: 'applyTemplateToDevice',
                correlationId,
                templateId,
                deviceId,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async autoApplyTemplateToDevice(
        deviceId: string,
        scope: DataScope,
        appliedByUserId: string
    ): Promise<void> {
        const correlationId = `template_auto_apply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Auto-applying template to device', {
                module: 'DeviceTemplateService',
                action: 'autoApplyTemplateToDevice',
                correlationId,
                deviceId,
                appliedByUserId,
                scope,
            });

            const device = await this.deviceRepository.findById(deviceId, scope);
            if (!device) {
                throw new NotFoundException(`Device with ID '${deviceId}' not found`);
            }

            const suggestedTemplates = await this.getSuggestedTemplates(deviceId, scope);

            if (suggestedTemplates.length > 0) {
                const bestMatch = suggestedTemplates[0];
                await this.applyTemplateToDevice(bestMatch.id, deviceId, scope);

                this.logger.log('Auto-applied template to device', {
                    module: 'DeviceTemplateService',
                    action: 'autoApplyTemplateToDevice',
                    correlationId,
                    deviceId,
                    templateId: bestMatch.id,
                    templateName: bestMatch.name,
                    deviceName: device.name,
                });
            } else {
                this.logger.log('No suitable template found for auto-application', {
                    module: 'DeviceTemplateService',
                    action: 'autoApplyTemplateToDevice',
                    correlationId,
                    deviceId,
                    deviceName: device.name,
                });
            }
        } catch (error) {
            this.logger.error('Failed to auto-apply template to device', error.stack, {
                module: 'DeviceTemplateService',
                action: 'autoApplyTemplateToDevice',
                correlationId,
                deviceId,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getSuggestedTemplates(deviceId: string, scope: DataScope): Promise<DeviceTemplate[]> {
        const correlationId = `template_suggest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Getting suggested templates for device', {
                module: 'DeviceTemplateService',
                action: 'getSuggestedTemplates',
                correlationId,
                deviceId,
                scope,
            });

            const device = await this.deviceRepository.findById(deviceId, scope);
            if (!device) {
                throw new NotFoundException(`Device with ID '${deviceId}' not found`);
            }

            const allTemplates = await this.deviceRepository.findTemplates(
                scope.organizationId
            );

            const suggestedTemplates = allTemplates.filter(template => {
                return (
                    template.manufacturer === device.manufacturer && template.model === device.model
                );
            });

            this.logger.log('Suggested templates retrieved', {
                module: 'DeviceTemplateService',
                action: 'getSuggestedTemplates',
                correlationId,
                deviceId,
                deviceName: device.name,
                suggestedCount: suggestedTemplates.length,
            });

            return suggestedTemplates;
        } catch (error) {
            this.logger.error('Failed to get suggested templates', error.stack, {
                module: 'DeviceTemplateService',
                action: 'getSuggestedTemplates',
                correlationId,
                deviceId,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async autoApplyMatchingTemplate(device: any, scope: DataScope): Promise<void> {
        const correlationId = `template_auto_match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Auto-applying matching template for device', {
                module: 'DeviceTemplateService',
                action: 'autoApplyMatchingTemplate',
                correlationId,
                deviceId: device.id,
                deviceName: device.name,
                deviceType: device.type,
                manufacturer: device.manufacturer,
                model: device.model,
            });

            const suggestedTemplates = await this.getSuggestedTemplates(device.id, scope);

            if (suggestedTemplates.length > 0) {
                const bestMatch = suggestedTemplates[0];
                await this.applyTemplateToDevice(bestMatch.id, device.id, scope);

                this.logger.log('Auto-applied matching template to device', {
                    module: 'DeviceTemplateService',
                    action: 'autoApplyMatchingTemplate',
                    correlationId,
                    deviceId: device.id,
                    templateId: bestMatch.id,
                    templateName: bestMatch.name,
                    deviceName: device.name,
                });
            } else {
                this.logger.log('No matching template found for device', {
                    module: 'DeviceTemplateService',
                    action: 'autoApplyMatchingTemplate',
                    correlationId,
                    deviceId: device.id,
                    deviceName: device.name,
                    deviceType: device.type,
                    manufacturer: device.manufacturer,
                    model: device.model,
                });
            }
        } catch (error) {
            this.logger.error('Failed to auto-apply matching template', error.stack, {
                module: 'DeviceTemplateService',
                action: 'autoApplyMatchingTemplate',
                correlationId,
                deviceId: device.id,
                deviceName: device.name,
                error: error.message,
            });
            throw error;
        }
    }
}
