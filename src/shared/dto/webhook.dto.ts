import { ApiProperty } from '@nestjs/swagger';
import { EventType, ParameterFormatType } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUrl, Max, Min, isString } from 'class-validator';

export class CreateWebhookDto {
    @ApiProperty({ description: 'Webhook endpoint URL' })
    @IsString()
    url: string;

    @ApiProperty({ description: 'Host IP address or hostname' })
    @IsString()
    host: string;

    @ApiProperty({ description: 'Port number', minimum: 1, maximum: 65535 })
    @IsNumber()
    @Min(1)
    @Max(65535)
    port: number;

    @ApiProperty({
        description: 'Event types to subscribe to',
        type: [String],
        example: ['ACCESS_GRANTED', 'ACCESS_DENIED', 'ALARM']
    })
    @IsArray()
    @IsEnum(EventType, { each: true })
    eventTypes: EventType[];

    @ApiProperty({
        description: 'Protocol type',
        enum: ['HTTP', 'HTTPS'],
        default: 'HTTP'
    })
    @IsOptional()
    @IsEnum(['HTTP', 'HTTPS'])
    protocolType?: 'HTTP' | 'HTTPS';

    @ApiProperty({
        description: 'Parameter format type',
        enum: ParameterFormatType,
        default: ParameterFormatType.JSON
    })
    @IsOptional()
    @IsEnum(ParameterFormatType)
    parameterFormatType?: ParameterFormatType;
}

export class WebhookResponseDto {
    @ApiProperty({ description: 'Webhook ID' })
    id: string;

    @ApiProperty({ description: 'Host ID on device' })
    hostId: string;

    @ApiProperty({ description: 'Webhook URL' })
    url: string;

    @ApiProperty({ description: 'Host IP address' })
    host: string;

    @ApiProperty({ description: 'Port number' })
    port: number;

    @ApiProperty({ description: 'Event types', type: [String] })
    eventTypes: string[];

    @ApiProperty({ description: 'Protocol type' })
    protocolType: string;

    @ApiProperty({ description: 'Parameter format type' })
    parameterFormatType: string;

    @ApiProperty({ description: 'Is webhook active' })
    isActive: boolean;

    @ApiProperty({ description: 'Number of times webhook was triggered' })
    triggerCount: number;

    @ApiProperty({ description: 'Last triggered timestamp', required: false })
    lastTriggered?: Date;

    @ApiProperty({ description: 'Last error message', required: false })
    lastError?: string;

    @ApiProperty({ description: 'Creation timestamp' })
    createdAt: Date;
}

export class WebhookConfigurationResponseDto {
    @ApiProperty({ description: 'Device ID' })
    deviceId: string;

    @ApiProperty({ description: 'Device name' })
    deviceName: string;

    @ApiProperty({ description: 'List of webhooks', type: [WebhookResponseDto] })
    webhooks: WebhookResponseDto[];
}

export class WebhookEventDto {
    @ApiProperty({ description: 'Event type' })
    eventType: string;

    @ApiProperty({ description: 'Device ID' })
    deviceId?: string;

    @ApiProperty({ description: 'Timestamp' })
    timestamp: Date;

    @ApiProperty({ description: 'Event data' })
    data: any;

    @ApiProperty({ description: 'Employee number', required: false })
    employeeNo?: string;

    @ApiProperty({ description: 'Card number', required: false })
    cardNo?: string;

    @ApiProperty({ description: 'Access result', required: false })
    accessResult?: string;
}