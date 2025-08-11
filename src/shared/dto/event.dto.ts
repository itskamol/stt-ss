import { IsDateString, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRawEventDto {
    @IsString()
    @IsNotEmpty()
    eventType: string;

    @IsOptional()
    @IsDateString()
    timestamp?: string;

    @IsOptional()
    @IsString()
    employeeId?: string;

    @IsOptional()
    @IsString()
    cardId?: string;

    @IsOptional()
    @IsString()
    biometricData?: string;

    @IsOptional()
    @IsString()
    guestCredential?: string;

    @IsOptional()
    @IsObject()
    additionalData?: Record<string, any>;
}

export class DeviceEventLogResponseDto {
    id: string;
    deviceId: string;
    eventType: string;
    metadata?: any;
    rawPayloadUrl?: string;
    timestamp: Date;
    organizationId: string;
    isProcessed: boolean;
    createdAt: Date;
    device?: {
        id: string;
        name: string;
        type: string;
        macAddress?: string;
    };
}

export class EventStatsResponseDto {
    totalEvents: number;
    eventsByType: Array<{
        eventType: string;
        count: number;
    }>;
    eventsByDevice: Array<{
        deviceId: string;
        deviceName: string;
        count: number;
    }>;
}

export class EventLogFiltersDto {
    @IsOptional()
    @IsString()
    deviceId?: string;

    @IsOptional()
    @IsString()
    eventType?: string;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}
