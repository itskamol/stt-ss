import * as crypto from 'crypto';
import {
    BadRequestException,
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpStatus,
    Post,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiExtraModels,
    ApiHeader,
    ApiOperation,
    ApiResponse,
    ApiTags,
    getSchemaPath,
} from '@nestjs/swagger';
import { EventService } from './event.service';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
    CreateRawEventDto,
    ProcessedEventResponseDto,
} from '@/shared/dto';
import { Public } from '@/shared/decorators';
import { DeviceAuthGuard } from '@/shared/guards/device-auth.guard';
import { ApiOkResponseData } from '@/shared/utils';

@ApiTags('Events')
@Controller('events')
@UseGuards(DeviceAuthGuard)
@ApiExtraModels(ApiSuccessResponse, ProcessedEventResponseDto)
export class EventController {
    constructor(private readonly eventService: EventService) {}

    @Post('raw')
    @Public() // This endpoint uses DeviceAuthGuard instead of JWT
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({ summary: 'Process a raw event from a device' })
    @ApiHeader({ name: 'x-device-id', description: 'Unique ID of the device', required: true })
    @ApiHeader({
        name: 'x-device-signature',
        description: 'HMAC signature of the payload',
        required: true,
    })
    @ApiHeader({
        name: 'x-idempotency-key',
        description: 'Idempotency key for preventing duplicate requests',
        required: false,
    })
    @ApiResponse({
        status: 202,
        description: 'Event accepted for processing.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(ProcessedEventResponseDto) },
                    },
                },
            ],
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Bad request (e.g., missing headers).',
        type: ApiErrorResponse,
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized (e.g., invalid signature).',
        type: ApiErrorResponse,
    })
    @ApiResponse({
        status: 200,
        description: 'Duplicate event, already processed.',
        type: ApiSuccessResponse,
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(ProcessedEventResponseDto) },
                    },
                },
            ],
        },
    })
    async processRawEvent(
        @Body() createRawEventDto: CreateRawEventDto,
        @Headers('x-device-id') deviceId: string,
        @Headers('x-device-signature') signature: string,
        @Headers('x-idempotency-key') idempotencyKey?: string
    ): Promise<ProcessedEventResponseDto> {
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

            return {
                eventId,
                status: 'accepted',
                message: 'Event queued for processing',
            };
        } catch (error) {
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
        const dataString = JSON.stringify({
            eventType: eventData.eventType,
            employeeId: eventData.employeeId,
            cardId: eventData.cardId,
            biometricData: eventData.biometricData,
        });
        return crypto.createHash('md5').update(dataString).digest('hex').substring(0, 8);
    }
}
