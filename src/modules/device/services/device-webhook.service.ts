import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DeviceWebhook } from '@prisma/client';
import { DeviceRepository } from '../device.repository';
import { CreateWebhookDto } from '@/shared/dto/webhook.dto';
import { DataScope } from '@/shared/interfaces';
import { LoggerService } from '@/core/logger';

@Injectable()
export class DeviceWebhookService {
    constructor(
        private readonly deviceRepository: DeviceRepository,
        private readonly logger: LoggerService
    ) {}

    async configureWebhook(
        deviceId: string,
        webhookDto: CreateWebhookDto,
        scope: DataScope
    ): Promise<DeviceWebhook> {
        const correlationId = `webhook_configure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Configuring webhook for device', {
                module: 'DeviceWebhookService',
                action: 'configureWebhook',
                correlationId,
                deviceId,
                webhookUrl: webhookDto.url,
                scope,
            });

            const device = await this.deviceRepository.findById(deviceId, scope);
            if (!device) {
                throw new NotFoundException(`Device with ID '${deviceId}' not found`);
            }

            const existingWebhook = await this.deviceRepository.findWebhookByHostId(
                deviceId,
                webhookDto.host,
                scope
            );
            if (existingWebhook) {
                throw new BadRequestException(
                    `Webhook already configured for this device and host`
                );
            }

            const webhook = await this.deviceRepository.createWebhook({
                deviceId,
                hostId: webhookDto.host,
                url: webhookDto.url,
                host: webhookDto.host,
                port: webhookDto.port || 80,
                eventTypes: webhookDto.eventTypes || [],
                protocolType: webhookDto.protocolType || 'HTTP',
                parameterFormatType: webhookDto.parameterFormatType || 'JSON',
                isActive: false,
                createdByUserId: scope.organizationId, // This should be userId but we don't have it
                organizationId: scope.organizationId,
            });

            this.logger.log('Webhook configured successfully', {
                module: 'DeviceWebhookService',
                action: 'configureWebhook',
                correlationId,
                webhookId: webhook.id,
                deviceId,
                webhookUrl: webhook.url,
            });

            return webhook;
        } catch (error) {
            this.logger.error('Failed to configure webhook', error.stack, {
                module: 'DeviceWebhookService',
                action: 'configureWebhook',
                correlationId,
                deviceId,
                webhookUrl: webhookDto.url,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getWebhookConfiguration(id: string, scope: DataScope): Promise<DeviceWebhook[]> {
        const correlationId = `webhook_get_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Fetching webhook configuration', {
                module: 'DeviceWebhookService',
                action: 'getWebhookConfiguration',
                correlationId,
                deviceId: id,
                scope,
            });

            const webhook = await this.deviceRepository.findWebhooksByDevice(id, scope);

            if (!webhook || webhook.length === 0) {
                throw new NotFoundException(`Webhook configuration for device '${id}' not found`);
            }

            this.logger.log('Webhook configuration fetched successfully', {
                module: 'DeviceWebhookService',
                action: 'getWebhookConfiguration',
                correlationId,
                deviceId: id,
                webhookCount: webhook.length,
            });

            return webhook;
        } catch (error) {
            this.logger.error('Failed to fetch webhook configuration', error.stack, {
                module: 'DeviceWebhookService',
                action: 'getWebhookConfiguration',
                correlationId,
                webhookId: id,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async removeWebhook(
        id: string,
        hostId: string,
        scope: DataScope,
        removedByUserId: string
    ): Promise<void> {
        const correlationId = `webhook_remove_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Removing webhook configuration', {
                module: 'DeviceWebhookService',
                action: 'removeWebhook',
                correlationId,
                webhookId: id,
                hostId,
                removedByUserId,
                scope,
            });

            const webhook = await this.deviceRepository.findWebhookByHostId(id, hostId, scope);
            if (!webhook) {
                throw new NotFoundException(
                    `Webhook configuration for device '${id}' and host '${hostId}' not found`
                );
            }

            await this.deviceRepository.deleteWebhook(webhook.id);

            this.logger.log('Webhook configuration removed successfully', {
                module: 'DeviceWebhookService',
                action: 'removeWebhook',
                correlationId,
                webhookId: id,
                deviceId: webhook.deviceId,
                webhookUrl: webhook.url,
            });
        } catch (error) {
            this.logger.error('Failed to remove webhook configuration', error.stack, {
                module: 'DeviceWebhookService',
                action: 'removeWebhook',
                correlationId,
                webhookId: id,
                hostId,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async testWebhook(
        id: string,
        hostId: string,
        scope: DataScope,
        testedByUserId: string
    ): Promise<any> {
        const correlationId = `webhook_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Testing webhook configuration', {
                module: 'DeviceWebhookService',
                action: 'testWebhook',
                correlationId,
                webhookId: id,
                hostId,
                testedByUserId,
                scope,
            });

            const webhook = await this.deviceRepository.findWebhookByHostId(id, hostId, scope);
            if (!webhook) {
                throw new NotFoundException(
                    `Webhook configuration for device '${id}' and host '${hostId}' not found`
                );
            }

            const testPayload = {
                test: true,
                timestamp: new Date().toISOString(),
                deviceId: webhook.deviceId,
                webhookId: webhook.id,
                message: 'This is a test webhook notification',
            };

            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Staff-Device-Webhook/1.0',
                },
                body: JSON.stringify(testPayload),
            });

            const result = {
                success: response.ok,
                status: response.status,
                statusText: response.statusText,
                responseTime: Date.now(),
            };

            this.logger.log('Webhook test completed', {
                module: 'DeviceWebhookService',
                action: 'testWebhook',
                correlationId,
                webhookId: id,
                deviceId: webhook.deviceId,
                success: result.success,
                status: result.status,
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to test webhook', error.stack, {
                module: 'DeviceWebhookService',
                action: 'testWebhook',
                correlationId,
                webhookId: id,
                hostId,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async getDeviceWebhooks(deviceId: string, scope: DataScope): Promise<DeviceWebhook[]> {
        const correlationId = `webhook_list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Fetching webhooks for device', {
                module: 'DeviceWebhookService',
                action: 'getDeviceWebhooks',
                correlationId,
                deviceId,
                scope,
            });

            const device = await this.deviceRepository.findById(deviceId, scope);
            if (!device) {
                throw new NotFoundException(`Device with ID '${deviceId}' not found`);
            }

            const webhooks = await this.deviceRepository.findWebhook(deviceId, scope);

            this.logger.log('Device webhooks fetched successfully', {
                module: 'DeviceWebhookService',
                action: 'getDeviceWebhooks',
                correlationId,
                deviceId,
                webhookCount: webhooks.length,
            });

            return webhooks;
        } catch (error) {
            this.logger.error('Failed to fetch device webhooks', error.stack, {
                module: 'DeviceWebhookService',
                action: 'getDeviceWebhooks',
                correlationId,
                deviceId,
                scope,
                error: error.message,
            });
            throw error;
        }
    }

    async triggerWebhook(deviceId: string, eventData: any, scope: DataScope): Promise<void> {
        const correlationId = `webhook_trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            this.logger.log('Triggering webhooks for device event', {
                module: 'DeviceWebhookService',
                action: 'triggerWebhook',
                correlationId,
                deviceId,
                eventType: eventData.type,
                scope,
            });

            const webhooks = await this.deviceRepository.findWebhook(deviceId, scope);

            if (webhooks.length === 0) {
                this.logger.log('No webhooks configured for device', {
                    module: 'DeviceWebhookService',
                    action: 'triggerWebhook',
                    correlationId,
                    deviceId,
                });
                return;
            }

            const payload = {
                deviceId,
                timestamp: new Date().toISOString(),
                ...eventData,
            };

            const promises = webhooks.map(async webhook => {
                try {
                    const response = await fetch(webhook.url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'Staff-Device-Webhook/1.0',
                        },
                        body: JSON.stringify(payload),
                    });

                    if (!response.ok) {
                        this.logger.warn('Webhook delivery failed', {
                            module: 'DeviceWebhookService',
                            action: 'triggerWebhook',
                            correlationId,
                            webhookId: webhook.id,
                            deviceId,
                            status: response.status,
                            statusText: response.statusText,
                        });
                    }
                } catch (error) {
                    this.logger.error('Webhook delivery error', error.stack, {
                        module: 'DeviceWebhookService',
                        action: 'triggerWebhook',
                        correlationId,
                        webhookId: webhook.id,
                        deviceId,
                        error: error.message,
                    });
                }
            });

            await Promise.allSettled(promises);

            this.logger.log('Webhooks triggered successfully', {
                module: 'DeviceWebhookService',
                action: 'triggerWebhook',
                correlationId,
                deviceId,
                webhookCount: webhooks.length,
            });
        } catch (error) {
            this.logger.error('Failed to trigger webhooks', error.stack, {
                module: 'DeviceWebhookService',
                action: 'triggerWebhook',
                correlationId,
                deviceId,
                scope,
                error: error.message,
            });
            throw error;
        }
    }
}
