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
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import {
    AttendanceFiltersDto,
    AttendanceResponseDto,
    AttendanceStatsDto,
    AttendanceSummaryDto,
    CreateAttendanceDto,
    PaginationDto,
    PaginationResponseDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { DataScope, UserContext } from '@/shared/interfaces';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
    constructor(private readonly attendanceService: AttendanceService) {}

    @Post()
    @Permissions('attendance:create')
    @ApiOperation({ summary: 'Create a new attendance record' })
    @ApiBody({ type: CreateAttendanceDto })
    @ApiResponse({
        status: 201,
        description: 'The attendance record has been successfully created.',
        type: AttendanceResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async createAttendanceRecord(
        @Body() createAttendanceDto: CreateAttendanceDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<AttendanceResponseDto> {
        const attendance = await this.attendanceService.createAttendanceRecord(
            createAttendanceDto,
            scope
        );

        return {
            id: attendance.id,
            organizationId: attendance.organizationId,
            branchId: attendance.branchId,
            employeeId: attendance.employeeId,
            guestId: attendance.guestId,
            deviceId: attendance.deviceId,
            eventType: attendance.eventType,
            timestamp: attendance.timestamp,
            meta: attendance.meta,
            createdAt: attendance.createdAt,
        };
    }

    @Get()
    @Permissions('attendance:read:all')
    @ApiOperation({ summary: 'Get all attendance records with filters and pagination' })
    @ApiQuery({ name: 'filtersDto', type: AttendanceFiltersDto })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of attendance records.',
        type: PaginationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getAttendanceRecords(
        @Scope() scope: DataScope,
        @Query() filtersDto: AttendanceFiltersDto,
        @Query() paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<AttendanceResponseDto>> {
        const filters = {
            employeeId: filtersDto.employeeId,
            branchId: filtersDto.branchId,
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
        };

        const attendanceRecords = await this.attendanceService.getAttendanceRecords(filters, scope);

        // Simple pagination (in a real app, you'd do this at the database level)
        const { page = 1, limit = 50 } = paginationDto;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedRecords = attendanceRecords.slice(startIndex, endIndex);

        const responseRecords = paginatedRecords.map(record => ({
            id: record.id,
            organizationId: record.organizationId,
            branchId: record.branchId,
            employeeId: record.employeeId,
            guestId: record.guestId,
            deviceId: record.deviceId,
            eventType: record.eventType,
            timestamp: record.timestamp,
            meta: record.meta,
            createdAt: record.createdAt,
            employee: record.employee,
            device: record.device,
        }));

        return new PaginationResponseDto(responseRecords, attendanceRecords.length, page, limit);
    }

    @Get('stats')
    @Permissions('attendance:read:all')
    @ApiOperation({ summary: 'Get attendance statistics' })
    @ApiQuery({ name: 'filtersDto', type: AttendanceFiltersDto })
    @ApiResponse({
        status: 200,
        description: 'Attendance statistics.',
        type: AttendanceStatsDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
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
    @Permissions('attendance:read:all')
    @ApiOperation({ summary: 'Get all attendance records for a specific employee' })
    @ApiParam({ name: 'employeeId', description: 'ID of the employee' })
    @ApiQuery({ name: 'filtersDto', type: AttendanceFiltersDto })
    @ApiResponse({
        status: 200,
        description: 'A list of attendance records for the employee.',
        type: [AttendanceResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Employee not found.' })
    async getEmployeeAttendance(
        @Param('employeeId') employeeId: string,
        @Scope() scope: DataScope,
        @Query() filtersDto: AttendanceFiltersDto
    ): Promise<AttendanceResponseDto[]> {
        const filters = {
            employeeId,
            branchId: filtersDto.branchId,
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
        };

        const attendanceRecords = await this.attendanceService.getAttendanceRecords(filters, scope);

        return attendanceRecords.map(record => ({
            id: record.id,
            organizationId: record.organizationId,
            branchId: record.branchId,
            employeeId: record.employeeId,
            guestId: record.guestId,
            deviceId: record.deviceId,
            eventType: record.eventType,
            timestamp: record.timestamp,
            meta: record.meta,
            createdAt: record.createdAt,
            employee: record.employee,
            device: record.device,
        }));
    }

    @Get('employee/:employeeId/summary')
    @Permissions('attendance:read:all')
    @ApiOperation({ summary: 'Get attendance summary for a specific employee' })
    @ApiParam({ name: 'employeeId', description: 'ID of the employee' })
    @ApiQuery({ name: 'startDate', description: 'Start date for the summary (YYYY-MM-DD)' })
    @ApiQuery({ name: 'endDate', description: 'End date for the summary (YYYY-MM-DD)' })
    @ApiResponse({
        status: 200,
        description: 'Attendance summary for the employee.',
        type: AttendanceSummaryDto,
    })
    @ApiResponse({ status: 400, description: 'Start date and end date are required.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Employee not found.' })
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
    @Permissions('attendance:read:all')
    @ApiOperation({ summary: 'Get all attendance records for a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiQuery({ name: 'filtersDto', type: AttendanceFiltersDto })
    @ApiResponse({
        status: 200,
        description: 'A list of attendance records for the branch.',
        type: [AttendanceResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Branch not found.' })
    async getBranchAttendance(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope,
        @Query() filtersDto: AttendanceFiltersDto
    ): Promise<AttendanceResponseDto[]> {
        const filters = {
            branchId,
            employeeId: filtersDto.employeeId,
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
        };

        const attendanceRecords = await this.attendanceService.getAttendanceRecords(filters, scope);

        return attendanceRecords.map(record => ({
            id: record.id,
            organizationId: record.organizationId,
            branchId: record.branchId,
            employeeId: record.employeeId,
            guestId: record.guestId,
            deviceId: record.deviceId,
            eventType: record.eventType,
            timestamp: record.timestamp,
            meta: record.meta,
            createdAt: record.createdAt,
            employee: record.employee,
            device: record.device,
        }));
    }

    @Get('today')
    @Permissions('attendance:read:all')
    @ApiOperation({ summary: "Get today's attendance records" })
    @ApiQuery({
        name: 'filtersDto',
        type: AttendanceFiltersDto,
        description: 'Filter by employeeId or branchId',
    })
    @ApiResponse({
        status: 200,
        description: "A list of today's attendance records.",
        type: [AttendanceResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getTodayAttendance(
        @Scope() scope: DataScope,
        @Query() filtersDto: Pick<AttendanceFiltersDto, 'employeeId' | 'branchId'>
    ): Promise<AttendanceResponseDto[]> {
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

        const attendanceRecords = await this.attendanceService.getAttendanceRecords(filters, scope);

        return attendanceRecords.map(record => ({
            id: record.id,
            organizationId: record.organizationId,
            branchId: record.branchId,
            employeeId: record.employeeId,
            guestId: record.guestId,
            deviceId: record.deviceId,
            eventType: record.eventType,
            timestamp: record.timestamp,
            meta: record.meta,
            createdAt: record.createdAt,
            employee: record.employee,
            device: record.device,
        }));
    }

    @Get('live')
    @Permissions('attendance:read:all')
    @ApiOperation({ summary: 'Get live attendance data (currently present and recent activity)' })
    @ApiQuery({
        name: 'filtersDto',
        type: AttendanceFiltersDto,
        description: 'Filter by branchId',
    })
    @ApiResponse({
        status: 200,
        description: 'Live attendance data.',
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getLiveAttendance(
        @Scope() scope: DataScope,
        @Query() filtersDto: Pick<AttendanceFiltersDto, 'branchId'>
    ): Promise<{
        currentlyPresent: Array<{
            employeeId: string;
            employeeName: string;
            employeeCode: string;
            checkInTime: Date;
            duration: string;
        }>;
        recentActivity: AttendanceResponseDto[];
    }> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const filters = {
            branchId: filtersDto.branchId,
            startDate: today,
            endDate: new Date(),
        };

        const todayRecords = await this.attendanceService.getAttendanceRecords(filters, scope);

        // Group by employee to find current status
        const employeeStatus = new Map<
            string,
            {
                employee: any;
                lastCheckIn?: Date;
                lastCheckOut?: Date;
                isPresent: boolean;
            }
        >();

        todayRecords.forEach(record => {
            if (!record.employeeId || !record.employee) return;

            const employeeId = record.employeeId;
            if (!employeeStatus.has(employeeId)) {
                employeeStatus.set(employeeId, {
                    employee: record.employee,
                    isPresent: false,
                });
            }

            const status = employeeStatus.get(employeeId)!;

            if (record.eventType === 'CHECK_IN') {
                if (!status.lastCheckIn || record.timestamp > status.lastCheckIn) {
                    status.lastCheckIn = record.timestamp;
                }
            } else if (record.eventType === 'CHECK_OUT') {
                if (!status.lastCheckOut || record.timestamp > status.lastCheckOut) {
                    status.lastCheckOut = record.timestamp;
                }
            }

            // Determine if currently present
            if (
                status.lastCheckIn &&
                (!status.lastCheckOut || status.lastCheckIn > status.lastCheckOut)
            ) {
                status.isPresent = true;
            } else {
                status.isPresent = false;
            }
        });

        // Build currently present list
        const currentlyPresent = Array.from(employeeStatus.values())
            .filter(status => status.isPresent && status.lastCheckIn)
            .map(status => {
                const duration = this.calculateDuration(status.lastCheckIn!, new Date());
                return {
                    employeeId: status.employee.id,
                    employeeName: `${status.employee.firstName} ${status.employee.lastName}`,
                    employeeCode: status.employee.employeeCode,
                    checkInTime: status.lastCheckIn!,
                    duration,
                };
            })
            .sort((a, b) => a.checkInTime.getTime() - b.checkInTime.getTime());

        // Get recent activity (last 20 records)
        const recentActivity = todayRecords
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 20)
            .map(record => ({
                id: record.id,
                organizationId: record.organizationId,
                branchId: record.branchId,
                employeeId: record.employeeId,
                guestId: record.guestId,
                deviceId: record.deviceId,
                eventType: record.eventType,
                timestamp: record.timestamp,
                meta: record.meta,
                createdAt: record.createdAt,
                employee: record.employee,
                device: record.device,
            }));

        return {
            currentlyPresent,
            recentActivity,
        };
    }

    @Get(':id')
    @Permissions('attendance:read:all')
    @ApiOperation({ summary: 'Get a specific attendance record by ID' })
    @ApiParam({ name: 'id', description: 'ID of the attendance record' })
    @ApiResponse({
        status: 200,
        description: 'The attendance record.',
        type: AttendanceResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Attendance record not found.' })
    async getAttendanceById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<AttendanceResponseDto> {
        const attendance = await this.attendanceService.getAttendanceById(id, scope);

        return {
            id: attendance.id,
            organizationId: attendance.organizationId,
            branchId: attendance.branchId,
            employeeId: attendance.employeeId,
            guestId: attendance.guestId,
            deviceId: attendance.deviceId,
            eventType: attendance.eventType,
            timestamp: attendance.timestamp,
            meta: attendance.meta,
            createdAt: attendance.createdAt,
            employee: (attendance as any).employee,
            device: (attendance as any).device,
        };
    }

    @Delete(':id')
    @Permissions('attendance:delete:managed')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete an attendance record' })
    @ApiParam({ name: 'id', description: 'ID of the attendance record to delete' })
    @ApiResponse({ status: 204, description: 'The record has been successfully deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Attendance record not found.' })
    async deleteAttendanceRecord(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.attendanceService.deleteAttendanceRecord(id, scope);
    }

    @Get('reports/daily')
    @Permissions('attendance:read:all')
    @ApiOperation({ summary: 'Get a daily attendance report' })
    @ApiQuery({ name: 'date', description: 'Date for the report (YYYY-MM-DD)', required: false })
    @ApiQuery({ name: 'branchId', description: 'Filter by branch ID', required: false })
    @ApiResponse({ status: 200, description: 'The daily attendance report.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getDailyAttendanceReport(
        @Query('date') date: string,
        @Query('branchId') branchId?: string,
        @Scope() scope?: DataScope
    ) {
        const reportDate = date ? new Date(date) : new Date();
        return this.attendanceService.getDailyAttendanceReport(reportDate, branchId, scope);
    }

    @Get('reports/weekly')
    @Permissions('attendance:read:all')
    @ApiOperation({ summary: 'Get a weekly attendance report' })
    @ApiQuery({ name: 'startDate', description: 'Start date for the report (YYYY-MM-DD)' })
    @ApiQuery({ name: 'branchId', description: 'Filter by branch ID', required: false })
    @ApiResponse({ status: 200, description: 'The weekly attendance report.' })
    @ApiResponse({ status: 400, description: 'Start date is required.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
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
    @Permissions('attendance:read:all')
    @ApiOperation({ summary: 'Get a monthly attendance report' })
    @ApiQuery({ name: 'year', description: 'Year for the report (YYYY)' })
    @ApiQuery({ name: 'month', description: 'Month for the report (1-12)' })
    @ApiQuery({ name: 'branchId', description: 'Filter by branch ID', required: false })
    @ApiResponse({ status: 200, description: 'The monthly attendance report.' })
    @ApiResponse({ status: 400, description: 'Year and month are required.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
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

    private calculateDuration(startTime: Date, endTime: Date): string {
        const diffMs = endTime.getTime() - startTime.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }
}
