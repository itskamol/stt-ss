import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// DTOs for Hikvision ISAPI protocol
export class CreateDeviceUserDto {
    @IsString()
    @IsNotEmpty()
    employeeNo: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEnum(['normal', 'visitor'])
    userType: 'admin' | 'normal' | 'visitor';
}

export class UpdateDeviceUserDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsEnum(['normal', 'visitor'])
    @IsOptional()
    userType?: 'normal' | 'visitor';
}

// Output interfaces
export interface DeviceUserInfo {
    employeeNo: string;
    name: string;
    userType: string;
}

// Session management interfaces
export interface SecureSession {
    security: string;
    identityKey: string;
}

export interface CachedSession extends SecureSession {
    expiresAt: number;
}

// Hikvision ISAPI response interfaces
export interface HikvisionUserInfoResponse {
    UserInfo: {
        employeeNo: string;
        name: string;
        userType: string;
        Valid?: {
            enable: boolean;
            beginTime?: string;
            endTime?: string;
        };
        doorRight?: string;
        RightPlan?: Array<{
            doorNo: number;
            planTemplateNo: string;
        }>;
    };
}

export interface HikvisionUserListResponse {
    UserInfoSearch: {
        searchID: string;
        responseStatusStrg: string;
        numOfMatches: number;
        totalMatches: number;
        UserInfo?: HikvisionUserInfoResponse['UserInfo'][];
    };
}

export interface HikvisionSessionResponse {
    SessionLogin: {
        sessionID: string;
        challenge: string;
        sessionIDVersion: number;
        isIrreversible: boolean;
    };
}

export interface HikvisionSecurityResponse {
    security: string;
    identityKey: string;
}

export interface HikvisionErrorResponse {
    statusCode: number;
    statusString: string;
    subStatusCode?: string;
    errorCode?: number;
    errorMsg?: string;
}

// Request payload interfaces
export interface HikvisionCreateUserPayload {
    UserInfo: {
        employeeNo: string;
        name: string;
        userType: string;
        Valid: {
            enable: boolean;
            beginTime: string;
            endTime: string;
        };
        doorRight: string;
        RightPlan: Array<{
            doorNo: number;
            planTemplateNo: string;
        }>;
    };
}

export interface HikvisionUpdateUserPayload {
    UserInfo: {
        employeeNo: string;
        name?: string;
        userType?: string;
        Valid?: {
            enable: boolean;
            beginTime?: string;
            endTime?: string;
        };
    };
}

// Device configuration interfaces
export interface HikvisionDeviceConfig {
    deviceId: string;
    ipAddress: string;
    username: string;
    encryptedSecret: string;
    port?: number;
    useHttps?: boolean;
    timeout?: number;
}

// Error context interface
export interface HikvisionErrorContext {
    deviceId: string;
    operation: string;
    endpoint?: string;
    httpStatus?: number;
    correlationId?: string;
}

// Main Hikvision adapter interface
export interface IHikvisionAdapter {
    // User management methods
    addUser(deviceId: string, userData: CreateDeviceUserDto): Promise<boolean>;
    updateUser(deviceId: string, employeeNo: string, userData: UpdateDeviceUserDto): Promise<boolean>;
    deleteUser(deviceId: string, employeeNo: string): Promise<boolean>;
    findUserByEmployeeNo(deviceId: string, employeeNo: string): Promise<DeviceUserInfo | null>;

    // Face data operations
    getFaceData(deviceId: string, employeeNo: string): Promise<Buffer | null>;

    // Session management
    getSecureSession(deviceId: string): Promise<SecureSession>;
    clearSession(deviceId: string): Promise<void>;

    // Device operations
    testDeviceConnection(deviceId: string): Promise<boolean>;
    getDeviceStatus(deviceId: string): Promise<{ online: boolean; lastSeen?: Date }>;
}

// Constants for Hikvision ISAPI endpoints
export const HIKVISION_ENDPOINTS = {
    USER_INFO: '/ISAPI/AccessControl/UserInfo/Record',
    USER_SEARCH: '/ISAPI/AccessControl/UserInfo/Search',
    USER_DELETE: '/ISAPI/AccessControl/UserInfo/Delete',
    FACE_DATA: '/ISAPI/Intelligent/FDLib',
    SECURITY_KEY: '/ISAPI/System/Security/identityKey',
    SESSION_LOGIN: '/ISAPI/System/sessionLogin',
    DEVICE_INFO: '/ISAPI/System/deviceInfo',
    SYSTEM_STATUS: '/ISAPI/System/status',
    DOOR_CONTROL: '/ISAPI/AccessControl/RemoteControl/door',
    SYSTEM_REBOOT: '/ISAPI/System/reboot',
} as const;

// HTTP timeout and retry configuration
export const HIKVISION_CONFIG = {
    DEFAULT_TIMEOUT: 10000, // 10 seconds
    SESSION_CACHE_TTL: 600, // 10 minutes
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second
    DEFAULT_PORT: 80,
    DEFAULT_HTTPS_PORT: 443,
} as const;

// User type mappings
export const USER_TYPE_MAPPING = {
    normal: 'normal',
    visitor: 'visitor',
    admin: 'admin',
} as const;

export type HikvisionUserType = keyof typeof USER_TYPE_MAPPING;

// HTTP response wrapper interface
export interface HikvisionHttpResponse<T = unknown> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
}

// Generic error response interface
export interface HikvisionApiError extends Error {
    deviceId: string;
    operation: string;
    httpStatus?: number;
    hikvisionError?: HikvisionErrorResponse;
    correlationId?: string;
}

// Cache key generator utility
export class HikvisionCacheKeys {
    static session(deviceId: string): string {
        return `hik_session_${deviceId}`;
    }

    static deviceInfo(deviceId: string): string {
        return `hik_device_info_${deviceId}`;
    }

    static userList(deviceId: string): string {
        return `hik_user_list_${deviceId}`;
    }
}

// Validation utilities
export class HikvisionValidation {
    static isValidEmployeeNo(employeeNo: string): boolean {
        return /^[a-zA-Z0-9_-]+$/.test(employeeNo) && employeeNo.length <= 32;
    }

    static isValidUserType(userType: string): userType is HikvisionUserType {
        return Object.keys(USER_TYPE_MAPPING).includes(userType);
    }

    static isValidIpAddress(ip: string): boolean {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    }
}

// HTTP request configuration interface
export interface HikvisionRequestConfig {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    useHttps?: boolean;
    validateStatus?: (status: number) => boolean;
}