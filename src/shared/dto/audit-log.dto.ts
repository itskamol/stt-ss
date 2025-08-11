import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class AuditLogResponseDto {
    id: string;
    action: string;
    resource: string;
    resourceId?: string;
    userId?: string;
    organizationId?: string;
    method: string;
    url: string;
    userAgent?: string;
    ipAddress?: string;
    requestData?: any;
    responseData?: any;
    status: string;
    duration: number;
    timestamp: Date;
    errorMessage?: string;
    errorStack?: string;
    oldValues?: any;
    newValues?: any;
    user?: {
        id: string;
        email: string;
        fullName?: string;
    };
    createdAt: Date;
    updatedAt?: Date;
}

export class AuditLogFiltersDto {
    @IsOptional()
    @IsString()
    userId?: string;

    @IsOptional()
    @IsString()
    resource?: string;

    @IsOptional()
    @IsString()
    action?: string;

    @IsOptional()
    @IsString()
    resourceId?: string;

    @IsOptional()
    @IsString()
    @IsIn(['SUCCESS', 'FAILED'])
    status?: string;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsString()
    @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    severity?: string;
}

export class AuditLogStatsDto {
    totalLogs: number;
    logsByAction: Array<{
        action: string;
        count: number;
    }>;
    logsByResource: Array<{
        resource: string;
        count: number;
    }>;
    logsByStatus: Array<{
        status: string;
        count: number;
    }>;
    logsByUser: Array<{
        userId?: string;
        user?: {
            id: string;
            email: string;
            fullName?: string;
        };
        count: number;
    }>;
}

export class UserActivitySummaryDto {
    userId: string;
    startDate: Date;
    endDate: Date;
    totalActivities: number;
    activities: Array<{
        action: string;
        resource: string;
        count: number;
        lastActivity: Date;
        successCount: number;
        failureCount: number;
    }>;
}

export class SecurityEventDto {
    id: string;
    action: string;
    resource: string;
    userId?: string;
    ipAddress?: string;
    timestamp: Date;
    status: string;
    errorMessage?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    user?: {
        id: string;
        email: string;
        fullName?: string;
    };
}

export class AuditLogExportDto {
    format: 'CSV' | 'JSON';
    data: any;
    metadata: {
        exportDate: Date;
        totalRecords: number;
        filters: any;
    };
}
