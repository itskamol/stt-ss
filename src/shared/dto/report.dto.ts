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

const reportTypes = Object.values(ReportType);
const reportFormats = Object.values(ReportFormat);
const reportStatus = Object.values(ReportStatus);
const severityLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class CreateReportDto {
    @ApiProperty({
        description: 'The name of the report.',
        example: 'Monthly Attendance Report - August',
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        description: 'The type of the report.',
        enum: reportTypes,
        example: ReportType.MONTHLY_ATTENDANCE,
    })
    @IsString()
    @IsNotEmpty()
    @IsEnum(ReportType)
    type: keyof typeof ReportType;

    @ApiProperty({
        description: 'The format of the report.',
        enum: reportFormats,
        example: ReportFormat.PDF,
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsEnum(ReportFormat)
    format?: keyof typeof ReportFormat;

    @ApiProperty({
        description: 'The parameters for generating the report.',
        example: { month: 8, year: 2023 },
        required: false,
    })
    @IsOptional()
    @IsObject()
    parameters?: any;
}

class UserForReportDto {
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

export class ReportResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the report.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The name of the report.',
        example: 'Monthly Attendance Report - August',
    })
    name: string;

    @ApiProperty({
        description: 'The type of the report.',
        example: 'MONTHLY_ATTENDANCE',
    })
    type: string;

    @ApiProperty({
        description: 'The format of the report.',
        example: 'PDF',
        required: false,
    })
    format?: string;

    @ApiProperty({
        description: 'The status of the report generation.',
        example: 'COMPLETED',
    })
    status: string;

    @ApiProperty({
        description: 'The parameters used to generate the report.',
        example: { month: 8, year: 2023 },
        required: false,
    })
    parameters?: any;

    @ApiProperty({
        description: 'The ID of the organization.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    organizationId: string;

    @ApiProperty({
        description: 'The ID of the user who created the report.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    createdByUserId: string;

    @ApiProperty({
        description: 'The URL to download the report file.',
        example: 'https://storage.googleapis.com/reports/report.pdf',
        required: false,
    })
    fileUrl?: string;

    @ApiProperty({
        description: 'The path to the report file.',
        example: 'reports/report.pdf',
        required: false,
    })
    filePath?: string;

    @ApiProperty({
        description: 'The size of the report file in bytes.',
        example: 102400,
        required: false,
    })
    fileSize?: number;

    @ApiProperty({
        description: 'The number of records in the report.',
        example: 500,
        required: false,
    })
    recordCount?: number;

    @ApiProperty({
        description: 'The time when the report generation started.',
        example: '2023-08-14T10:00:00.000Z',
        required: false,
    })
    startedAt?: Date;

    @ApiProperty({
        description: 'The time when the report generation completed.',
        example: '2023-08-14T10:05:00.000Z',
        required: false,
    })
    completedAt?: Date;

    @ApiProperty({
        description: 'The error message if the report failed.',
        example: 'Database connection failed',
        required: false,
    })
    errorMessage?: string;

    @ApiProperty({
        description: 'The date and time the report was created.',
        example: '2023-08-14T09:59:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time the report was last updated.',
        example: '2023-08-14T10:05:00.000Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'The user who created the report.',
        type: UserForReportDto,
        required: false,
    })
    createdByUser?: UserForReportDto;
}

export class ReportFiltersDto {
    @ApiProperty({
        description: 'Filter by report type.',
        example: 'MONTHLY_ATTENDANCE',
        required: false,
    })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiProperty({
        description: 'Filter by report status.',
        enum: reportStatus,
        example: 'COMPLETED',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsIn(reportStatus)
    status?: string;

    @ApiProperty({
        description: 'Filter by the user who created the report.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    createdByUserId?: string;

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
}

class ReportsByTypeDto {
    @ApiProperty({
        description: 'The type of report.',
        example: 'MONTHLY_ATTENDANCE',
    })
    type: string;

    @ApiProperty({
        description: 'The number of reports of this type.',
        example: 12,
    })
    count: number;
}

class ReportsByStatusDto {
    @ApiProperty({
        description: 'The status of the reports.',
        example: 'COMPLETED',
    })
    status: string;

    @ApiProperty({
        description: 'The number of reports with this status.',
        example: 10,
    })
    count: number;
}

export class ReportStatsDto {
    @ApiProperty({
        description: 'The total number of reports.',
        example: 50,
    })
    totalReports: number;

    @ApiProperty({
        description: 'A breakdown of reports by type.',
        type: [ReportsByTypeDto],
    })
    reportsByType: ReportsByTypeDto[];

    @ApiProperty({
        description: 'A breakdown of reports by status.',
        type: [ReportsByStatusDto],
    })
    reportsByStatus: ReportsByStatusDto[];

    @ApiProperty({
        description: 'A list of recently generated reports.',
        type: [ReportResponseDto],
    })
    recentReports: ReportResponseDto[];
}

class ReportParameterDto {
    @ApiProperty({
        description: 'The name of the parameter.',
        example: 'month',
    })
    name: string;

    @ApiProperty({
        description: 'The data type of the parameter.',
        example: 'number',
    })
    type: string;

    @ApiProperty({
        description: 'Indicates if the parameter is required.',
        example: true,
    })
    required: boolean;

    @ApiProperty({
        description: 'A description of the parameter.',
        example: 'The month for the report (1-12).',
    })
    description: string;
}

export class ReportTypeDto {
    @ApiProperty({
        description: 'The type identifier of the report.',
        example: 'MONTHLY_ATTENDANCE',
    })
    type: string;

    @ApiProperty({
        description: 'The user-friendly name of the report type.',
        example: 'Monthly Attendance Report',
    })
    name: string;

    @ApiProperty({
        description: 'A description of the report type.',
        example: 'Generates a summary of attendance for a given month.',
    })
    description: string;

    @ApiProperty({
        description: 'A list of parameters required for this report type.',
        type: [ReportParameterDto],
    })
    parameters: ReportParameterDto[];
}

export class ReportDownloadDto {
    @ApiProperty({
        description: 'A pre-signed URL to download the report.',
        example: 'https://storage.googleapis.com/reports/report.pdf?token=...',
    })
    downloadUrl: string;

    @ApiProperty({
        description: 'The expiration date and time of the download URL.',
        example: '2023-08-14T11:00:00.000Z',
    })
    expiresAt: Date;
}

export class ReportSizeStatsDto {
    @ApiProperty({
        description: 'The total size of all reports in bytes.',
        example: 5120000,
    })
    totalSize: number;

    @ApiProperty({
        description: 'The average size of a report in bytes.',
        example: 102400,
    })
    averageSize: number;

    @ApiProperty({
        description: 'The size of the largest report in bytes.',
        example: 512000,
    })
    maxSize: number;

    @ApiProperty({
        description: 'The size of the smallest report in bytes.',
        example: 10240,
    })
    minSize: number;

    @ApiProperty({
        description: 'The total number of reports.',
        example: 50,
    })
    reportCount: number;
}

export class DailyAttendanceReportParamsDto {
    @ApiProperty({
        description: 'The date for the report in YYYY-MM-DD format.',
        example: '2023-08-14',
    })
    @IsString()
    @IsNotEmpty()
    date: string;

    @ApiProperty({
        description: 'The ID of the branch to filter by.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    branchId?: string;

    @ApiProperty({
        description: 'The format for the report.',
        enum: ['CSV', 'PDF', 'EXCEL'],
        example: 'PDF',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsIn(['CSV', 'PDF', 'EXCEL'])
    format?: 'CSV' | 'PDF' | 'EXCEL';

    @ApiProperty({
        description: 'Include detailed attendance records.',
        example: true,
        required: false,
    })
    @IsOptional()
    includeDetails?: boolean;
}

export class MonthlyAttendanceReportParamsDto {
    @ApiProperty({
        description: 'The year for the report.',
        example: '2023',
    })
    @IsString()
    @IsNotEmpty()
    year: string;

    @ApiProperty({
        description: 'The month for the report (1-12).',
        example: '8',
    })
    @IsString()
    @IsNotEmpty()
    month: string;

    @ApiProperty({
        description: 'The ID of the branch to filter by.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    branchId?: string;

    @ApiProperty({
        description: 'The format for the report.',
        enum: ['CSV', 'PDF', 'EXCEL'],
        example: 'PDF',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsIn(['CSV', 'PDF', 'EXCEL'])
    format?: 'CSV' | 'PDF' | 'EXCEL';

    @ApiProperty({
        description: 'Include a summary section in the report.',
        example: true,
        required: false,
    })
    @IsOptional()
    includeSummary?: boolean;
}

export class EmployeeListReportParamsDto {
    @ApiProperty({
        description: 'The ID of the branch to filter by.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    branchId?: string;

    @ApiProperty({
        description: 'The ID of the department to filter by.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    departmentId?: string;

    @ApiProperty({
        description: 'Filter by employee status (active/inactive).',
        example: true,
        required: false,
    })
    @IsOptional()
    isActive?: boolean;

    @ApiProperty({
        description: 'The format for the report.',
        enum: ['CSV', 'PDF', 'EXCEL'],
        example: 'CSV',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsIn(['CSV', 'PDF', 'EXCEL'])
    format?: 'CSV' | 'PDF' | 'EXCEL';

    @ApiProperty({
        description: 'Include employee contact information in the report.',
        example: true,
        required: false,
    })
    @IsOptional()
    includeContactInfo?: boolean;
}

export class SecurityAuditReportParamsDto {
    @ApiProperty({
        description: 'The start date for the report in YYYY-MM-DD format.',
        example: '2023-08-01',
    })
    @IsString()
    @IsNotEmpty()
    startDate: string;

    @ApiProperty({
        description: 'The end date for the report in YYYY-MM-DD format.',
        example: '2023-08-31',
    })
    @IsString()
    @IsNotEmpty()
    endDate: string;

    @ApiProperty({
        description: 'Filter by severity level.',
        enum: severityLevels,
        example: 'HIGH',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsIn(severityLevels)
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    @ApiProperty({
        description: 'The format for the report.',
        enum: ['CSV', 'PDF', 'EXCEL'],
        example: 'PDF',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsIn(['CSV', 'PDF', 'EXCEL'])
    format?: 'CSV' | 'PDF' | 'EXCEL';

    @ApiProperty({
        description: 'Include detailed event information.',
        example: true,
        required: false,
    })
    @IsOptional()
    includeDetails?: boolean;
}
