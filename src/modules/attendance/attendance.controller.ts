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
import { AttendanceService } from './attendance.service';
import {
    AttendanceFiltersDto,
    AttendanceResponseDto,
    AttendanceStatsDto,
    AttendanceSummaryDto,
    CreateAttendanceDto,
    PaginationDto,
    PaginationResponseDto,
} from '../../shared/dto';
import { Permissions, Scope, User } from '../../shared/decorators';
import { DataScope, UserContext } from '../../shared/interfaces';

@Controller('attendance')
export class AttendanceController {
    constructor(private readonly attendanceService: AttendanceService) {}

    @Post()
    @Permissions('attendance:create')
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
    async deleteAttendanceRecord(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.attendanceService.deleteAttendanceRecord(id, scope);
    }

    @Get('reports/daily')
    @Permissions('attendance:read:all')
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
