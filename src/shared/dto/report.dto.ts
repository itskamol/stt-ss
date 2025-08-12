import { ApiProperty } from '@nestjs/swagger';
import { ReportFormat, ReportStatus, ReportType } from '@prisma/client';
import {
    IsDateString,
    IsEnum,
    IsIn,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
} from 'class-validator';

const reportTypes = [
    'DAILY_ATTENDANCE',
    'WEEKLY_ATTENDANCE',
    'MONTHLY_ATTENDANCE',
    'EMPLOYEE_LIST',
    'DEVICE_STATUS',
    'GUEST_VISITS',
    'SECURITY_AUDIT',
    'CUSTOM_QUERY',
];
const reportFormats = ['CSV', 'PDF', 'EXCEL', 'JSON'];
const reportStatus = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
const severityLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class CreateReportDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ enum: reportTypes })
    @IsString()
    @IsNotEmpty()
    @IsEnum(ReportType)
    type: keyof typeof ReportType;

    @ApiProperty({ required: false, enum: reportFormats })
    @IsOptional()
    @IsString()
    @IsEnum(ReportStatus)
    format?: keyof typeof ReportFormat;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsObject()
    parameters?: any;
}

class UserForReportDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    email: string;
    @ApiProperty({ required: false })
    fullName?: string;
}

export class ReportResponseDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    name: string;
    @ApiProperty()
    type: string;
    @ApiProperty({ required: false })
    format?: string;
    @ApiProperty()
    status: string;
    @ApiProperty({ required: false })
    parameters?: any;
    @ApiProperty()
    organizationId: string;
    @ApiProperty()
    createdByUserId: string;
    @ApiProperty({ required: false })
    fileUrl?: string;
    @ApiProperty({ required: false })
    filePath?: string;
    @ApiProperty({ required: false })
    fileSize?: number;
    @ApiProperty({ required: false })
    recordCount?: number;
    @ApiProperty({ required: false })
    startedAt?: Date;
    @ApiProperty({ required: false })
    completedAt?: Date;
    @ApiProperty({ required: false })
    errorMessage?: string;
    @ApiProperty()
    createdAt: Date;
    @ApiProperty()
    updatedAt: Date;
    @ApiProperty({ type: UserForReportDto, required: false })
    createdByUser?: UserForReportDto;
}

export class ReportFiltersDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiProperty({ required: false, enum: reportStatus })
    @IsOptional()
    @IsString()
    @IsIn(reportStatus)
    status?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    createdByUserId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    endDate?: string;
}

class ReportsByTypeDto {
    @ApiProperty()
    type: string;
    @ApiProperty()
    count: number;
}

class ReportsByStatusDto {
    @ApiProperty()
    status: string;
    @ApiProperty()
    count: number;
}

export class ReportStatsDto {
    @ApiProperty()
    totalReports: number;
    @ApiProperty({ type: [ReportsByTypeDto] })
    reportsByType: ReportsByTypeDto[];
    @ApiProperty({ type: [ReportsByStatusDto] })
    reportsByStatus: ReportsByStatusDto[];
    @ApiProperty({ type: [ReportResponseDto] })
    recentReports: ReportResponseDto[];
}

class ReportParameterDto {
    @ApiProperty()
    name: string;
    @ApiProperty()
    type: string;
    @ApiProperty()
    required: boolean;
    @ApiProperty()
    description: string;
}

export class ReportTypeDto {
    @ApiProperty()
    type: string;
    @ApiProperty()
    name: string;
    @ApiProperty()
    description: string;
    @ApiProperty({ type: [ReportParameterDto] })
    parameters: ReportParameterDto[];
}

export class ReportDownloadDto {
    @ApiProperty()
    downloadUrl: string;
    @ApiProperty()
    expiresAt: Date;
}

export class ReportSizeStatsDto {
    @ApiProperty()
    totalSize: number;
    @ApiProperty()
    averageSize: number;
    @ApiProperty()
    maxSize: number;
    @ApiProperty()
    minSize: number;
    @ApiProperty()
    reportCount: number;
}

export class DailyAttendanceReportParamsDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    date: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    branchId?: string;

    @ApiProperty({ required: false, enum: ['CSV', 'PDF', 'EXCEL'] })
    @IsOptional()
    @IsString()
    @IsIn(['CSV', 'PDF', 'EXCEL'])
    format?: 'CSV' | 'PDF' | 'EXCEL';

    @ApiProperty({ required: false })
    @IsOptional()
    includeDetails?: boolean;
}

export class MonthlyAttendanceReportParamsDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    year: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    month: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    branchId?: string;

    @ApiProperty({ required: false, enum: ['CSV', 'PDF', 'EXCEL'] })
    @IsOptional()
    @IsString()
    @IsIn(['CSV', 'PDF', 'EXCEL'])
    format?: 'CSV' | 'PDF' | 'EXCEL';

    @ApiProperty({ required: false })
    @IsOptional()
    includeSummary?: boolean;
}

export class EmployeeListReportParamsDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    branchId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    departmentId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    isActive?: boolean;

    @ApiProperty({ required: false, enum: ['CSV', 'PDF', 'EXCEL'] })
    @IsOptional()
    @IsString()
    @IsIn(['CSV', 'PDF', 'EXCEL'])
    format?: 'CSV' | 'PDF' | 'EXCEL';

    @ApiProperty({ required: false })
    @IsOptional()
    includeContactInfo?: boolean;
}

export class SecurityAuditReportParamsDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    startDate: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    endDate: string;

    @ApiProperty({ required: false, enum: severityLevels })
    @IsOptional()
    @IsString()
    @IsIn(severityLevels)
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    @ApiProperty({ required: false, enum: ['CSV', 'PDF', 'EXCEL'] })
    @IsOptional()
    @IsString()
    @IsIn(['CSV', 'PDF', 'EXCEL'])
    format?: 'CSV' | 'PDF' | 'EXCEL';

    @ApiProperty({ required: false })
    @IsOptional()
    includeDetails?: boolean;
}
