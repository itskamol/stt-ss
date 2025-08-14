import { ApiProperty } from '@nestjs/swagger';
import { EventType } from '@prisma/client';
import { IsDateString, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRawEventDto {
    @ApiProperty({
        description: 'The type of the event.',
        enum: EventType,
        example: EventType.ACCESS_GRANTED,
    })
    @IsString()
    @IsNotEmpty()
    eventType: keyof typeof EventType;

    @ApiProperty({
        description: 'The timestamp of the event.',
        example: '2023-08-14T10:00:00.000Z',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    timestamp?: string;

    @ApiProperty({
        description: 'The ID of the employee associated with the event.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    employeeId?: string;

    @ApiProperty({
        description: 'The ID of the card used.',
        example: '12345678',
        required: false,
    })
    @IsOptional()
    @IsString()
    cardId?: string;

    @ApiProperty({
        description: 'Biometric data associated with the event (e.g., fingerprint template).',
        example: 'base64-encoded-data',
        required: false,
    })
    @IsOptional()
    @IsString()
    biometricData?: string;

    @ApiProperty({
        description: 'The credential used by a guest.',
        example: 'QR_CODE_DATA',
        required: false,
    })
    @IsOptional()
    @IsString()
    guestCredential?: string;

    @ApiProperty({
        description: 'Additional data associated with the event.',
        example: { door: 'Main Entrance', result: 'Success' },
        required: false,
    })
    @IsOptional()
    @IsObject()
    additionalData?: Record<string, any>;
}

class DeviceForEventDto {
    @ApiProperty({
        description: 'The ID of the device.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The name of the device.',
        example: 'Main Entrance',
    })
    name: string;

    @ApiProperty({
        description: 'The type of the device.',
        example: 'ACCESS_CONTROL',
    })
    type: string;

    @ApiProperty({
        description: 'The MAC address of the device.',
        example: '00:1A:2B:3C:4D:5E',
        required: false,
    })
    macAddress?: string;
}

export class DeviceEventLogResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the event log.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The ID of the device that generated the event.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    deviceId: string;

    @ApiProperty({
        description: 'The type of the event.',
        example: 'ACCESS_GRANTED',
    })
    eventType: string;

    @ApiProperty({
        description: 'Metadata associated with the event.',
        example: { employeeId: '123' },
        required: false,
    })
    metadata?: any;

    @ApiProperty({
        description: 'A URL to the raw payload of the event.',
        example: 'https://storage.googleapis.com/events/raw-payload.json',
        required: false,
    })
    rawPayloadUrl?: string;

    @ApiProperty({
        description: 'The timestamp of the event.',
        example: '2023-08-14T10:00:00.000Z',
    })
    timestamp: Date;

    @ApiProperty({
        description: 'The ID of the organization.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    organizationId: string;

    @ApiProperty({
        description: 'Indicates if the event has been processed.',
        example: true,
    })
    isProcessed: boolean;

    @ApiProperty({
        description: 'The date and time the event was logged.',
        example: '2023-08-14T10:00:01.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The device that generated the event.',
        type: DeviceForEventDto,
        required: false,
    })
    device?: DeviceForEventDto;
}

class EventsByTypeDto {
    @ApiProperty({
        description: 'The type of event.',
        example: 'ACCESS_GRANTED',
    })
    eventType: string;

    @ApiProperty({
        description: 'The number of events of this type.',
        example: 150,
    })
    count: number;
}

class EventsByDeviceDto {
    @ApiProperty({
        description: 'The ID of the device.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    deviceId: string;

    @ApiProperty({
        description: 'The name of the device.',
        example: 'Main Entrance',
    })
    deviceName: string;

    @ApiProperty({
        description: 'The number of events from this device.',
        example: 200,
    })
    count: number;
}

export class EventStatsResponseDto {
    @ApiProperty({
        description: 'The total number of events.',
        example: 1234,
    })
    totalEvents: number;

    @ApiProperty({
        description: 'A breakdown of events by type.',
        type: [EventsByTypeDto],
    })
    eventsByType: EventsByTypeDto[];

    @ApiProperty({
        description: 'A breakdown of events by device.',
        type: [EventsByDeviceDto],
    })
    eventsByDevice: EventsByDeviceDto[];
}

export class EventLogFiltersDto {
    @ApiProperty({
        description: 'Filter by device ID.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    deviceId?: string;

    @ApiProperty({
        description: 'Filter by event type.',
        example: 'ACCESS_GRANTED',
        required: false,
    })
    @IsOptional()
    @IsString()
    eventType?: string;

    @ApiProperty({
        description: 'The start date for the filter range.',
        example: '2023-08-01',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiProperty({
        description: 'The end date for the filter range.',
        example: '2023-08-31',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;
}
