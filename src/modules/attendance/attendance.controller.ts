import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiExtraModels,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
    getSchemaPath,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
    AttendanceFiltersDto,
    AttendanceResponseDto,
    AttendanceStatsDto,
    AttendanceSummaryDto,
    CreateAttendanceDto,
    PaginationDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';
import { ApiOkResponseData, ApiOkResponsePaginated } from '@/shared/utils';
import { Attendance } from '@prisma/client';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
@ApiExtraModels(ApiSuccessResponse, AttendanceResponseDto, AttendanceStatsDto, AttendanceSummaryDto)
export class AttendanceController {
    constructor(private readonly attendanceService: AttendanceService) {}

    @Post()
    @Permissions(PERMISSIONS.ATTENDANCE.CREATE)
    @ApiOperation({ summary: 'Create a new attendance record' })
    @ApiBody({ type: CreateAttendanceDto })
    @ApiResponse({
        status: 201,
        description: 'The attendance record has been successfully created.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(AttendanceResponseDto) },
                    },
                },
            ],
        }
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async createAttendanceRecord(
        @Body() createAttendanceDto: CreateAttendanceDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Attendance> {
        return this.attendanceService.createAttendanceRecord(
            createAttendanceDto,
            scope
        );
    }

    @Get()
    @Permissions(PERMISSIONS.ATTENDANCE.READ_ALL)
    @ApiOperation({ summary: 'Get all attendance records with filters and pagination' })
    @ApiOkResponsePaginated(AttendanceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getAttendanceRecords(
        @Scope() scope: DataScope,
        @Query() filtersDto: AttendanceFiltersDto,
        @Query() paginationDto: PaginationDto
    ) {
        const filters = {
            employeeId: filtersDto.employeeId,
            branchId: filtersDto.branchId,
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
        };

        return this.attendanceService.getAttendanceRecords(filters, scope, paginationDto);
    }

    @Get('stats')
    @Permissions(PERMISSIONS.ATTENDANCE.READ_ALL)
    @ApiOperation({ summary: 'Get attendance statistics' })
    @ApiQuery({ name: 'filtersDto', type: AttendanceFiltersDto })
    @ApiOkResponseData(AttendanceStatsDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getAttendanceStats(
        @Scope() scope: DataScope,
        @Query() filtersDto: AttendanceFiltersDto
    ): Promise<AttendanceStatsDto> {
        const filters = {
            branchId: filtersDto.branchId,
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
        };

        return this.attendanceService.getAttendanceStats(filters, scope);
    }

    @Get('employee/:employeeId')
    @Permissions(PERMISSIONS.ATTENDANCE.READ_ALL)
    @ApiOperation({ summary: 'Get all attendance records for a specific employee' })
    @ApiParam({ name: 'employeeId', description: 'ID of the employee' })
    @ApiQuery({ name: 'filtersDto', type: AttendanceFiltersDto })
    @ApiOkResponsePaginated(AttendanceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ApiErrorResponse })
    async getEmployeeAttendance(
        @Param('employeeId') employeeId: string,
        @Scope() scope: DataScope,
        @Query() filtersDto: AttendanceFiltersDto,
        @Query() paginationDto: PaginationDto
    ) {
        const filters = {
            employeeId,
            branchId: filtersDto.branchId,
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
        };

        return this.attendanceService.getAttendanceRecords(filters, scope, paginationDto);
    }

    @Get('employee/:employeeId/summary')
    @Permissions(PERMISSIONS.ATTENDANCE.READ_ALL)
    @ApiOperation({ summary: 'Get attendance summary for a specific employee' })
    @ApiParam({ name: 'employeeId', description: 'ID of the employee' })
    @ApiQuery({ name: 'startDate', description: 'Start date for the summary (YYYY-MM-DD)' })
    @ApiQuery({ name: 'endDate', description: 'End date for the summary (YYYY-MM-DD)' })
    @ApiOkResponseData(AttendanceSummaryDto)
    @ApiResponse({ status: 400, description: 'Start date and end date are required.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ApiErrorResponse })
    async getEmployeeAttendanceSummary(
        @Param('employeeId') employeeId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Scope() scope: DataScope
    ): Promise<AttendanceSummaryDto> {
        if (!startDate || !endDate) {
            throw new Error('Start date and end date are required');
        }

        return this.attendanceService.getAttendanceSummary(
            employeeId,
            new Date(startDate),
            new Date(endDate),
            scope
        );
    }

    @Get('branch/:branchId')
    @Permissions(PERMISSIONS.ATTENDANCE.READ_ALL)
    @ApiOperation({ summary: 'Get all attendance records for a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiQuery({ name: 'filtersDto', type: AttendanceFiltersDto })
    @ApiOkResponsePaginated(AttendanceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ApiErrorResponse })
    async getBranchAttendance(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope,
        @Query() filtersDto: AttendanceFiltersDto,
        @Query() paginationDto: PaginationDto
    ) {
        const filters = {
            branchId,
            employeeId: filtersDto.employeeId,
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
        };

        return this.attendanceService.getAttendanceRecords(filters, scope, paginationDto);
    }

    @Get('today')
    @Permissions(PERMISSIONS.ATTENDANCE.READ_ALL)
    @ApiOperation({ summary: "Get today's attendance records" })
    @ApiQuery({
        name: 'filtersDto',
        type: AttendanceFiltersDto,
        description: 'Filter by employeeId or branchId',
    })
    @ApiOkResponsePaginated(AttendanceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getTodayAttendance(
        @Scope() scope: DataScope,
        @Query() filtersDto: Pick<AttendanceFiltersDto, 'employeeId' | 'branchId'>,
        @Query() paginationDto: PaginationDto
    ) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const filters = {
            employeeId: filtersDto.employeeId,
            branchId: filtersDto.branchId,
            startDate: today,
            endDate: tomorrow,
        };

        return this.attendanceService.getAttendanceRecords(filters, scope, paginationDto);
    }

    @Get('live')
    @Permissions(PERMISSIONS.ATTENDANCE.READ_ALL)
    @ApiOperation({ summary: 'Get live attendance data (currently present and recent activity)' })
    @ApiQuery({
        name: 'filtersDto',
        type: AttendanceFiltersDto,
        description: 'Filter by branchId',
    })
    @ApiResponse({ status: 200, description: 'Live attendance data.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getLiveAttendance(
        @Scope() scope: DataScope,
        @Query() filtersDto: Pick<AttendanceFiltersDto, 'branchId'>
    ) {
        return this.attendanceService.getLiveAttendance(scope, filtersDto);
    }

    @Get(':id')
    @Permissions(PERMISSIONS.ATTENDANCE.READ_ALL)
    @ApiOperation({ summary: 'Get a specific attendance record by ID' })
    @ApiParam({ name: 'id', description: 'ID of the attendance record' })
    @ApiOkResponseData(AttendanceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Attendance record not found.', type: ApiErrorResponse })
    async getAttendanceById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<Attendance> {
        return this.attendanceService.getAttendanceById(id, scope);
    }

    @Delete(':id')
    @Permissions(PERMISSIONS.ATTENDANCE.DELETE_MANAGED)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete an attendance record' })
    @ApiParam({ name: 'id', description: 'ID of the attendance record to delete' })
    @ApiResponse({ status: 204, description: 'The record has been successfully deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Attendance record not found.', type: ApiErrorResponse })
    async deleteAttendanceRecord(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.attendanceService.deleteAttendanceRecord(id, scope);
    }

    @Get('reports/daily')
    @Permissions(PERMISSIONS.ATTENDANCE.READ_ALL)
    @ApiOperation({ summary: 'Get a daily attendance report' })
    @ApiQuery({ name: 'date', description: 'Date for the report (YYYY-MM-DD)', required: false })
    @ApiQuery({ name: 'branchId', description: 'Filter by branch ID', required: false })
    @ApiResponse({ status: 200, description: 'The daily attendance report.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getDailyAttendanceReport(
        @Query('date') date: string,
        @Query('branchId') branchId?: string,
        @Scope() scope?: DataScope
    ) {
        const reportDate = date ? new Date(date) : new Date();
        return this.attendanceService.getDailyAttendanceReport(reportDate, branchId, scope);
    }

    @Get('reports/weekly')
    @Permissions(PERMISSIONS.ATTENDANCE.READ_ALL)
    @ApiOperation({ summary: 'Get a weekly attendance report' })
    @ApiQuery({ name: 'startDate', description: 'Start date for the report (YYYY-MM-DD)' })
    @ApiQuery({ name: 'branchId', description: 'Filter by branch ID', required: false })
    @ApiResponse({ status: 200, description: 'The weekly attendance report.' })
    @ApiResponse({ status: 400, description: 'Start date is required.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getWeeklyAttendanceReport(
        @Query('startDate') startDate: string,
        @Query('branchId') branchId?: string,
        @Scope() scope?: DataScope
    ) {
        if (!startDate) {
            throw new Error('Start date is required for weekly report');
        }
        return this.attendanceService.getWeeklyAttendanceReport(
            new Date(startDate),
            branchId,
            scope
        );
    }

    @Get('reports/monthly')
    @Permissions(PERMISSIONS.ATTENDANCE.READ_ALL)
    @ApiOperation({ summary: 'Get a monthly attendance report' })
    @ApiQuery({ name: 'year', description: 'Year for the report (YYYY)' })
    @ApiQuery({ name: 'month', description: 'Month for the report (1-12)' })
    @ApiQuery({ name: 'branchId', description: 'Filter by branch ID', required: false })
    @ApiResponse({ status: 200, description: 'The monthly attendance report.' })
    @ApiResponse({ status: 400, description: 'Year and month are required.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getMonthlyAttendanceReport(
        @Query('year') year: string,
        @Query('month') month: string,
        @Query('branchId') branchId?: string,
        @Scope() scope?: DataScope
    ) {
        if (!year || !month) {
            throw new Error('Year and month are required for monthly report');
        }
        return this.attendanceService.getMonthlyAttendanceReport(
            parseInt(year),
            parseInt(month),
            branchId,
            scope
        );
    }
}
