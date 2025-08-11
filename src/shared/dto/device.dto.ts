import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIP, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDeviceDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    type: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    branchId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    deviceIdentifier?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsIP()
    ipAddress?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    macAddress?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    model?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateDeviceDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    type?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    branchId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    deviceIdentifier?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsIP()
    ipAddress?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    macAddress?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    model?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    lastSeen?: Date;
}

export class DeviceResponseDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    organizationId: string;
    @ApiProperty()
    branchId: string;
    @ApiProperty()
    name: string;
    @ApiProperty()
    type: string;
    @ApiProperty({ required: false })
    deviceIdentifier?: string;
    @ApiProperty({ required: false })
    ipAddress?: string;
    @ApiProperty({ required: false })
    macAddress?: string;
    @ApiProperty({ required: false })
    model?: string;
    @ApiProperty({ required: false })
    description?: string;
    @ApiProperty()
    status: string;
    @ApiProperty({ required: false })
    isActive?: boolean;
    @ApiProperty({ required: false })
    lastSeenAt?: Date;
    @ApiProperty({ required: false })
    lastSeen?: Date;
    @ApiProperty()
    createdAt: Date;
    @ApiProperty()
    updatedAt: Date;
}

export class DeviceCommandDto {
    @ApiProperty({ enum: ['unlock_door', 'lock_door', 'reboot', 'sync_users', 'update_firmware'] })
    @IsString()
    @IsNotEmpty()
    command: 'unlock_door' | 'lock_door' | 'reboot' | 'sync_users' | 'update_firmware';

    @ApiProperty({ required: false })
    @IsOptional()
    parameters?: Record<string, any>;

    @ApiProperty({ required: false })
    @IsOptional()
    timeout?: number;
}

class DiscoveredDeviceDto {
    @ApiProperty()
    identifier: string;
    @ApiProperty()
    name: string;
    @ApiProperty({ enum: ['card_reader', 'biometric', 'qr_scanner', 'facial_recognition'] })
    type: 'card_reader' | 'biometric' | 'qr_scanner' | 'facial_recognition';
    @ApiProperty({ required: false })
    ipAddress?: string;
    @ApiProperty({ enum: ['error', 'online', 'offline', 'maintenance'] })
    status: 'error' | 'online' | 'offline' | 'maintenance';
}

export class DeviceDiscoveryResponseDto {
    @ApiProperty()
    totalDiscovered: number;
    @ApiProperty()
    newDevices: number;
    @ApiProperty()
    existingDevices: number;
    @ApiProperty({ type: [DiscoveredDeviceDto] })
    devices: DiscoveredDeviceDto[];
}
