import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

class UserForAuditLogDto {
    @ApiProperty({
        description: "The user's ID.",
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: "The user's email.",
        example: 'admin@example.com',
    })
    email: string;

    @ApiProperty({
        description: "The user's full name.",
        example: 'Admin User',
        required: false,
    })
    fullName?: string;
}

export class AuditLogResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the audit log.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The action performed.',
        example: 'CREATE_USER',
    })
    action: string;

    @ApiProperty({
        description: 'The resource that was affected.',
        example: 'User',
    })
    resource: string;

    @ApiProperty({
        description: 'The ID of the affected resource.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    resourceId?: string;

    @ApiProperty({
        description: 'The ID of the user who performed the action.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    userId?: string;

    @ApiProperty({
        description: 'The ID of the organization.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    organizationId?: string;

    @ApiProperty({
        description: 'The HTTP method used.',
        example: 'POST',
    })
    method: string;

    @ApiProperty({
        description: 'The URL of the request.',
        example: '/api/v1/users',
    })
    url: string;

    @ApiProperty({
        description: 'The user agent of the client.',
        example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
        required: false,
    })
    userAgent?: string;

    @ApiProperty({
        description: 'The IP address of the client.',
        example: '127.0.0.1',
        required: false,
    })
    ipAddress?: string;

    @ApiProperty({
        description: 'The request data.',
        example: { email: 'test@test.com' },
        required: false,
    })
    requestData?: any;

    @ApiProperty({
        description: 'The response data.',
        example: { id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' },
        required: false,
    })
    responseData?: any;

    @ApiProperty({
        description: 'The status of the action.',
        example: 'SUCCESS',
    })
    status: string;

    @ApiProperty({
        description: 'The duration of the request in milliseconds.',
        example: 123,
    })
    duration: number;

    @ApiProperty({
        description: 'The timestamp of the event.',
        example: '2023-08-14T10:00:00.000Z',
    })
    timestamp: Date;

    @ApiProperty({
        description: 'The error message if the action failed.',
        example: 'User not found',
        required: false,
    })
    errorMessage?: string;

    @ApiProperty({
        description: 'The error stack trace if the action failed.',
        required: false,
    })
    errorStack?: string;

    @ApiProperty({
        description: 'The values before the change.',
        example: { isActive: true },
        required: false,
    })
    oldValues?: any;

    @ApiProperty({
        description: 'The values after the change.',
        example: { isActive: false },
        required: false,
    })
    newValues?: any;

    @ApiProperty({
        description: 'The user who performed the action.',
        type: UserForAuditLogDto,
        required: false,
    })
    user?: UserForAuditLogDto;

    @ApiProperty({
        description: 'The date and time the log was created.',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time the log was last updated.',
        example: '2023-08-14T10:00:00.000Z',
        required: false,
    })
    updatedAt?: Date;
}

export class AuditLogFiltersDto {
    @ApiProperty({
        description: 'Filter by user ID.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    userId?: string;

    @ApiProperty({
        description: 'Filter by resource type.',
        example: 'User',
        required: false,
    })
    @IsOptional()
    @IsString()
    resource?: string;

    @ApiProperty({
        description: 'Filter by action.',
        example: 'CREATE_USER',
        required: false,
    })
    @IsOptional()
    @IsString()
    action?: string;

    @ApiProperty({
        description: 'Filter by resource ID.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    resourceId?: string;

    @ApiProperty({
        description: 'Filter by status.',
        enum: ['SUCCESS', 'FAILED'],
        example: 'SUCCESS',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsIn(['SUCCESS', 'FAILED'])
    status?: string;

    @ApiProperty({
        description: 'The start date for the filter range.',
        example: '2023-08-01',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiProperty({
        description: 'The end date for the filter range.',
        example: '2023-08-31',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiProperty({
        description: 'Filter by severity level.',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        example: 'HIGH',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    severity?: string;
}

class LogsByActionDto {
    @ApiProperty({
        description: 'The action performed.',
        example: 'CREATE_USER',
    })
    action: string;

    @ApiProperty({
        description: 'The number of logs for this action.',
        example: 50,
    })
    count: number;
}

class LogsByResourceDto {
    @ApiProperty({
        description: 'The resource type.',
        example: 'User',
    })
    resource: string;

    @ApiProperty({
        description: 'The number of logs for this resource.',
        example: 120,
    })
    count: number;
}

class LogsByStatusDto {
    @ApiProperty({
        description: 'The status of the action.',
        example: 'SUCCESS',
    })
    status: string;

    @ApiProperty({
        description: 'The number of logs with this status.',
        example: 110,
    })
    count: number;
}

class LogsByUserDto {
    @ApiProperty({
        description: 'The ID of the user.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    userId?: string;

    @ApiProperty({
        description: 'The user details.',
        type: UserForAuditLogDto,
        required: false,
    })
    user?: UserForAuditLogDto;

    @ApiProperty({
        description: 'The number of logs for this user.',
        example: 75,
    })
    count: number;
}

export class AuditLogStatsDto {
    @ApiProperty({
        description: 'The total number of audit logs.',
        example: 1234,
    })
    totalLogs: number;

    @ApiProperty({
        description: 'A breakdown of logs by action.',
        type: [LogsByActionDto],
    })
    logsByAction: LogsByActionDto[];

    @ApiProperty({
        description: 'A breakdown of logs by resource.',
        type: [LogsByResourceDto],
    })
    logsByResource: LogsByResourceDto[];

    @ApiProperty({
        description: 'A breakdown of logs by status.',
        type: [LogsByStatusDto],
    })
    logsByStatus: LogsByStatusDto[];

    @ApiProperty({
        description: 'A breakdown of logs by user.',
        type: [LogsByUserDto],
    })
    logsByUser: LogsByUserDto[];
}

class UserActivityDto {
    @ApiProperty({
        description: 'The action performed.',
        example: 'LOGIN',
    })
    action: string;

    @ApiProperty({
        description: 'The resource affected.',
        example: 'Auth',
    })
    resource: string;

    @ApiProperty({
        description: 'The number of times this activity occurred.',
        example: 10,
    })
    count: number;

    @ApiProperty({
        description: 'The timestamp of the last activity.',
        example: '2023-08-14T10:00:00.000Z',
    })
    lastActivity: Date;

    @ApiProperty({
        description: 'The number of successful activities.',
        example: 9,
    })
    successCount: number;

    @ApiProperty({
        description: 'The number of failed activities.',
        example: 1,
    })
    failureCount: number;
}

export class UserActivitySummaryDto {
    @ApiProperty({
        description: 'The ID of the user.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    userId: string;

    @ApiProperty({
        description: 'The start date of the summary period.',
        example: '2023-08-01T00:00:00.000Z',
    })
    startDate: Date;

    @ApiProperty({
        description: 'The end date of the summary period.',
        example: '2023-08-31T23:59:59.999Z',
    })
    endDate: Date;

    @ApiProperty({
        description: 'The total number of activities for the user.',
        example: 50,
    })
    totalActivities: number;

    @ApiProperty({
        description: 'A list of activities performed by the user.',
        type: [UserActivityDto],
    })
    activities: UserActivityDto[];
}

export class SecurityEventDto {
    @ApiProperty({
        description: 'The unique identifier for the security event.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The action that triggered the event.',
        example: 'FAILED_LOGIN',
    })
    action: string;

    @ApiProperty({
        description: 'The resource related to the event.',
        example: 'Auth',
    })
    resource: string;

    @ApiProperty({
        description: 'The ID of the user involved in the event.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    userId?: string;

    @ApiProperty({
        description: 'The IP address from which the event originated.',
        example: '192.168.1.100',
        required: false,
    })
    ipAddress?: string;

    @ApiProperty({
        description: 'The timestamp of the event.',
        example: '2023-08-14T10:00:00.000Z',
    })
    timestamp: Date;

    @ApiProperty({
        description: 'The status of the event.',
        example: 'FAILED',
    })
    status: string;

    @ApiProperty({
        description: 'The error message associated with the event.',
        example: 'Invalid credentials',
        required: false,
    })
    errorMessage?: string;

    @ApiProperty({
        description: 'The severity of the event.',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        example: 'HIGH',
    })
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    @ApiProperty({
        description: 'The user involved in the event.',
        type: UserForAuditLogDto,
        required: false,
    })
    user?: UserForAuditLogDto;
}

class AuditLogExportMetadataDto {
    @ApiProperty({
        description: 'The date the export was generated.',
        example: '2023-08-14T10:00:00.000Z',
    })
    exportDate: Date;

    @ApiProperty({
        description: 'The total number of records in the export.',
        example: 100,
    })
    totalRecords: number;

    @ApiProperty({
        description: 'The filters applied to the export.',
        example: { userId: 'a1b2c3d4' },
    })
    filters: any;
}

export class AuditLogExportDto {
    @ApiProperty({
        description: 'The format of the exported data.',
        enum: ['CSV', 'JSON'],
        example: 'CSV',
    })
    format: 'CSV' | 'JSON';

    @ApiProperty({
        description: 'The exported data.',
        example: 'id,action,resource\\n1,LOGIN,Auth',
    })
    data: any;

    @ApiProperty({
        description: 'Metadata about the export.',
        type: AuditLogExportMetadataDto,
    })
    metadata: AuditLogExportMetadataDto;
}
