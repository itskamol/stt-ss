import { Body, Controller, Headers, Ip, Logger, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { DeviceService } from './device.service';
import { WebhookEventDto } from '@/shared/dto/webhook.dto';

@ApiTags('Device Webhooks')
@Controller('webhook')
export class WebhookController {
    private readonly logger = new Logger(WebhookController.name);

    constructor(private readonly deviceService: DeviceService) {}

    @Post('device-events')
    @ApiOperation({ summary: 'Receive device events via webhook' })
    @ApiBody({ description: 'Device event data' })
    async handleDeviceEvent(
        @Body() eventData: any,
        @Headers() headers: any,
        @Ip() clientIp: string
    ) {
        this.logger.log('Received device event', {
            eventData,
            clientIp,
            headers: {
                'content-type': headers['content-type'],
                'user-agent': headers['user-agent']
            }
        });

        try {
            // Process the event based on type
            if (eventData.EventNotificationAlert) {
                const event = eventData.EventNotificationAlert;
                
                // Extract device information from the event
                const deviceId = this.extractDeviceId(event, clientIp);
                const hostId = this.extractHostId(event);

                // Update webhook statistics
                if (deviceId && hostId) {
                    await this.deviceService.updateWebhookStats(deviceId, hostId, true);
                }
                
                switch (event.eventType) {
                    case 'AccessControllerEvent':
                        await this.handleAccessControlEvent(event, deviceId);
                        break;
                    case 'faceMatch':
                        await this.handleFaceMatchEvent(event, deviceId);
                        break;
                    case 'cardReader':
                        await this.handleCardReaderEvent(event, deviceId);
                        break;
                    case 'doorStatus':
                        await this.handleDoorStatusEvent(event, deviceId);
                        break;
                    default:
                        this.logger.warn('Unknown event type', { eventType: event.eventType });
                }
            }

            return { status: 'received', timestamp: new Date() };
        } catch (error) {
            this.logger.error('Failed to process webhook event', error, {
                eventData,
                clientIp
            });

            // Try to update webhook error stats
            try {
                const deviceId = this.extractDeviceId(eventData, clientIp);
                const hostId = this.extractHostId(eventData);
                if (deviceId && hostId) {
                    await this.deviceService.updateWebhookStats(deviceId, hostId, false, error.message);
                }
            } catch (statsError) {
                this.logger.error('Failed to update webhook error stats', statsError);
            }

            return { status: 'error', message: error.message, timestamp: new Date() };
        }
    }

    @Post('device-events/:deviceId')
    @ApiOperation({ summary: 'Receive device events for specific device' })
    @ApiParam({ name: 'deviceId', description: 'Device ID' })
    async handleDeviceEventWithId(
        @Param('deviceId') deviceId: string,
        @Body() eventData: any,
        @Headers() headers: any,
        @Ip() clientIp: string
    ) {
        this.logger.log('Received device event with ID', {
            deviceId,
            eventData,
            clientIp
        });

        // Process event with known device ID
        return this.handleDeviceEvent({ ...eventData, deviceId }, headers, clientIp);
    }

    private extractDeviceId(event: any, clientIp: string): string | null {
        // Try to extract device ID from various sources
        if (event.deviceId) return event.deviceId;
        if (event.EventNotificationAlert?.deviceID) return event.EventNotificationAlert.deviceID;
        if (event.EventNotificationAlert?.ipAddress) return event.EventNotificationAlert.ipAddress;
        
        // Fallback to client IP
        return clientIp;
    }

    private extractHostId(event: any): string | null {
        // Try to extract host ID from event data
        if (event.hostId) return event.hostId;
        if (event.EventNotificationAlert?.hostId) return event.EventNotificationAlert.hostId;
        
        return null;
    }

    private async handleAccessControlEvent(event: any, deviceId?: string) {
        this.logger.log('Processing access control event', { 
            event, 
            deviceId,
            employeeNo: event.employeeNoString,
            cardNo: event.cardNo,
            accessResult: event.accessResult
        });

        // Create attendance record if access was granted
        if (event.accessResult === 'granted' && event.employeeNoString) {
            // TODO: Create attendance record
            this.logger.log('Access granted - creating attendance record', {
                employeeNo: event.employeeNoString,
                deviceId,
                timestamp: event.dateTime
            });
        }
    }

    private async handleFaceMatchEvent(event: any, deviceId?: string) {
        this.logger.log('Processing face match event', { 
            event, 
            deviceId,
            employeeNo: event.employeeNoString,
            similarity: event.similarity,
            matchResult: event.matchResult
        });

        // Process face recognition result
        if (event.matchResult === 'match' && event.employeeNoString) {
            this.logger.log('Face match successful', {
                employeeNo: event.employeeNoString,
                similarity: event.similarity,
                deviceId
            });
        }
    }

    private async handleCardReaderEvent(event: any, deviceId?: string) {
        this.logger.log('Processing card reader event', { 
            event, 
            deviceId,
            cardNo: event.cardNo,
            cardType: event.cardType,
            readerResult: event.readerResult
        });

        // Process card reader result
        if (event.readerResult === 'success' && event.cardNo) {
            this.logger.log('Card read successful', {
                cardNo: event.cardNo,
                cardType: event.cardType,
                deviceId
            });
        }
    }

    private async handleDoorStatusEvent(event: any, deviceId?: string) {
        this.logger.log('Processing door status event', { 
            event, 
            deviceId,
            doorStatus: event.doorStatus,
            doorId: event.doorId
        });

        // Process door status change
        this.logger.log('Door status changed', {
            doorStatus: event.doorStatus,
            doorId: event.doorId,
            deviceId
        });
    }
}