import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIP, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { DeviceProtocol, DeviceType } from '@prisma/client';

export class SimplifiedDeviceCreationDto {
    @ApiProperty({
        description: 'The name of the device.',
        example: 'Main Entrance Door',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        description: 'The IP address of the device to scan.',
        example: '192.168.1.100',
    })
    @IsIP()
    host: string;

    @ApiProperty({
        description: 'The port number for device communication.',
        example: 80,
        default: 80,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(65535)
    port?: number = 80;

    @ApiProperty({
        description: 'The username for device authentication.',
        example: 'admin',
        required: false,
    })
    @IsOptional()
    @IsString()
    username?: string;

    @ApiProperty({
        description: 'The password for device authentication.',
        example: 'password123',
        required: false,
    })
    @IsOptional()
    @IsString()
    password?: string;

    @ApiProperty({
        description: 'The ID of the branch where the device is located.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    @IsNotEmpty()
    branchId: string;

    @ApiProperty({
        description: 'The communication protocol used by the device.',
        enum: DeviceProtocol,
        default: DeviceProtocol.HTTP,
        required: false,
    })
    @IsOptional()
    @IsEnum(DeviceProtocol)
    protocol?: DeviceProtocol = DeviceProtocol.HTTP;

    @ApiProperty({
        description: 'The type of the device.',
        enum: DeviceType,
        default: DeviceType.ACCESS_CONTROL,
        required: false,
    })
    @IsOptional()
    @IsEnum(DeviceType)
    type?: DeviceType = DeviceType.ACCESS_CONTROL;

    @ApiProperty({
        description: 'A description of the device.',
        example: 'Main entrance access control terminal',
        required: false,
    })
    @IsOptional()
    @IsString()
    description?: string;
}

export class NetworkScanResultDto {
    @ApiProperty({
        description: 'Indicates if the device was found on the network.',
        example: true,
    })
    found: boolean;

    @ApiProperty({
        description: 'The discovered device information.',
        required: false,
    })
    deviceInfo?: {
        name: string;
        manufacturer: string;
        model: string;
        firmware: string;
        macAddress: string;
        capabilities: string[];
        status: string;
    };

    @ApiProperty({
        description: 'Error message if device discovery failed.',
        required: false,
    })
    error?: string;

    @ApiProperty({
        description: 'The time when the scan was performed.',
        example: '2023-08-14T10:00:00.000Z',
    })
    scannedAt: Date;
}

export class PreScannedDeviceCreationDto extends SimplifiedDeviceCreationDto {
    @ApiProperty({
        description: 'The pre-scanned device information.',
        required: false,
    })
    @IsOptional()
    discoveredInfo?: {
        manufacturer: string;
        model: string;
        firmware: string;
        macAddress: string;
        deviceIdentifier: string;
    };
}