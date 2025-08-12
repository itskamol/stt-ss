import { ApiProperty } from '@nestjs/swagger';
import { EventType } from '@prisma/client';
import { IsDateString, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRawEventDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    eventType: keyof typeof EventType;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    timestamp?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    employeeId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    cardId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    biometricData?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    guestCredential?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsObject()
    additionalData?: Record<string, any>;
}

class DeviceForEventDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    name: string;
    @ApiProperty()
    type: string;
    @ApiProperty({ required: false })
    macAddress?: string;
}

export class DeviceEventLogResponseDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    deviceId: string;
    @ApiProperty()
    eventType: string;
    @ApiProperty({ required: false })
    metadata?: any;
    @ApiProperty({ required: false })
    rawPayloadUrl?: string;
    @ApiProperty()
    timestamp: Date;
    @ApiProperty()
    organizationId: string;
    @ApiProperty()
    isProcessed: boolean;
    @ApiProperty()
    createdAt: Date;
    @ApiProperty({ type: DeviceForEventDto, required: false })
    device?: DeviceForEventDto;
}

class EventsByTypeDto {
    @ApiProperty()
    eventType: string;
    @ApiProperty()
    count: number;
}

class EventsByDeviceDto {
    @ApiProperty()
    deviceId: string;
    @ApiProperty()
    deviceName: string;
    @ApiProperty()
    count: number;
}

export class EventStatsResponseDto {
    @ApiProperty()
    totalEvents: number;
    @ApiProperty({ type: [EventsByTypeDto] })
    eventsByType: EventsByTypeDto[];
    @ApiProperty({ type: [EventsByDeviceDto] })
    eventsByDevice: EventsByDeviceDto[];
}

export class EventLogFiltersDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    deviceId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    eventType?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    endDate?: string;
}
