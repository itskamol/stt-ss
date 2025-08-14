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
    @ApiProperty({
        description: 'The name of the device.',
        example: 'Main Entrance Door',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty({
        description: 'The type of the device.',
        enum: DeviceType,
        example: DeviceType.ACCESS_CONTROL,
    })
    @IsEnum(DeviceType)
    @IsNotEmpty()
    type: DeviceType;

    @ApiProperty({
        description: 'The ID of the branch where the device is located.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    @IsNotEmpty()
    branchId: string;

    @ApiProperty({
        description: 'The unique identifier for the device (e.g., serial number).',
        example: 'SN123456789',
        required: false,
    })
    @IsOptional()
    @IsString()
    deviceIdentifier?: string;

    @ApiProperty({
        description: 'The IP address of the device.',
        example: '192.168.1.100',
        required: false,
    })
    @IsOptional()
    @IsIP()
    ipAddress?: string;

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
        description: 'The port number for device communication.',
        example: 80,
        default: 80,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(65535)
    port?: number;

    @ApiProperty({
        description: 'The communication protocol used by the device.',
        enum: DeviceProtocol,
        default: DeviceProtocol.HTTP,
        example: DeviceProtocol.HTTP,
        required: false,
    })
    @IsOptional()
    @IsEnum(DeviceProtocol)
    protocol?: DeviceProtocol;

    @ApiProperty({
        description: 'The MAC address of the device.',
        example: '00:1A:2B:3C:4D:5E',
        required: false,
    })
    @IsOptional()
    @IsString()
    macAddress?: string;

    @ApiProperty({
        description: 'The manufacturer of the device.',
        example: 'Hikvision',
        required: false,
    })
    @IsOptional()
    @IsString()
    manufacturer?: string;

    @ApiProperty({
        description: 'The model of the device.',
        example: 'DS-K1T671M',
        maxLength: 100,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    model?: string;

    @ApiProperty({
        description: 'The firmware version of the device.',
        example: 'V1.2.3',
        required: false,
    })
    @IsOptional()
    @IsString()
    firmware?: string;

    @ApiProperty({
        description: 'A description of the device.',
        example: 'Main entrance access control terminal',
        required: false,
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        description: 'The current status of the device.',
        enum: DeviceStatus,
        default: DeviceStatus.OFFLINE,
        example: DeviceStatus.ONLINE,
        required: false,
    })
    @IsOptional()
    @IsEnum(DeviceStatus)
    status?: DeviceStatus;

    @ApiProperty({
        description: 'Indicates if the device is active.',
        default: true,
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({
        description: 'The timeout for device communication in milliseconds.',
        default: 5000,
        example: 5000,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1000)
    @Max(60000)
    timeout?: number;

    @ApiProperty({
        description: 'The number of retry attempts for failed communications.',
        default: 3,
        example: 3,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    retryAttempts?: number;

    @ApiProperty({
        description: 'Indicates if keep-alive is enabled for the device.',
        default: true,
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    keepAlive?: boolean;

    @ApiProperty({
        description: 'The last time the device was seen online.',
        example: '2023-08-14T10:00:00.000Z',
        required: false,
    })
    @IsOptional()
    lastSeen?: Date;
}

export class UpdateDeviceDto {
    @ApiProperty({
        description: 'The name of the device.',
        example: 'Main Entrance Door',
        maxLength: 100,
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name?: string;

    @ApiProperty({
        description: 'The type of the device.',
        enum: DeviceType,
        example: DeviceType.ACCESS_CONTROL,
        required: false,
    })
    @IsOptional()
    @IsEnum(DeviceType)
    type?: DeviceType;

    @ApiProperty({
        description: 'The ID of the branch where the device is located.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    branchId?: string;

    @ApiProperty({
        description: 'The unique identifier for the device (e.g., serial number).',
        example: 'SN123456789',
        required: false,
    })
    @IsOptional()
    @IsString()
    deviceIdentifier?: string;

    @ApiProperty({
        description: 'The IP address of the device.',
        example: '192.168.1.100',
        required: false,
    })
    @IsOptional()
    @IsIP()
    ipAddress?: string;

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
        description: 'The port number for device communication.',
        example: 80,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(65535)
    port?: number;

    @ApiProperty({
        description: 'The communication protocol used by the device.',
        enum: DeviceProtocol,
        example: DeviceProtocol.HTTP,
        required: false,
    })
    @IsOptional()
    @IsEnum(DeviceProtocol)
    protocol?: DeviceProtocol;

    @ApiProperty({
        description: 'The MAC address of the device.',
        example: '00:1A:2B:3C:4D:5E',
        required: false,
    })
    @IsOptional()
    @IsString()
    macAddress?: string;

    @ApiProperty({
        description: 'The manufacturer of the device.',
        example: 'Hikvision',
        required: false,
    })
    @IsOptional()
    @IsString()
    manufacturer?: string;

    @ApiProperty({
        description: 'The model of the device.',
        example: 'DS-K1T671M',
        maxLength: 100,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    model?: string;

    @ApiProperty({
        description: 'The firmware version of the device.',
        example: 'V1.2.3',
        required: false,
    })
    @IsOptional()
    @IsString()
    firmware?: string;

    @ApiProperty({
        description: 'A description of the device.',
        example: 'Main entrance access control terminal',
        required: false,
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        description: 'The current status of the device.',
        enum: DeviceStatus,
        example: DeviceStatus.ONLINE,
        required: false,
    })
    @IsOptional()
    @IsEnum(DeviceStatus)
    status?: DeviceStatus;

    @ApiProperty({
        description: 'Indicates if the device is active.',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({
        description: 'The timeout for device communication in milliseconds.',
        example: 5000,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1000)
    @Max(60000)
    timeout?: number;

    @ApiProperty({
        description: 'The number of retry attempts for failed communications.',
        example: 3,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    retryAttempts?: number;

    @ApiProperty({
        description: 'Indicates if keep-alive is enabled for the device.',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    keepAlive?: boolean;

    @ApiProperty({
        description: 'The last time the device was seen online.',
        example: '2023-08-14T10:00:00.000Z',
        required: false,
    })
    @IsOptional()
    lastSeen?: Date;
}

export class DeviceResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the device.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The ID of the organization this device belongs to.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    organizationId: string;

    @ApiProperty({
        description: 'The ID of the branch where the device is located.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    branchId: string;

    @ApiProperty({
        description: 'The ID of the department where the device is located.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    departmentId?: string;

    @ApiProperty({
        description: 'The name of the device.',
        example: 'Main Entrance Door',
    })
    name: string;

    @ApiProperty({
        description: 'The unique identifier for the device (e.g., serial number).',
        example: 'SN123456789',
        required: false,
    })
    deviceIdentifier?: string;

    @ApiProperty({
        description: 'The type of the device.',
        enum: DeviceType,
        example: DeviceType.ACCESS_CONTROL,
    })
    type: DeviceType;

    @ApiProperty({
        description: 'The IP address of the device.',
        example: '192.168.1.100',
        required: false,
    })
    ipAddress?: string;

    @ApiProperty({
        description: 'The username for device authentication.',
        example: 'admin',
        required: false,
    })
    username?: string;

    @ApiProperty({
        description: 'The port number for device communication.',
        example: 80,
        required: false,
    })
    port?: number;

    @ApiProperty({
        description: 'The communication protocol used by the device.',
        enum: DeviceProtocol,
        example: DeviceProtocol.HTTP,
    })
    protocol: DeviceProtocol;

    @ApiProperty({
        description: 'The MAC address of the device.',
        example: '00:1A:2B:3C:4D:5E',
        required: false,
    })
    macAddress?: string;

    @ApiProperty({
        description: 'The manufacturer of the device.',
        example: 'Hikvision',
        required: false,
    })
    manufacturer?: string;

    @ApiProperty({
        description: 'The model of the device.',
        example: 'DS-K1T671M',
        required: false,
    })
    model?: string;

    @ApiProperty({
        description: 'The firmware version of the device.',
        example: 'V1.2.3',
        required: false,
    })
    firmware?: string;

    @ApiProperty({
        description: 'A description of the device.',
        example: 'Main entrance access control terminal',
        required: false,
    })
    description?: string;

    @ApiProperty({
        description: 'The current status of the device.',
        enum: DeviceStatus,
        example: DeviceStatus.ONLINE,
    })
    status: DeviceStatus;

    @ApiProperty({
        description: 'Indicates if the device is active.',
        example: true,
    })
    isActive: boolean;

    @ApiProperty({
        description: 'The last time the device was seen online.',
        example: '2023-08-14T10:00:00.000Z',
        required: false,
    })
    lastSeen?: Date;

    @ApiProperty({
        description: 'The timeout for device communication in milliseconds.',
        example: 5000,
    })
    timeout: number;

    @ApiProperty({
        description: 'The number of retry attempts for failed communications.',
        example: 3,
    })
    retryAttempts: number;

    @ApiProperty({
        description: 'Indicates if keep-alive is enabled for the device.',
        example: true,
    })
    keepAlive: boolean;

    @ApiProperty({
        description: 'The date and time when the device was created.',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time when the device was last updated.',
        example: '2023-08-14T10:00:00.000Z',
    })
    updatedAt: Date;
}

export class DeviceCommandDto {
    @ApiProperty({
        description: 'The command to be executed on the device.',
        enum: ['unlock_door', 'lock_door', 'reboot', 'sync_users', 'update_firmware'],
        example: 'unlock_door',
    })
    @IsString()
    @IsNotEmpty()
    command: 'unlock_door' | 'lock_door' | 'reboot' | 'sync_users' | 'update_firmware';

    @ApiProperty({
        description: 'Additional parameters for the command.',
        example: { duration: 5 },
        required: false,
    })
    @IsOptional()
    parameters?: Record<string, any>;

    @ApiProperty({
        description: 'The timeout for the command in seconds.',
        example: 10,
        required: false,
    })
    @IsOptional()
    timeout?: number;
}

class DiscoveredDeviceDto {
    @ApiProperty({
        description: 'The unique identifier of the discovered device.',
        example: 'SN123456789',
    })
    identifier: string;

    @ApiProperty({
        description: 'The name of the discovered device.',
        example: 'New Device',
    })
    name: string;

    @ApiProperty({
        description: 'The type of the discovered device.',
        enum: Object.values(DeviceType),
        example: DeviceType.ACCESS_CONTROL,
    })
    type: DeviceType;

    @ApiProperty({
        description: 'The IP address of the discovered device.',
        example: '192.168.1.101',
        required: false,
    })
    ipAddress?: string;

    @ApiProperty({
        description: 'The status of the discovered device.',
        enum: Object.values(DeviceStatus),
        example: DeviceStatus.ONLINE,
    })
    status: DeviceStatus;
}

export class DeviceDiscoveryResponseDto {
    @ApiProperty({
        description: 'The total number of devices discovered on the network.',
        example: 5,
    })
    totalDiscovered: number;

    @ApiProperty({
        description: 'The number of new devices discovered.',
        example: 2,
    })
    newDevices: number;

    @ApiProperty({
        description: 'The number of existing devices that were re-discovered.',
        example: 3,
    })
    existingDevices: number;

    @ApiProperty({
        description: 'A list of the discovered devices.',
        type: [DiscoveredDeviceDto],
    })
    devices: DiscoveredDeviceDto[];
}

// Device Configuration DTOs
export class CreateDeviceConfigurationDto {
    @ApiProperty({
        description: 'Enable or disable DHCP for the device network configuration.',
        default: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    networkDhcp?: boolean;

    @ApiProperty({
        description: 'The static IP address for the device.',
        example: '192.168.1.100',
        required: false,
    })
    @IsOptional()
    @IsIP()
    networkStaticIp?: string;

    @ApiProperty({
        description: 'The subnet mask for the device.',
        example: '255.255.255.0',
        required: false,
    })
    @IsOptional()
    @IsString()
    networkSubnet?: string;

    @ApiProperty({
        description: 'The gateway for the device.',
        example: '192.168.1.1',
        required: false,
    })
    @IsOptional()
    @IsIP()
    networkGateway?: string;

    @ApiProperty({
        description: 'A list of DNS servers.',
        example: ['8.8.8.8', '8.8.4.4'],
        required: false,
        type: [String],
    })
    @IsOptional()
    @IsString({ each: true })
    networkDns?: string[];

    @ApiProperty({
        description: 'The timezone for the device.',
        example: 'America/New_York',
        default: 'UTC',
        required: false,
    })
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiProperty({
        description: 'The NTP server for time synchronization.',
        example: 'pool.ntp.org',
        required: false,
    })
    @IsOptional()
    @IsString()
    ntpServer?: string;

    @ApiProperty({
        description: 'The interval for data synchronization in minutes.',
        example: 60,
        default: 60,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(1440)
    syncInterval?: number;

    @ApiProperty({
        description: 'The default access level for new users.',
        example: 1,
        default: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    defaultAccessLevel?: number;

    @ApiProperty({
        description: 'Allow access for unknown cards.',
        default: false,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    allowUnknownCards?: boolean;

    @ApiProperty({
        description: 'Enable offline mode for the device.',
        default: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    offlineMode?: boolean;

    @ApiProperty({
        description: 'The maximum number of users the device can store.',
        example: 1000,
        default: 1000,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10000)
    maxUsers?: number;

    @ApiProperty({
        description: 'The biometric verification threshold (1-9).',
        example: 5,
        default: 5,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(9)
    biometricThreshold?: number;

    @ApiProperty({
        description: 'Enable duress finger authentication.',
        default: false,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    duressFingerEnabled?: boolean;

    @ApiProperty({
        description: 'Enable anti-passback functionality.',
        default: false,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    antiPassbackEnabled?: boolean;

    @ApiProperty({
        description: 'The size of the event buffer.',
        example: 1000,
        default: 1000,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(100)
    @Max(10000)
    eventBufferSize?: number;

    @ApiProperty({
        description: 'The interval for uploading events in seconds.',
        example: 30,
        default: 30,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(5)
    @Max(300)
    uploadInterval?: number;

    @ApiProperty({
        description: 'The number of retry attempts for failed uploads.',
        example: 3,
        default: 3,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    retryAttempts?: number;
}

export class UpdateDeviceConfigurationDto {
    @ApiProperty({
        description: 'Enable or disable DHCP for the device network configuration.',
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    networkDhcp?: boolean;

    @ApiProperty({
        description: 'The static IP address for the device.',
        example: '192.168.1.100',
        required: false,
    })
    @IsOptional()
    @IsIP()
    networkStaticIp?: string;

    @ApiProperty({
        description: 'The subnet mask for the device.',
        example: '255.255.255.0',
        required: false,
    })
    @IsOptional()
    @IsString()
    networkSubnet?: string;

    @ApiProperty({
        description: 'The gateway for the device.',
        example: '192.168.1.1',
        required: false,
    })
    @IsOptional()
    @IsIP()
    networkGateway?: string;

    @ApiProperty({
        description: 'A list of DNS servers.',
        example: ['8.8.8.8', '8.8.4.4'],
        required: false,
        type: [String],
    })
    @IsOptional()
    @IsString({ each: true })
    networkDns?: string[];

    @ApiProperty({
        description: 'The timezone for the device.',
        example: 'America/New_York',
        required: false,
    })
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiProperty({
        description: 'The NTP server for time synchronization.',
        example: 'pool.ntp.org',
        required: false,
    })
    @IsOptional()
    @IsString()
    ntpServer?: string;

    @ApiProperty({
        description: 'The interval for data synchronization in minutes.',
        example: 60,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(1440)
    syncInterval?: number;

    @ApiProperty({
        description: 'The default access level for new users.',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    defaultAccessLevel?: number;

    @ApiProperty({
        description: 'Allow access for unknown cards.',
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    allowUnknownCards?: boolean;

    @ApiProperty({
        description: 'Enable offline mode for the device.',
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    offlineMode?: boolean;

    @ApiProperty({
        description: 'The maximum number of users the device can store.',
        example: 1000,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10000)
    maxUsers?: number;

    @ApiProperty({
        description: 'The biometric verification threshold (1-9).',
        example: 5,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(9)
    biometricThreshold?: number;

    @ApiProperty({
        description: 'Enable duress finger authentication.',
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    duressFingerEnabled?: boolean;

    @ApiProperty({
        description: 'Enable anti-passback functionality.',
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    antiPassbackEnabled?: boolean;

    @ApiProperty({
        description: 'The size of the event buffer.',
        example: 1000,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(100)
    @Max(10000)
    eventBufferSize?: number;

    @ApiProperty({
        description: 'The interval for uploading events in seconds.',
        example: 30,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(5)
    @Max(300)
    uploadInterval?: number;

    @ApiProperty({
        description: 'The number of retry attempts for failed uploads.',
        example: 3,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    retryAttempts?: number;
}

// Device Template DTOs
export class CreateDeviceTemplateDto {
    @ApiProperty({
        description: 'The name of the device template.',
        example: 'Hikvision Access Control Template',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty({
        description: 'The manufacturer of the device.',
        example: 'Hikvision',
    })
    @IsString()
    @IsNotEmpty()
    manufacturer: string;

    @ApiProperty({
        description: 'The model of the device.',
        example: 'DS-K1T671M',
    })
    @IsString()
    @IsNotEmpty()
    model: string;

    @ApiProperty({
        description: 'Default settings for the device.',
        example: { timeout: 5000, port: 80 },
        required: false,
    })
    @IsOptional()
    defaultSettings?: Record<string, any>;

    @ApiProperty({
        description: 'API endpoints for the device.',
        example: { getUsers: '/api/users', setTime: '/api/time' },
        required: false,
    })
    @IsOptional()
    endpoints?: Record<string, string>;

    @ApiProperty({
        description: 'Capabilities of the device.',
        example: { biometrics: true, nfc: true },
        required: false,
    })
    @IsOptional()
    capabilities?: Record<string, boolean>;

    @ApiProperty({
        description: 'Protocol-specific settings.',
        example: { encryption: 'AES-256' },
        required: false,
    })
    @IsOptional()
    protocol?: Record<string, any>;
}

export class UpdateDeviceTemplateDto {
    @ApiProperty({
        description: 'The name of the device template.',
        example: 'Hikvision Access Control Template',
        maxLength: 100,
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name?: string;

    @ApiProperty({
        description: 'The manufacturer of the device.',
        example: 'Hikvision',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    manufacturer?: string;

    @ApiProperty({
        description: 'The model of the device.',
        example: 'DS-K1T671M',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    model?: string;

    @ApiProperty({
        description: 'Default settings for the device.',
        example: { timeout: 5000, port: 80 },
        required: false,
    })
    @IsOptional()
    defaultSettings?: Record<string, any>;

    @ApiProperty({
        description: 'API endpoints for the device.',
        example: { getUsers: '/api/users', setTime: '/api/time' },
        required: false,
    })
    @IsOptional()
    endpoints?: Record<string, string>;

    @ApiProperty({
        description: 'Capabilities of the device.',
        example: { biometrics: true, nfc: true },
        required: false,
    })
    @IsOptional()
    capabilities?: Record<string, boolean>;

    @ApiProperty({
        description: 'Protocol-specific settings.',
        example: { encryption: 'AES-256' },
        required: false,
    })
    @IsOptional()
    protocol?: Record<string, any>;

    @ApiProperty({
        description: 'Indicates if the device template is active.',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

// Device Control DTOs
export class DeviceControlDto {
    @ApiProperty({
        description: 'The action to be performed on the device.',
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
        example: 'open_door',
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

    @ApiProperty({
        description: 'Additional parameters for the action.',
        example: { duration: 5 },
        required: false,
    })
    @IsOptional()
    parameters?: Record<string, any>;

    @ApiProperty({
        description: 'The timeout for the action in seconds.',
        example: 30,
        default: 30,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(300)
    timeout?: number;
}

export class DeviceSyncEmployeesDto {
    @ApiProperty({
        description: 'A list of employee IDs to synchronize. If not provided, all employees will be synchronized.',
        example: ['a1b2c3d4-e5f6-7890-1234-567890abcdef'],
        required: false,
        type: [String],
    })
    @IsOptional()
    @IsString({ each: true })
    employeeIds?: string[];

    @ApiProperty({
        description: 'The ID of the department to synchronize.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    departmentId?: string;

    @ApiProperty({
        description: 'The ID of the branch to synchronize.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    branchId?: string;

    @ApiProperty({
        description: 'Force a full synchronization, ignoring timestamps.',
        default: false,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    forceSync?: boolean;

    @ApiProperty({
        description: 'Remove employees from the device who are not in the synchronization list.',
        default: false,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    removeMissing?: boolean;
}

export class DeviceCountResponseDto {
    @ApiProperty({
        description: 'The total number of devices.',
        example: 50,
    })
    count: number;
}

export class DeviceStatsResponseDto extends DeviceResponseDto {
    @ApiProperty({
        description: 'The number of employees synchronized with the device.',
        example: 100,
    })
    employeeCount: number;

    @ApiProperty({
        description: 'The number of events received from the device in the last 24 hours.',
        example: 500,
    })
    eventCount24h: number;
}

export class DeviceHealthResponseDto {
    @ApiProperty({
        description: 'The status of the device.',
        example: 'ONLINE',
    })
    status: string;

    @ApiProperty({
        description: 'The last time the device was seen online.',
        example: '2023-08-14T10:00:00.000Z',
    })
    lastSeen: Date;

    @ApiProperty({
        description: 'The uptime of the device in seconds.',
        example: 86400,
    })
    uptime: number;
}

export class TestConnectionResponseDto {
    @ApiProperty({
        description: 'Indicates if the connection was successful.',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'A message describing the result of the connection test.',
        example: 'Connection successful',
    })
    message: string;
}

export class CommandResponseDto {
    @ApiProperty({
        description: 'Indicates if the command was sent successfully.',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'A message describing the result of the command.',
        example: 'Command sent successfully',
    })
    message: string;
}

export class SyncStatusResponseDto {
    @ApiProperty({
        description: 'The status of the synchronization.',
        example: 'COMPLETED',
    })
    status: string;

    @ApiProperty({
        description: 'The number of employees successfully synchronized.',
        example: 100,
    })
    successCount: number;

    @ApiProperty({
        description: 'The number of employees that failed to synchronize.',
        example: 0,
    })
    failedCount: number;

    @ApiProperty({
        description: 'The last time a synchronization was attempted.',
        example: '2023-08-14T10:00:00.000Z',
    })
    lastSync: Date;
}

export class RetrySyncResponseDto {
    @ApiProperty({
        description: 'Indicates if the retry was successful.',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'A message describing the result of the retry.',
        example: 'Retry successful',
    })
    message: string;
}

export class DeviceConfigurationResponseDto extends CreateDeviceConfigurationDto {
    @ApiProperty({
        description: 'The ID of the device configuration.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The ID of the device.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    deviceId: string;
}
