import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DeviceWebhook } from '@prisma/client';
import { DeviceRepository } from '../device.repository';
import { CreateWebhookDto } from '@/shared/dto/webhook.dto';
import { DataScope } from '@/shared/interfaces';
import { LoggerService } from '@/core/logger';
import { DeviceAdapterStrategy } from '../device-adapter.strategy';
import { ConfigService } from '@/core/config/config.service';

@Injectable()
export class DeviceWebhookService {
    constructor(
        private readonly deviceRepository: DeviceRepository,
        private readonly logger: LoggerService,
        private readonly configService: ConfigService,
        private readonly deviceAdapterStrategy: DeviceAdapterStrategy
    ) {}

    async configureWebhook(
        deviceId: string,
        webhookDto: CreateWebhookDto,
        scope: DataScope
    ): Promise<DeviceWebhook> {
        try {
            const device = await this.deviceRepository.findById(deviceId, scope);
            if (!device) {
                throw new NotFoundException(`Device with ID '${deviceId}' not found`);
            }

            const adapter = this.deviceAdapterStrategy.getAdapter(device);

            const existingWebhook = await adapter.getWebhookConfigurations(device);

            const hostIds = existingWebhook.map(wh => wh.id);

            if (!adapter.supportsWebhooks(device)) {
                throw new BadRequestException(
                    `Device type '${device.type}' does not support webhooks`
                );
            }

            await adapter.configureEventHost(device, hostIds[0] || '1', {
                url: webhookDto.url,
                host: this.configService.hostIp,
                port: webhookDto.port || 80,
                protocolType: webhookDto.protocolType || 'HTTP',
                parameterFormatType: 'JSON',
                eventTypes: webhookDto.eventTypes || [],
            });

            const webhook = {
                deviceId,
                hostId: webhookDto.host,
                url: webhookDto.url,
                host: webhookDto.host,
                port: webhookDto.port || 80,
                eventTypes: webhookDto.eventTypes || [],
                protocolType: webhookDto.protocolType || 'HTTP',
                parameterFormatType: webhookDto.parameterFormatType || 'JSON',
                isActive: false,
                createdByUserId: scope.organizationId,
                organizationId: scope.organizationId,
            };

            // await this.deviceRepository.createWebhook(webhook);

            return webhook as DeviceWebhook;
        } catch (error) {
            throw error;
        }
    }

    async removeWebhook(
        id: string,
        hostId: string,
        scope: DataScope,
        removedByUserId: string
    ): Promise<void> {
        const device = await this.deviceRepository.findById(id, scope);

        if (!device) {
            throw new NotFoundException(`Device with ID '${id}' not found`);
        }

        const adapter = this.deviceAdapterStrategy.getAdapter(device);

        if (!adapter.supportsWebhooks(device)) {
            throw new BadRequestException(`Device type '${device.type}' does not support webhooks`);
        }

        const webhooks = await adapter.deleteWebhooks(device);
        // const webhook = await this.deviceRepository.findWebhookByHostId(id, hostId, scope);
        // if (!webhook) {
        //     throw new NotFoundException(
        //         `Webhook configuration for device '${id}' and host '${hostId}' not found`
        //     );
        // }

        // await this.deviceRepository.deleteWebhook(webhook.id);
        return webhooks;
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

            const webhook = await this.deviceRepository.findWebhookByHostId(id, scope);
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
        const device = await this.deviceRepository.findById(deviceId, scope);
        if (!device) {
            throw new NotFoundException(`Device with ID '${deviceId}' not found`);
        }

        const adapter = this.deviceAdapterStrategy.getAdapter(device);

        if (!adapter.supportsWebhooks(device)) {
            throw new BadRequestException(`Device type '${device.type}' does not support webhooks`);
        }

        const webhooks = await adapter.getWebhookConfigurations(device);

        console.log('webhooks', webhooks);

        // const webhook = await this.deviceRepository.findWebhooksByDevice(deviceId, scope);

        // if (!webhook || webhook.length === 0) {
        //     throw new NotFoundException(`Webhook configuration for device '${deviceId}' not found`);
        // }

        return webhooks;
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
