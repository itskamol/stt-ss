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
import { AuditLogService } from '@/shared/services/audit-log.service';
import {
    AuditLogFiltersDto,
    AuditLogResponseDto,
    AuditLogStatsDto,
    PaginationDto,
    PaginationResponseDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogController {
    constructor(private readonly auditLogService: AuditLogService) {}

    @Get()
    @Permissions('audit:read:all')
    @ApiOperation({ summary: 'Get all audit logs with filters and pagination' })
    @ApiQuery({ name: 'filtersDto', type: AuditLogFiltersDto })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of audit logs.',
        type: PaginationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getAuditLogs(
        @Scope() scope: DataScope,
        @Query() filtersDto: AuditLogFiltersDto,
        @Query() paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<AuditLogResponseDto>> {
        const filters = {
            userId: filtersDto.userId,
            resource: filtersDto.resource,
            action: filtersDto.action,
            resourceId: filtersDto.resourceId,
            status: filtersDto.status,
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
        };

        const { page = 1, limit = 50 } = paginationDto;

        const result = await this.auditLogService.getAuditLogs(filters, scope, { page, limit });

        const responseData = result.data.map(log => ({
            id: log.id,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            userId: log.userId,
            organizationId: log.organizationId,
            method: log.method,
            url: log.url,
            userAgent: log.userAgent,
            ipAddress: log.ipAddress,
            status: log.status,
            duration: log.duration,
            timestamp: log.timestamp,
            errorMessage: log.errorMessage,
            user: log.user
                ? {
                      id: log.user.id,
                      email: log.user.email,
                      fullName: log.user.fullName,
                  }
                : undefined,
            createdAt: log.createdAt,
        }));

        return new PaginationResponseDto(responseData, result.total, result.page, result.limit);
    }

    @Get('stats')
    @Permissions('audit:read:all')
    @ApiOperation({ summary: 'Get audit log statistics' })
    @ApiQuery({ name: 'filtersDto', type: AuditLogFiltersDto })
    @ApiResponse({
        status: 200,
        description: 'Audit log statistics.',
        type: AuditLogStatsDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getAuditLogStats(
        @Scope() scope: DataScope,
        @Query() filtersDto: Pick<AuditLogFiltersDto, 'startDate' | 'endDate'>
    ): Promise<AuditLogStatsDto> {
        const filters = {
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
        };

        return this.auditLogService.getAuditLogStats(filters, scope);
    }

    @Get('user/:userId/activity')
    @Permissions('audit:read:all')
    @ApiOperation({ summary: 'Get a summary of user activity' })
    @ApiParam({ name: 'userId', description: 'ID of the user' })
    @ApiQuery({ name: 'startDate', description: 'Start date for the summary (YYYY-MM-DD)' })
    @ApiQuery({ name: 'endDate', description: 'End date for the summary (YYYY-MM-DD)' })
    @ApiResponse({ status: 200, description: 'User activity summary.' })
    @ApiResponse({ status: 400, description: 'Start date and end date are required.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async getUserActivitySummary(
        @Param('userId') userId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Scope() scope: DataScope
    ) {
        if (!startDate || !endDate) {
            throw new Error('Start date and end date are required');
        }

        return this.auditLogService.getUserActivitySummary(
            userId,
            new Date(startDate),
            new Date(endDate),
            scope
        );
    }

    @Get('resource/:resource/:resourceId/history')
    @Permissions('audit:read:all')
    @ApiOperation({ summary: 'Get the history of a specific resource' })
    @ApiParam({ name: 'resource', description: 'The type of the resource (e.g., "employee")' })
    @ApiParam({ name: 'resourceId', description: 'The ID of the resource' })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of audit logs for the resource.',
        type: PaginationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Resource not found.' })
    async getResourceHistory(
        @Param('resource') resource: string,
        @Param('resourceId') resourceId: string,
        @Scope() scope: DataScope,
        @Query() paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<AuditLogResponseDto>> {
        const { page = 1, limit = 50 } = paginationDto;

        const result = await this.auditLogService.getResourceHistory(resource, resourceId, scope, {
            page,
            limit,
        });

        const responseData = result.data.map(log => ({
            id: log.id,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            userId: log.userId,
            organizationId: log.organizationId,
            method: log.method,
            url: log.url,
            userAgent: log.userAgent,
            ipAddress: log.ipAddress,
            status: log.status,
            duration: log.duration,
            timestamp: log.timestamp,
            errorMessage: log.errorMessage,
            user: log.user
                ? {
                      id: log.user.id,
                      email: log.user.email,
                      fullName: log.user.fullName,
                  }
                : undefined,
            createdAt: log.createdAt,
        }));

        return new PaginationResponseDto(responseData, result.total, result.page, result.limit);
    }

    @Get('security-events')
    @Permissions('audit:read:security')
    @ApiOperation({ summary: 'Get security-related audit events' })
    @ApiQuery({ name: 'filtersDto', type: AuditLogFiltersDto })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of security events.',
        type: PaginationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getSecurityEvents(
        @Scope() scope: DataScope,
        @Query() filtersDto: AuditLogFiltersDto,
        @Query() paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<AuditLogResponseDto>> {
        const filters = {
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
            severity: filtersDto.severity as any,
        };

        const { page = 1, limit = 50 } = paginationDto;

        const result = await this.auditLogService.getSecurityEvents(filters, scope, {
            page,
            limit,
        });

        const responseData = result.data.map(log => ({
            id: log.id,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            userId: log.userId,
            organizationId: log.organizationId,
            method: log.method,
            url: log.url,
            userAgent: log.userAgent,
            ipAddress: log.ipAddress,
            status: log.status,
            duration: log.duration,
            timestamp: log.timestamp,
            errorMessage: log.errorMessage,
            user: log.user
                ? {
                      id: log.user.id,
                      email: log.user.email,
                      fullName: log.user.fullName,
                  }
                : undefined,
            createdAt: log.createdAt,
        }));

        return new PaginationResponseDto(responseData, result.total, result.page, result.limit);
    }

    @Get(':id')
    @Permissions('audit:read:all')
    @ApiOperation({ summary: 'Get a specific audit log by ID' })
    @ApiParam({ name: 'id', description: 'ID of the audit log' })
    @ApiResponse({
        status: 200,
        description: 'The audit log details.',
        type: AuditLogResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Audit log not found.' })
    async getAuditLogById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<AuditLogResponseDto> {
        const log = await this.auditLogService.getAuditLogById(id, scope);

        if (!log) {
            throw new Error('Audit log not found');
        }

        return {
            id: log.id,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            userId: log.userId,
            organizationId: log.organizationId,
            method: log.method,
            url: log.url,
            userAgent: log.userAgent,
            ipAddress: log.ipAddress,
            requestData: log.requestData,
            responseData: log.responseData,
            status: log.status,
            duration: log.duration,
            timestamp: log.timestamp,
            errorMessage: log.errorMessage,
            errorStack: log.errorStack,
            oldValues: log.oldValues,
            newValues: log.newValues,
            user: log.user
                ? {
                      id: log.user.id,
                      email: log.user.email,
                      fullName: log.user.fullName,
                  }
                : undefined,
            createdAt: log.createdAt,
            updatedAt: log.updatedAt,
        };
    }

    @Post('export')
    @Permissions('audit:export')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Export audit logs' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                filters: { $ref: '#/components/schemas/AuditLogFiltersDto' },
                format: { type: 'string', enum: ['CSV', 'JSON'] },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'The exported audit log file.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async exportAuditLogs(
        @Body()
        exportRequest: {
            filters: AuditLogFiltersDto;
            format: 'CSV' | 'JSON';
        },
        @Scope() scope: DataScope
    ) {
        const filters = {
            userId: exportRequest.filters.userId,
            resource: exportRequest.filters.resource,
            action: exportRequest.filters.action,
            resourceId: exportRequest.filters.resourceId,
            startDate: exportRequest.filters.startDate
                ? new Date(exportRequest.filters.startDate)
                : undefined,
            endDate: exportRequest.filters.endDate
                ? new Date(exportRequest.filters.endDate)
                : undefined,
        };

        return this.auditLogService.exportAuditLogs(filters, scope, exportRequest.format || 'CSV');
    }

    @Post('cleanup')
    @Permissions('audit:admin')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cleanup old audit logs' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                olderThanDays: { type: 'number' },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'The result of the cleanup operation.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async cleanupOldAuditLogs(
        @Body()
        cleanupRequest: {
            olderThanDays: number;
        },
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        const deletedCount = await this.auditLogService.cleanupOldAuditLogs(
            cleanupRequest.olderThanDays,
            scope.organizationId
        );

        return {
            message: `Successfully deleted ${deletedCount} old audit log records`,
            deletedCount,
            olderThanDays: cleanupRequest.olderThanDays,
            organizationId: scope.organizationId,
        };
    }
}
