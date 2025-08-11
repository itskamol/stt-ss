import { IsBoolean, IsIP, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDeviceDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @IsString()
    @IsNotEmpty()
    type: string;

    @IsString()
    @IsNotEmpty()
    branchId: string;

    @IsOptional()
    @IsString()
    deviceIdentifier?: string;

    @IsOptional()
    @IsIP()
    ipAddress?: string;

    @IsOptional()
    @IsString()
    macAddress?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    model?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateDeviceDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    type?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    branchId?: string;

    @IsOptional()
    @IsString()
    deviceIdentifier?: string;

    @IsOptional()
    @IsIP()
    ipAddress?: string;

    @IsOptional()
    @IsString()
    macAddress?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    model?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    lastSeen?: Date;
}

export class DeviceResponseDto {
    id: string;
    organizationId: string;
    branchId: string;
    name: string;
    type: string;
    deviceIdentifier?: string;
    ipAddress?: string;
    macAddress?: string;
    model?: string;
    description?: string;
    status: string;
    isActive?: boolean;
    lastSeenAt?: Date;
    lastSeen?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export class DeviceCommandDto {
    @IsString()
    @IsNotEmpty()
    command: 'unlock_door' | 'lock_door' | 'reboot' | 'sync_users' | 'update_firmware';

    @IsOptional()
    parameters?: Record<string, any>;

    @IsOptional()
    timeout?: number;
}

export class DeviceDiscoveryResponseDto {
    totalDiscovered: number;
    newDevices: number;
    existingDevices: number;
    devices: Array<{
        identifier: string;
        name: string;
        type: 'card_reader' | 'biometric' | 'qr_scanner' | 'facial_recognition';
        ipAddress?: string;
        status: 'error' | 'online' | 'offline' | 'maintenance';
    }>;
}
