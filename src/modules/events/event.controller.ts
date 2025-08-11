import {
    BadRequestException,
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpStatus,
    Post,
    UnauthorizedException,
} from '@nestjs/common';
import { EventService } from './event.service';
import { LoggerService } from '../../core/logger/logger.service';
import { CreateRawEventDto } from '../../shared/dto';
import { Public } from '../../shared/decorators';
import { DeviceAuthGuard } from '../../shared/guards/device-auth.guard';
import { UseGuards } from '@nestjs/common';

@Controller('api/v1/events')
@UseGuards(DeviceAuthGuard)
export class EventController {
    constructor(
        private readonly eventService: EventService,
        private readonly logger: LoggerService
    ) {}

    @Post('raw')
    @Public() // This endpoint uses DeviceAuthGuard instead of JWT
    @HttpCode(HttpStatus.ACCEPTED)
    async processRawEvent(
        @Body() createRawEventDto: CreateRawEventDto,
        @Headers('x-device-id') deviceId: string,
        @Headers('x-device-signature') signature: string,
        @Headers('x-idempotency-key') idempotencyKey?: string
    ): Promise<{ eventId: string; status: string; message: string }> {
        // Validate required headers
        if (!deviceId) {
            throw new BadRequestException('Device ID header is required');
        }

        if (!signature) {
            throw new UnauthorizedException('Device signature header is required');
        }

        // Generate idempotency key if not provided
        const finalIdempotencyKey =
            idempotencyKey || this.generateIdempotencyKey(deviceId, createRawEventDto);

        try {
            const eventId = await this.eventService.processRawEvent(
                createRawEventDto,
                deviceId,
                signature,
                finalIdempotencyKey
            );

            this.logger.log('Raw event processed successfully', {
                eventId,
                deviceId,
                eventType: createRawEventDto.eventType,
                idempotencyKey: finalIdempotencyKey,
            });

            return {
                eventId,
                status: 'accepted',
                message: 'Event queued for processing',
            };
        } catch (error) {
            this.logger.error('Failed to process raw event', error, {
                deviceId,
                eventType: createRawEventDto.eventType,
                idempotencyKey: finalIdempotencyKey,
            });

            if (error.message === 'DUPLICATE_EVENT') {
                return {
                    eventId: error.existingEventId,
                    status: 'duplicate',
                    message: 'Event already processed',
                };
            }

            throw error;
        }
    }

    private generateIdempotencyKey(deviceId: string, eventData: CreateRawEventDto): string {
        const timestamp = eventData.timestamp || new Date().toISOString();
        const dataHash = this.hashEventData(eventData);
        return `${deviceId}-${timestamp}-${dataHash}`;
    }

    private hashEventData(eventData: CreateRawEventDto): string {
        const crypto = require('crypto');
        const dataString = JSON.stringify({
            eventType: eventData.eventType,
            employeeId: eventData.employeeId,
            cardId: eventData.cardId,
            biometricData: eventData.biometricData,
        });
        return crypto.createHash('md5').update(dataString).digest('hex').substring(0, 8);
    }
}
