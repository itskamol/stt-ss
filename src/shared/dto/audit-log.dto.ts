import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

class UserForAuditLogDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    email: string;
    @ApiProperty({ required: false })
    fullName?: string;
}

export class AuditLogResponseDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    action: string;
    @ApiProperty()
    resource: string;
    @ApiProperty({ required: false })
    resourceId?: string;
    @ApiProperty({ required: false })
    userId?: string;
    @ApiProperty({ required: false })
    organizationId?: string;
    @ApiProperty()
    method: string;
    @ApiProperty()
    url: string;
    @ApiProperty({ required: false })
    userAgent?: string;
    @ApiProperty({ required: false })
    host?: string;
    @ApiProperty({ required: false })
    requestData?: any;
    @ApiProperty({ required: false })
    responseData?: any;
    @ApiProperty()
    status: string;
    @ApiProperty()
    duration: number;
    @ApiProperty()
    timestamp: Date;
    @ApiProperty({ required: false })
    errorMessage?: string;
    @ApiProperty({ required: false })
    errorStack?: string;
    @ApiProperty({ required: false })
    oldValues?: any;
    @ApiProperty({ required: false })
    newValues?: any;
    @ApiProperty({ type: UserForAuditLogDto, required: false })
    user?: UserForAuditLogDto;
    @ApiProperty()
    createdAt: Date;
    @ApiProperty({ required: false })
    updatedAt?: Date;
}

export class AuditLogFiltersDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    userId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    resource?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    action?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    resourceId?: string;

    @ApiProperty({ required: false, enum: ['SUCCESS', 'FAILED'] })
    @IsOptional()
    @IsString()
    @IsIn(['SUCCESS', 'FAILED'])
    status?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiProperty({ required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
    @IsOptional()
    @IsString()
    @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    severity?: string;
}

class LogsByActionDto {
    @ApiProperty()
    action: string;
    @ApiProperty()
    count: number;
}

class LogsByResourceDto {
    @ApiProperty()
    resource: string;
    @ApiProperty()
    count: number;
}

class LogsByStatusDto {
    @ApiProperty()
    status: string;
    @ApiProperty()
    count: number;
}

class LogsByUserDto {
    @ApiProperty({ required: false })
    userId?: string;
    @ApiProperty({ type: UserForAuditLogDto, required: false })
    user?: UserForAuditLogDto;
    @ApiProperty()
    count: number;
}

export class AuditLogStatsDto {
    @ApiProperty()
    totalLogs: number;
    @ApiProperty({ type: [LogsByActionDto] })
    logsByAction: LogsByActionDto[];
    @ApiProperty({ type: [LogsByResourceDto] })
    logsByResource: LogsByResourceDto[];
    @ApiProperty({ type: [LogsByStatusDto] })
    logsByStatus: LogsByStatusDto[];
    @ApiProperty({ type: [LogsByUserDto] })
    logsByUser: LogsByUserDto[];
}

class UserActivityDto {
    @ApiProperty()
    action: string;
    @ApiProperty()
    resource: string;
    @ApiProperty()
    count: number;
    @ApiProperty()
    lastActivity: Date;
    @ApiProperty()
    successCount: number;
    @ApiProperty()
    failureCount: number;
}

export class UserActivitySummaryDto {
    @ApiProperty()
    userId: string;
    @ApiProperty()
    startDate: Date;
    @ApiProperty()
    endDate: Date;
    @ApiProperty()
    totalActivities: number;
    @ApiProperty({ type: [UserActivityDto] })
    activities: UserActivityDto[];
}

export class SecurityEventDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    action: string;
    @ApiProperty()
    resource: string;
    @ApiProperty({ required: false })
    userId?: string;
    @ApiProperty({ required: false })
    host?: string;
    @ApiProperty()
    timestamp: Date;
    @ApiProperty()
    status: string;
    @ApiProperty({ required: false })
    errorMessage?: string;
    @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    @ApiProperty({ type: UserForAuditLogDto, required: false })
    user?: UserForAuditLogDto;
}

class AuditLogExportMetadataDto {
    @ApiProperty()
    exportDate: Date;
    @ApiProperty()
    totalRecords: number;
    @ApiProperty()
    filters: any;
}

export class AuditLogExportDto {
    @ApiProperty({ enum: ['CSV', 'JSON'] })
    format: 'CSV' | 'JSON';
    @ApiProperty()
    data: any;
    @ApiProperty({ type: AuditLogExportMetadataDto })
    metadata: AuditLogExportMetadataDto;
}
