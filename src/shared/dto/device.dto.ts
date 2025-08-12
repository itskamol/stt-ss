import { ApiProperty } from '@nestjs/swagger';
import { DeviceProtocol, DeviceStatus, DeviceType } from '@prisma/client';
import {
    IsBoolean,
    IsEnum,
    IsIP,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

export class CreateDeviceDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty({ enum: DeviceType })
    @IsEnum(DeviceType)
    @IsNotEmpty()
    type: DeviceType;

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
    username?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    password?: string;

    @ApiProperty({ required: false, default: 80 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(65535)
    port?: number;

    @ApiProperty({ enum: DeviceProtocol, default: DeviceProtocol.HTTP })
    @IsOptional()
    @IsEnum(DeviceProtocol)
    protocol?: DeviceProtocol;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    macAddress?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    manufacturer?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    model?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    firmware?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ enum: DeviceStatus, default: DeviceStatus.OFFLINE })
    @IsOptional()
    @IsEnum(DeviceStatus)
    status?: DeviceStatus;

    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({ required: false, default: 5000 })
    @IsOptional()
    @IsNumber()
    @Min(1000)
    @Max(60000)
    timeout?: number;

    @ApiProperty({ required: false, default: 3 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    retryAttempts?: number;

    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @IsBoolean()
    keepAlive?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    lastSeen?: Date;
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
    @IsEnum(DeviceType)
    type?: DeviceType;

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
    username?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    password?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(65535)
    port?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEnum(DeviceProtocol)
    protocol?: DeviceProtocol;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    macAddress?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    manufacturer?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    model?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    firmware?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEnum(DeviceStatus)
    status?: DeviceStatus;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Min(1000)
    @Max(60000)
    timeout?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    retryAttempts?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    keepAlive?: boolean;

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
    @ApiProperty({ required: false })
    departmentId?: string;
    @ApiProperty()
    name: string;
    @ApiProperty({ required: false })
    deviceIdentifier?: string;
    @ApiProperty()
    type: DeviceType;
    @ApiProperty({ required: false })
    ipAddress?: string;
    @ApiProperty({ required: false })
    username?: string;
    @ApiProperty({ required: false })
    port?: number;
    @ApiProperty()
    protocol: DeviceProtocol;
    @ApiProperty({ required: false })
    macAddress?: string;
    @ApiProperty({ required: false })
    manufacturer?: string;
    @ApiProperty({ required: false })
    model?: string;
    @ApiProperty({ required: false })
    firmware?: string;
    @ApiProperty({ required: false })
    description?: string;
    @ApiProperty()
    status: DeviceStatus;
    @ApiProperty()
    isActive: boolean;
    @ApiProperty({ required: false })
    lastSeen?: Date;
    @ApiProperty()
    timeout: number;
    @ApiProperty()
    retryAttempts: number;
    @ApiProperty()
    keepAlive: boolean;
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
    @ApiProperty({ enum: Object.values(DeviceType) })
    type: DeviceType;
    @ApiProperty({ required: false })
    ipAddress?: string;
    @ApiProperty({ enum: Object.values(DeviceStatus) })
    status: DeviceStatus;
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

// Device Configuration DTOs
export class CreateDeviceConfigurationDto {
    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @IsBoolean()
    networkDhcp?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsIP()
    networkStaticIp?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    networkSubnet?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsIP()
    networkGateway?: string;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsString({ each: true })
    networkDns?: string[];

    @ApiProperty({ required: false, default: 'UTC' })
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    ntpServer?: string;

    @ApiProperty({ required: false, default: 60 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(1440)
    syncInterval?: number;

    @ApiProperty({ required: false, default: 1 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    defaultAccessLevel?: number;

    @ApiProperty({ required: false, default: false })
    @IsOptional()
    @IsBoolean()
    allowUnknownCards?: boolean;

    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @IsBoolean()
    offlineMode?: boolean;

    @ApiProperty({ required: false, default: 1000 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10000)
    maxUsers?: number;

    @ApiProperty({ required: false, default: 5 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(9)
    biometricThreshold?: number;

    @ApiProperty({ required: false, default: false })
    @IsOptional()
    @IsBoolean()
    duressFingerEnabled?: boolean;

    @ApiProperty({ required: false, default: false })
    @IsOptional()
    @IsBoolean()
    antiPassbackEnabled?: boolean;

    @ApiProperty({ required: false, default: 1000 })
    @IsOptional()
    @IsNumber()
    @Min(100)
    @Max(10000)
    eventBufferSize?: number;

    @ApiProperty({ required: false, default: 30 })
    @IsOptional()
    @IsNumber()
    @Min(5)
    @Max(300)
    uploadInterval?: number;

    @ApiProperty({ required: false, default: 3 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    retryAttempts?: number;
}

export class UpdateDeviceConfigurationDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    networkDhcp?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsIP()
    networkStaticIp?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    networkSubnet?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsIP()
    networkGateway?: string;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsString({ each: true })
    networkDns?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    ntpServer?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(1440)
    syncInterval?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    defaultAccessLevel?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    allowUnknownCards?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    offlineMode?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10000)
    maxUsers?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(9)
    biometricThreshold?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    duressFingerEnabled?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    antiPassbackEnabled?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Min(100)
    @Max(10000)
    eventBufferSize?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Min(5)
    @Max(300)
    uploadInterval?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    retryAttempts?: number;
}

// Device Template DTOs
export class CreateDeviceTemplateDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    manufacturer: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    model: string;

    @ApiProperty({ required: false })
    @IsOptional()
    defaultSettings?: Record<string, any>;

    @ApiProperty({ required: false })
    @IsOptional()
    endpoints?: Record<string, string>;

    @ApiProperty({ required: false })
    @IsOptional()
    capabilities?: Record<string, boolean>;

    @ApiProperty({ required: false })
    @IsOptional()
    protocol?: Record<string, any>;
}

export class UpdateDeviceTemplateDto {
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
    manufacturer?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    model?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    defaultSettings?: Record<string, any>;

    @ApiProperty({ required: false })
    @IsOptional()
    endpoints?: Record<string, string>;

    @ApiProperty({ required: false })
    @IsOptional()
    capabilities?: Record<string, boolean>;

    @ApiProperty({ required: false })
    @IsOptional()
    protocol?: Record<string, any>;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

// Device Control DTOs
export class DeviceControlDto {
    @ApiProperty({
        enum: [
            'open_door',
            'lock_door',
            'reboot',
            'shutdown',
            'sync_time',
            'sync_employees',
            'update_firmware',
            'restart_services',
        ],
    })
    @IsEnum([
        'open_door',
        'lock_door',
        'reboot',
        'shutdown',
        'sync_time',
        'sync_employees',
        'update_firmware',
        'restart_services',
    ])
    @IsNotEmpty()
    action: string;

    @ApiProperty({ required: false })
    @IsOptional()
    parameters?: Record<string, any>;

    @ApiProperty({ required: false, default: 30 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(300)
    timeout?: number;
}

export class DeviceSyncEmployeesDto {
    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsString({ each: true })
    employeeIds?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    departmentId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    branchId?: string;

    @ApiProperty({ required: false, default: false })
    @IsOptional()
    @IsBoolean()
    forceSync?: boolean;

    @ApiProperty({ required: false, default: false })
    @IsOptional()
    @IsBoolean()
    removeMissing?: boolean;
}
