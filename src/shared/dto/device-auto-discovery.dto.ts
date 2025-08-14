import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceProtocol } from '@prisma/client';
import {
    IsEnum,
    IsIP,
    IsNumber,
    IsOptional,
    IsPort,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class DeviceAutoDiscoveryDto {
    @ApiProperty({
        description: 'Device name',
        example: 'Main Entrance Device',
        minLength: 2,
        maxLength: 100,
    })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name: string;

    @ApiProperty({
        description: 'Device IP address',
        example: '192.168.1.100',
    })
    @IsIP()
    host: string;

    @ApiPropertyOptional({
        description: 'Device brand (hikvision)',
        example: 'hikvision',
    })
    @IsOptional()
    @IsString()
    brand?: string;

    @ApiProperty({
        description: 'Device port',
        example: 80,
        minimum: 1,
        maximum: 65535,
    })
    @IsNumber()
    port: number;

    @ApiProperty({
        description: 'Device username',
        example: 'admin',
        minLength: 1,
        maxLength: 50,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    username: string;

    @ApiProperty({
        description: 'Device password',
        example: 'password123',
        minLength: 1,
        maxLength: 100,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    password: string;

    @ApiProperty({
        description: 'Branch ID where the device is located',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    branchId: string;

    @ApiProperty({
        description: 'Organization ID',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    organizationId: string;

    @ApiPropertyOptional({
        description: 'Department ID (optional)',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsOptional()
    @IsString()
    departmentId?: string;

    @ApiPropertyOptional({
        description: 'Protocol to use for communication',
        enum: DeviceProtocol,
        default: DeviceProtocol.HTTP,
        example: DeviceProtocol.HTTP,
    })
    @IsOptional()
    @IsEnum(DeviceProtocol)
    protocol?: DeviceProtocol;

    @ApiPropertyOptional({
        description: 'Device description',
        example: 'Access control device at main entrance',
        maxLength: 500,
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;
}

export class DeviceDiscoveryTestDto {
    @ApiProperty({
        description: 'Device IP address',
        example: '192.168.1.100',
    })
    @IsIP()
    host: string;

    @ApiProperty({
        description: 'Device port',
        example: 80,
        minimum: 1,
        maximum: 65535,
    })
    @IsNumber()
    port: number;

    @ApiProperty({
        description: 'Device username',
        example: 'admin',
        minLength: 1,
        maxLength: 50,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    username: string;

    @ApiProperty({
        description: 'Device brand',
        example: 'hikvision',
    })
    @IsString()
    brand: string;

    @ApiProperty({
        description: 'Device password',
        example: 'password123',
        minLength: 1,
        maxLength: 100,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    password: string;

    @ApiPropertyOptional({
        description: 'Protocol to use for communication',
        enum: DeviceProtocol,
        default: DeviceProtocol.HTTP,
        example: DeviceProtocol.HTTP,
    })
    @IsOptional()
    @IsEnum(DeviceProtocol)
    protocol?: DeviceProtocol;
}

export class DeviceAutoDiscoveryResponseDto {
    @ApiProperty({
        description: 'Whether the device is reachable',
        example: true,
    })
    connected: boolean;

    @ApiProperty({
        description: 'Device manufacturer',
        example: 'Hikvision',
    })
    manufacturer: string;

    @ApiProperty({
        description: 'Device model',
        example: 'DS-K1T341AMF',
    })
    model: string;

    @ApiProperty({
        description: 'Device firmware version',
        example: 'V1.2.3 build 20240101',
    })
    firmware: string;

    @ApiPropertyOptional({
        description: 'Device MAC address',
        example: '00:11:22:33:44:55',
    })
    macAddress?: string;

    @ApiProperty({
        description: 'Device unique identifier',
        example: 'HK_192168001100_1234567890',
    })
    deviceIdentifier: string;

    @ApiProperty({
        description: 'Device capabilities',
        example: ['ACCESS_CONTROL', 'FACE_RECOGNITION', 'CARD_READER'],
        type: [String],
    })
    capabilities: string[];

    @ApiProperty({
        description: 'Device status',
        example: 'ONLINE',
    })
    status: string;

    @ApiProperty({
        description: 'When the discovery was performed',
        example: '2024-01-15T10:30:00Z',
    })
    discoveredAt: Date;
}
