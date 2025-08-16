import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceRepository } from './attendance.repository';
import {
    CreateAttendanceDto,
    AttendanceFiltersDto,
    PaginationDto,
    PaginationResponseDto,
} from '@/shared/dto';
import { DataScope } from '@/shared/interfaces';
import { Attendance } from '@prisma/client';

@Injectable()
export class AttendanceService {
    constructor(
        private readonly attendanceRepository: AttendanceRepository
    ) {}

    async createAttendanceRecord(createAttendanceDto: CreateAttendanceDto, scope: DataScope): Promise<Attendance> {
        return this.attendanceRepository.create(createAttendanceDto, scope);
    }

    async getLastAttendanceForEmployee(employeeId: string, date: Date, scope: DataScope): Promise<Attendance> {
        const attendance = await this.attendanceRepository.findLastAttendanceForEmployee(employeeId, date, scope);
        if (!attendance) {
            throw new NotFoundException('Attendance record not found');
        }
        return attendance;
    }

    async getAttendanceRecords(
        filters: {
            employeeId?: string;
            branchId?: string;
            startDate?: Date;
            endDate?: Date;
        },
        scope: DataScope,
        paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<Attendance>> {
        const { page, limit } = paginationDto;
        const skip = (page - 1) * limit;

        const [records, total] = await Promise.all([
            this.attendanceRepository.findMany(scope, skip, limit, filters),
            this.attendanceRepository.count(scope, filters),
        ]);

        return new PaginationResponseDto(records, total, page, limit);
    }

    async getAttendanceById(id: string, scope: DataScope): Promise<Attendance> {
        const attendance = await this.attendanceRepository.findById(id, scope);
        if (!attendance) {
            throw new NotFoundException('Attendance record not found');
        }
        return attendance;
    }

    async getAttendanceSummary(
        employeeId: string,
        startDate: Date,
        endDate: Date,
        scope: DataScope
    ) {
        const attendanceRecords = await this.attendanceRepository.findMany(scope, 0, 1000, { // Assuming a reasonable limit for summary
            employeeId,
            startDate,
            endDate,
        });

        // Group by date and calculate hours
        const dailySummary = new Map<
            string,
            {
                date: string;
                checkIn?: Date;
                checkOut?: Date;
                totalHours: number;
                status: 'present' | 'partial' | 'absent';
            }
        >();

        attendanceRecords.forEach(record => {
            const dateKey = record.timestamp.toISOString().split('T')[0];

            if (!dailySummary.has(dateKey)) {
                dailySummary.set(dateKey, {
                    date: dateKey,
                    totalHours: 0,
                    status: 'absent',
                });
            }

            const dayData = dailySummary.get(dateKey)!;

            if (record.eventType === 'CHECK_IN') {
                dayData.checkIn = record.timestamp;
                dayData.status = 'partial';
            } else if (record.eventType === 'CHECK_OUT') {
                dayData.checkOut = record.timestamp;

                if (dayData.checkIn) {
                    const hours =
                        (record.timestamp.getTime() - dayData.checkIn.getTime()) / (1000 * 60 * 60);
                    dayData.totalHours = Math.round(hours * 100) / 100;
                    dayData.status = 'present';
                }
            }
        });

        const summary = Array.from(dailySummary.values()).sort((a, b) =>
            a.date.localeCompare(b.date)
        );

        const totalHours = summary.reduce((sum, day) => sum + day.totalHours, 0);
        const presentDays = summary.filter(day => day.status === 'present').length;
        const partialDays = summary.filter(day => day.status === 'partial').length;
        const absentDays = summary.filter(day => day.status === 'absent').length;

        return {
            employeeId,
            startDate,
            endDate,
            totalHours: Math.round(totalHours * 100) / 100,
            presentDays,
            partialDays,
            absentDays,
            dailySummary: summary,
        };
    }

    async deleteAttendanceRecord(id: string, scope: DataScope) {
        await this.getAttendanceById(id, scope);
        await this.attendanceRepository.delete(id, scope);
    }

    async getAttendanceStats(
        filters: {
            branchId?: string;
            startDate?: Date;
            endDate?: Date;
        },
        scope: DataScope
    ) {
        return this.attendanceRepository.getAttendanceStats(filters, scope);
    }

    async getDailyAttendanceReport(date: Date, branchId?: string, scope?: DataScope) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const filters = {
            branchId,
            startDate: startOfDay,
            endDate: endOfDay,
        };

        const attendanceRecords = await this.attendanceRepository.findMany(scope, 0, 10000, filters); // Large limit for report

        // Group by employee
        const employeeAttendance = new Map<
            string,
            {
                employee: any;
                checkIns: Date[];
                checkOuts: Date[];
                totalHours: number;
                status: 'present' | 'partial' | 'absent';
            }
        >();

        attendanceRecords.forEach(record => {
            if (!record.employeeId || !record.employee) return;

            const employeeId = record.employeeId;
            if (!employeeAttendance.has(employeeId)) {
                employeeAttendance.set(employeeId, {
                    employee: record.employee,
                    checkIns: [],
                    checkOuts: [],
                    totalHours: 0,
                    status: 'absent',
                });
            }

            const attendance = employeeAttendance.get(employeeId)!;

            if (record.eventType === 'CHECK_IN') {
                attendance.checkIns.push(record.timestamp);
            } else if (record.eventType === 'CHECK_OUT') {
                attendance.checkOuts.push(record.timestamp);
            }
        });

        // Calculate hours and status for each employee
        const report = Array.from(employeeAttendance.values()).map(attendance => {
            attendance.checkIns.sort((a, b) => a.getTime() - b.getTime());
            attendance.checkOuts.sort((a, b) => a.getTime() - b.getTime());

            let totalHours = 0;
            let status: 'present' | 'partial' | 'absent' = 'absent';

            // Calculate total hours worked
            const minLength = Math.min(attendance.checkIns.length, attendance.checkOuts.length);
            for (let i = 0; i < minLength; i++) {
                const checkIn = attendance.checkIns[i];
                const checkOut = attendance.checkOuts[i];
                if (checkOut > checkIn) {
                    totalHours += (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
                }
            }

            // Determine status
            if (attendance.checkIns.length > 0) {
                if (attendance.checkIns.length === attendance.checkOuts.length) {
                    status = 'present';
                } else {
                    status = 'partial'; // Still checked in
                }
            }

            return {
                employee: {
                    id: attendance.employee.id,
                    firstName: attendance.employee.firstName,
                    lastName: attendance.employee.lastName,
                    employeeCode: attendance.employee.employeeCode,
                },
                checkIns: attendance.checkIns,
                checkOuts: attendance.checkOuts,
                totalHours: Math.round(totalHours * 100) / 100,
                status,
                firstCheckIn: attendance.checkIns[0] || null,
                lastCheckOut: attendance.checkOuts[attendance.checkOuts.length - 1] || null,
            };
        });

        return {
            date,
            branchId,
            totalEmployees: report.length,
            presentEmployees: report.filter(r => r.status === 'present').length,
            partialEmployees: report.filter(r => r.status === 'partial').length,
            absentEmployees: report.filter(r => r.status === 'absent').length,
            totalHours: report.reduce((sum, r) => sum + r.totalHours, 0),
            averageHours:
                report.length > 0
                    ? report.reduce((sum, r) => sum + r.totalHours, 0) / report.length
                    : 0,
            employeeDetails: report.sort((a, b) =>
                a.employee.employeeCode.localeCompare(b.employee.employeeCode)
            ),
        };
    }

    async getWeeklyAttendanceReport(startDate: Date, branchId?: string, scope?: DataScope) {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);

        const dailyReports = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dailyReport = await this.getDailyAttendanceReport(
                new Date(currentDate),
                branchId,
                scope
            );
            dailyReports.push(dailyReport);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const totalHours = dailyReports.reduce((sum, report) => sum + report.totalHours, 0);
        const totalEmployees = Math.max(...dailyReports.map(r => r.totalEmployees));
        const averageDailyHours = dailyReports.length > 0 ? totalHours / dailyReports.length : 0;

        return {
            startDate,
            endDate,
            branchId,
            totalHours: Math.round(totalHours * 100) / 100,
            averageDailyHours: Math.round(averageDailyHours * 100) / 100,
            totalEmployees,
            dailyReports,
        };
    }

    async getMonthlyAttendanceReport(
        year: number,
        month: number,
        branchId?: string,
        scope?: DataScope
    ) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const filters = {
            branchId,
            startDate,
            endDate,
        };

        const attendanceRecords = await this.attendanceRepository.findMany(scope, 0, 10000, filters); // Large limit for report

        // Group by employee and date
        const employeeMonthlyData = new Map<
            string,
            {
                employee: any;
                dailyHours: Map<string, number>;
                totalHours: number;
                daysWorked: number;
            }
        >();

        attendanceRecords.forEach(record => {
            if (!record.employeeId || !record.employee) return;

            const employeeId = record.employeeId;
            const dateKey = record.timestamp.toISOString().split('T')[0];

            if (!employeeMonthlyData.has(employeeId)) {
                employeeMonthlyData.set(employeeId, {
                    employee: record.employee,
                    dailyHours: new Map(),
                    totalHours: 0,
                    daysWorked: 0,
                });
            }

            // This is a simplified calculation - in reality you'd need to pair check-ins with check-outs
            // For now, we'll just count the records
            const employeeData = employeeMonthlyData.get(employeeId)!;
            if (!employeeData.dailyHours.has(dateKey)) {
                employeeData.dailyHours.set(dateKey, 0);
            }
        });

        const monthlyReport = Array.from(employeeMonthlyData.values()).map(data => {
            const daysWorked = data.dailyHours.size;
            const totalHours = Array.from(data.dailyHours.values()).reduce(
                (sum, hours) => sum + hours,
                0
            );

            return {
                employee: {
                    id: data.employee.id,
                    firstName: data.employee.firstName,
                    lastName: data.employee.lastName,
                    employeeCode: data.employee.employeeCode,
                },
                totalHours: Math.round(totalHours * 100) / 100,
                daysWorked,
                averageHoursPerDay:
                    daysWorked > 0 ? Math.round((totalHours / daysWorked) * 100) / 100 : 0,
                dailyBreakdown: Array.from(data.dailyHours.entries()).map(([date, hours]) => ({
                    date,
                    hours: Math.round(hours * 100) / 100,
                })),
            };
        });

        return {
            year,
            month,
            branchId,
            startDate,
            endDate,
            totalEmployees: monthlyReport.length,
            totalHours: monthlyReport.reduce((sum, emp) => sum + emp.totalHours, 0),
            averageHoursPerEmployee:
                monthlyReport.length > 0
                    ? monthlyReport.reduce((sum, emp) => sum + emp.totalHours, 0) /
                      monthlyReport.length
                    : 0,
            employeeReports: monthlyReport.sort((a, b) =>
                a.employee.employeeCode.localeCompare(b.employee.employeeCode)
            ),
        };
    }

    async getLiveAttendance(
        scope: DataScope,
        filtersDto: Pick<AttendanceFiltersDto, 'branchId'>
    ) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const filters = {
            branchId: filtersDto.branchId,
            startDate: today,
            endDate: new Date(),
        };

        const todayRecords = await this.attendanceRepository.findMany(scope, 0, 1000, filters);

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
            .slice(0, 20);

        return {
            currentlyPresent,
            recentActivity,
        };
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
