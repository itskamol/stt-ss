import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import {
    CreateReportDto,
    PaginationDto,
    PaginationResponseDto,
    ReportFiltersDto,
    ReportResponseDto,
} from '../../shared/dto';
import { Permissions, Scope, User } from '../../shared/decorators';
import { DataScope, UserContext } from '../../shared/interfaces';
import { AuditLog } from '../../shared/interceptors/audit-log.interceptor';

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
    @Permissions('report:read:all')
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
    @Permissions('report:read:all')
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
    @Permissions('report:read:all')
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
