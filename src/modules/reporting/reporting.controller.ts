import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { ReportingService } from './reporting.service';
import {
    CreateReportDto,
    PaginationDto,
    PaginationResponseDto,
    ReportFiltersDto,
    ReportResponseDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';
import { AuditLog } from '@/shared/interceptors/audit-log.interceptor';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportingController {
    constructor(private readonly reportingService: ReportingService) {}

    @Post()
    @Permissions('report:create')
    @AuditLog({
        action: 'CREATE',
        resource: 'report',
        captureRequest: true,
        captureResponse: true,
    })
    @ApiOperation({ summary: 'Generate a new report' })
    @ApiBody({ type: CreateReportDto })
    @ApiResponse({
        status: 201,
        description: 'The report generation has been successfully queued.',
        type: ReportResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async generateReport(
        @Body() createReportDto: CreateReportDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<ReportResponseDto> {
        const report = await this.reportingService.generateReport(createReportDto, scope, user.sub);

        return {
            id: report.id,
            name: report.name,
            type: report.type,
            status: report.status,
            parameters: report.parameters,
            organizationId: report.organizationId,
            createdByUserId: report.createdByUserId,
            fileUrl: report.fileUrl,
            filePath: report.filePath,
            fileSize: report.fileSize,
            recordCount: report.recordCount,
            startedAt: report.startedAt,
            completedAt: report.completedAt,
            errorMessage: report.errorMessage,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
        };
    }

    @Get()
    @Permissions(PERMISSIONS.REPORT.READ_ALL)
    @ApiOperation({ summary: 'Get all reports with filters and pagination' })
    @ApiQuery({ name: 'filtersDto', type: ReportFiltersDto })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of reports.',
        type: PaginationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getReports(
        @Scope() scope: DataScope,
        @Query() filtersDto: ReportFiltersDto,
        @Query() paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<ReportResponseDto>> {
        const filters = {
            type: filtersDto.type,
            status: filtersDto.status,
            createdByUserId: filtersDto.createdByUserId,
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
        };

        const { page = 1, limit = 20 } = paginationDto;

        const result = await this.reportingService.getReports(filters, scope, { page, limit });

        const responseData = result.data.map(report => ({
            id: report.id,
            name: report.name,
            type: report.type,
            status: report.status,
            parameters: report.parameters,
            organizationId: report.organizationId,
            createdByUserId: report.createdByUserId,
            fileUrl: report.fileUrl,
            filePath: report.filePath,
            fileSize: report.fileSize,
            recordCount: report.recordCount,
            startedAt: report.startedAt,
            completedAt: report.completedAt,
            errorMessage: report.errorMessage,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
            createdByUser: report.createdByUser
                ? {
                      id: report.createdByUser.id,
                      email: report.createdByUser.email,
                      fullName: report.createdByUser.fullName,
                  }
                : undefined,
        }));

        return new PaginationResponseDto(responseData, result.total, result.page, result.limit);
    }

    @Get('types')
    @Permissions(PERMISSIONS.REPORT.READ_ALL)
    @ApiOperation({ summary: 'Get a list of available report types' })
    @ApiResponse({ status: 200, description: 'A list of report types.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getReportTypes(): Promise<
        Array<{
            type: string;
            name: string;
            description: string;
            parameters: Array<{
                name: string;
                type: string;
                required: boolean;
                description: string;
            }>;
        }>
    > {
        return this.reportingService.getAvailableReportTypes();
    }

    @Get(':id')
    @Permissions(PERMISSIONS.REPORT.READ_ALL)
    @ApiOperation({ summary: 'Get a specific report by ID' })
    @ApiParam({ name: 'id', description: 'ID of the report' })
    @ApiResponse({ status: 200, description: 'The report details.', type: ReportResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Report not found.' })
    async getReportById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<ReportResponseDto> {
        const report = await this.reportingService.getReportById(id, scope);

        if (!report) {
            throw new Error('Report not found');
        }

        return {
            id: report.id,
            name: report.name,
            type: report.type,
            status: report.status,
            parameters: report.parameters,
            organizationId: report.organizationId,
            createdByUserId: report.createdByUserId,
            fileUrl: report.fileUrl,
            filePath: report.filePath,
            fileSize: report.fileSize,
            recordCount: report.recordCount,
            startedAt: report.startedAt,
            completedAt: report.completedAt,
            errorMessage: report.errorMessage,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
            createdByUser: report.createdByUser
                ? {
                      id: report.createdByUser.id,
                      email: report.createdByUser.email,
                      fullName: report.createdByUser.fullName,
                  }
                : undefined,
        };
    }

    @Get(':id/download')
    @Permissions('report:download')
    @ApiOperation({ summary: 'Get a download URL for a report' })
    @ApiParam({ name: 'id', description: 'ID of the report' })
    @ApiResponse({ status: 200, description: 'A temporary download URL for the report.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Report not found or not completed.' })
    async downloadReport(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<{
        downloadUrl: string;
        expiresAt: Date;
    }> {
        return this.reportingService.getReportDownloadUrl(id, scope);
    }

    @Post(':id/regenerate')
    @Permissions('report:create')
    @AuditLog({
        action: 'REGENERATE',
        resource: 'report',
        captureRequest: true,
        captureResponse: true,
    })
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Regenerate an existing report' })
    @ApiParam({ name: 'id', description: 'ID of the report to regenerate' })
    @ApiResponse({
        status: 200,
        description: 'The report regeneration has been successfully queued.',
        type: ReportResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Report not found.' })
    async regenerateReport(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<ReportResponseDto> {
        const report = await this.reportingService.regenerateReport(id, scope, user.sub);

        return {
            id: report.id,
            name: report.name,
            type: report.type,
            status: report.status,
            parameters: report.parameters,
            organizationId: report.organizationId,
            createdByUserId: report.createdByUserId,
            fileUrl: report.fileUrl,
            filePath: report.filePath,
            fileSize: report.fileSize,
            recordCount: report.recordCount,
            startedAt: report.startedAt,
            completedAt: report.completedAt,
            errorMessage: report.errorMessage,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
        };
    }

    @Post('attendance/daily')
    @Permissions('report:create')
    @AuditLog({
        action: 'CREATE',
        resource: 'report',
        captureRequest: true,
        captureResponse: true,
    })
    @ApiOperation({ summary: 'Generate a daily attendance report' })
    @ApiBody({
        schema: {
            properties: {
                date: { type: 'string', format: 'date' },
                branchId: { type: 'string' },
                format: { type: 'string', enum: ['CSV', 'PDF', 'EXCEL'] },
                includeDetails: { type: 'boolean' },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Report generation queued.', type: ReportResponseDto })
    async generateDailyAttendanceReport(
        @Body()
        params: {
            date: string;
            branchId?: string;
            format?: 'CSV' | 'PDF' | 'EXCEL';
            includeDetails?: boolean;
        },
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<ReportResponseDto> {
        const createReportDto: CreateReportDto = {
            name: `Daily Attendance Report - ${params.date}`,
            type: 'DAILY_ATTENDANCE',
            format: params.format || 'CSV',
            parameters: {
                date: params.date,
                branchId: params.branchId,
                includeDetails: params.includeDetails || false,
            },
        };

        const report = await this.reportingService.generateReport(createReportDto, scope, user.sub);

        return {
            id: report.id,
            name: report.name,
            type: report.type,
            status: report.status,
            parameters: report.parameters,
            organizationId: report.organizationId,
            createdByUserId: report.createdByUserId,
            fileUrl: report.fileUrl,
            filePath: report.filePath,
            fileSize: report.fileSize,
            recordCount: report.recordCount,
            startedAt: report.startedAt,
            completedAt: report.completedAt,
            errorMessage: report.errorMessage,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
        };
    }

    @Post('attendance/monthly')
    @Permissions('report:create')
    @AuditLog({
        action: 'CREATE',
        resource: 'report',
        captureRequest: true,
        captureResponse: true,
    })
    @ApiOperation({ summary: 'Generate a monthly attendance report' })
    @ApiBody({
        schema: {
            properties: {
                year: { type: 'number' },
                month: { type: 'number' },
                branchId: { type: 'string' },
                format: { type: 'string', enum: ['CSV', 'PDF', 'EXCEL'] },
                includeSummary: { type: 'boolean' },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Report generation queued.', type: ReportResponseDto })
    async generateMonthlyAttendanceReport(
        @Body()
        params: {
            year: number;
            month: number;
            branchId?: string;
            format?: 'CSV' | 'PDF' | 'EXCEL';
            includeSummary?: boolean;
        },
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<ReportResponseDto> {
        const createReportDto: CreateReportDto = {
            name: `Monthly Attendance Report - ${params.year}-${params.month.toString().padStart(2, '0')}`,
            type: 'MONTHLY_ATTENDANCE',
            format: params.format || 'CSV',
            parameters: {
                year: params.year,
                month: params.month,
                branchId: params.branchId,
                includeSummary: params.includeSummary || true,
            },
        };

        const report = await this.reportingService.generateReport(createReportDto, scope, user.sub);

        return {
            id: report.id,
            name: report.name,
            type: report.type,
            status: report.status,
            parameters: report.parameters,
            organizationId: report.organizationId,
            createdByUserId: report.createdByUserId,
            fileUrl: report.fileUrl,
            filePath: report.filePath,
            fileSize: report.fileSize,
            recordCount: report.recordCount,
            startedAt: report.startedAt,
            completedAt: report.completedAt,
            errorMessage: report.errorMessage,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
        };
    }

    @Post('employees/list')
    @Permissions('report:create')
    @AuditLog({
        action: 'CREATE',
        resource: 'report',
        captureRequest: true,
        captureResponse: true,
    })
    @ApiOperation({ summary: 'Generate an employee list report' })
    @ApiBody({
        schema: {
            properties: {
                branchId: { type: 'string' },
                departmentId: { type: 'string' },
                isActive: { type: 'boolean' },
                format: { type: 'string', enum: ['CSV', 'PDF', 'EXCEL'] },
                includeContactInfo: { type: 'boolean' },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Report generation queued.', type: ReportResponseDto })
    async generateEmployeeListReport(
        @Body()
        params: {
            branchId?: string;
            departmentId?: string;
            isActive?: boolean;
            format?: 'CSV' | 'PDF' | 'EXCEL';
            includeContactInfo?: boolean;
        },
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<ReportResponseDto> {
        const createReportDto: CreateReportDto = {
            name: 'Employee List Report',
            type: 'EMPLOYEE_LIST',
            format: params.format || 'CSV',
            parameters: {
                branchId: params.branchId,
                departmentId: params.departmentId,
                isActive: params.isActive,
                includeContactInfo: params.includeContactInfo || false,
            },
        };

        const report = await this.reportingService.generateReport(createReportDto, scope, user.sub);

        return {
            id: report.id,
            name: report.name,
            type: report.type,
            status: report.status,
            parameters: report.parameters,
            organizationId: report.organizationId,
            createdByUserId: report.createdByUserId,
            fileUrl: report.fileUrl,
            filePath: report.filePath,
            fileSize: report.fileSize,
            recordCount: report.recordCount,
            startedAt: report.startedAt,
            completedAt: report.completedAt,
            errorMessage: report.errorMessage,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
        };
    }

    @Post('audit/security')
    @Permissions('report:create', 'audit:read:security')
    @AuditLog({
        action: 'CREATE',
        resource: 'report',
        captureRequest: true,
        captureResponse: true,
    })
    @ApiOperation({ summary: 'Generate a security audit report' })
    @ApiBody({
        schema: {
            properties: {
                startDate: { type: 'string', format: 'date' },
                endDate: { type: 'string', format: 'date' },
                severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                format: { type: 'string', enum: ['CSV', 'PDF', 'EXCEL'] },
                includeDetails: { type: 'boolean' },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Report generation queued.', type: ReportResponseDto })
    async generateSecurityAuditReport(
        @Body()
        params: {
            startDate: string;
            endDate: string;
            severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
            format?: 'CSV' | 'PDF' | 'EXCEL';
            includeDetails?: boolean;
        },
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<ReportResponseDto> {
        const createReportDto: CreateReportDto = {
            name: `Security Audit Report - ${params.startDate} to ${params.endDate}`,
            type: 'SECURITY_AUDIT',
            format: params.format || 'CSV',
            parameters: {
                startDate: params.startDate,
                endDate: params.endDate,
                severity: params.severity,
                includeDetails: params.includeDetails || true,
            },
        };

        const report = await this.reportingService.generateReport(createReportDto, scope, user.sub);

        return {
            id: report.id,
            name: report.name,
            type: report.type,
            status: report.status,
            parameters: report.parameters,
            organizationId: report.organizationId,
            createdByUserId: report.createdByUserId,
            fileUrl: report.fileUrl,
            filePath: report.filePath,
            fileSize: report.fileSize,
            recordCount: report.recordCount,
            startedAt: report.startedAt,
            completedAt: report.completedAt,
            errorMessage: report.errorMessage,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
        };
    }
}
