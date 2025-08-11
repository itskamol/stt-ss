import { IsDateString, IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    @IsIn([
        'DAILY_ATTENDANCE',
        'WEEKLY_ATTENDANCE',
        'MONTHLY_ATTENDANCE',
        'EMPLOYEE_LIST',
        'DEVICE_STATUS',
        'GUEST_VISITS',
        'SECURITY_AUDIT',
        'CUSTOM_QUERY',
    ])
    type: string;

    @IsOptional()
    @IsString()
    @IsIn(['CSV', 'PDF', 'EXCEL', 'JSON'])
    format?: string;

    @IsOptional()
    @IsObject()
    parameters?: any;
}

export class ReportResponseDto {
    id: string;
    name: string;
    type: string;
    format?: string;
    status: string;
    parameters?: any;
    organizationId: string;
    createdByUserId: string;
    fileUrl?: string;
    filePath?: string;
    fileSize?: number;
    recordCount?: number;
    startedAt?: Date;
    completedAt?: Date;
    errorMessage?: string;
    createdAt: Date;
    updatedAt: Date;
    createdByUser?: {
        id: string;
        email: string;
        fullName?: string;
    };
}

export class ReportFiltersDto {
    @IsOptional()
    @IsString()
    type?: string;

    @IsOptional()
    @IsString()
    @IsIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
    status?: string;

    @IsOptional()
    @IsString()
    createdByUserId?: string;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}

export class ReportStatsDto {
    totalReports: number;
    reportsByType: Array<{
        type: string;
        count: number;
    }>;
    reportsByStatus: Array<{
        status: string;
        count: number;
    }>;
    recentReports: ReportResponseDto[];
}

export class ReportTypeDto {
    type: string;
    name: string;
    description: string;
    parameters: Array<{
        name: string;
        type: string;
        required: boolean;
        description: string;
    }>;
}

export class ReportDownloadDto {
    downloadUrl: string;
    expiresAt: Date;
}

export class ReportSizeStatsDto {
    totalSize: number;
    averageSize: number;
    maxSize: number;
    minSize: number;
    reportCount: number;
}

export class DailyAttendanceReportParamsDto {
    @IsString()
    @IsNotEmpty()
    date: string;

    @IsOptional()
    @IsString()
    branchId?: string;

    @IsOptional()
    @IsString()
    @IsIn(['CSV', 'PDF', 'EXCEL'])
    format?: 'CSV' | 'PDF' | 'EXCEL';

    @IsOptional()
    includeDetails?: boolean;
}

export class MonthlyAttendanceReportParamsDto {
    @IsString()
    @IsNotEmpty()
    year: string;

    @IsString()
    @IsNotEmpty()
    month: string;

    @IsOptional()
    @IsString()
    branchId?: string;

    @IsOptional()
    @IsString()
    @IsIn(['CSV', 'PDF', 'EXCEL'])
    format?: 'CSV' | 'PDF' | 'EXCEL';

    @IsOptional()
    includeSummary?: boolean;
}

export class EmployeeListReportParamsDto {
    @IsOptional()
    @IsString()
    branchId?: string;

    @IsOptional()
    @IsString()
    departmentId?: string;

    @IsOptional()
    isActive?: boolean;

    @IsOptional()
    @IsString()
    @IsIn(['CSV', 'PDF', 'EXCEL'])
    format?: 'CSV' | 'PDF' | 'EXCEL';

    @IsOptional()
    includeContactInfo?: boolean;
}

export class SecurityAuditReportParamsDto {
    @IsString()
    @IsNotEmpty()
    startDate: string;

    @IsString()
    @IsNotEmpty()
    endDate: string;

    @IsOptional()
    @IsString()
    @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    @IsOptional()
    @IsString()
    @IsIn(['CSV', 'PDF', 'EXCEL'])
    format?: 'CSV' | 'PDF' | 'EXCEL';

    @IsOptional()
    includeDetails?: boolean;
}
