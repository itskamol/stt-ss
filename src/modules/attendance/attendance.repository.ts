import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateAttendanceDto } from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';
import { QueryBuilder } from '../../shared/utils/query-builder.util';

@Injectable()
export class AttendanceRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: CreateAttendanceDto, scope: DataScope) {
        return this.prisma.attendance.create({
            data: {
                organizationId: data.organizationId,
                branchId: data.branchId,
                employeeId: data.employeeId,
                deviceId: data.deviceId,
                eventType: data.eventType as any,
                timestamp: data.timestamp,
                meta: data.metadata,
            },
        });
    }

    async findById(id: string, scope: DataScope) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.attendance.findFirst({
            where: {
                id,
                ...whereClause,
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeCode: true,
                    },
                },
                device: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                    },
                },
            },
        });
    }

    async findMany(
        filters: {
            employeeId?: string;
            branchId?: string;
            startDate?: Date;
            endDate?: Date;
        },
        scope: DataScope
    ) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const where: any = {
            ...whereClause,
        };

        if (filters.employeeId) {
            where.employeeId = filters.employeeId;
        }

        if (filters.branchId) {
            where.branchId = filters.branchId;
        }

        if (filters.startDate || filters.endDate) {
            where.timestamp = {};
            if (filters.startDate) {
                where.timestamp.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.timestamp.lte = filters.endDate;
            }
        }

        return this.prisma.attendance.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeCode: true,
                    },
                },
                device: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                    },
                },
            },
            orderBy: { timestamp: 'desc' },
        });
    }

    async findLastAttendanceForEmployee(employeeId: string, date: Date, scope: DataScope) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return this.prisma.attendance.findFirst({
            where: {
                employeeId,
                timestamp: {
                    gte: date,
                    lte: endOfDay,
                },
                ...whereClause,
            },
            orderBy: { timestamp: 'desc' },
        });
    }

    async delete(id: string, scope: DataScope) {
        await this.prisma.attendance.delete({
            where: { id },
        });
    }

    async getAttendanceStats(
        filters: {
            branchId?: string;
            startDate?: Date;
            endDate?: Date;
        },
        scope: DataScope
    ) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const where: any = {
            ...whereClause,
        };

        if (filters.branchId) {
            where.branchId = filters.branchId;
        }

        if (filters.startDate || filters.endDate) {
            where.timestamp = {};
            if (filters.startDate) {
                where.timestamp.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.timestamp.lte = filters.endDate;
            }
        }

        const [totalRecords, eventsByType, recordsByEmployee] = await Promise.all([
            // Total attendance records
            this.prisma.attendance.count({ where }),

            // Records grouped by event type
            this.prisma.attendance.groupBy({
                by: ['eventType'],
                where,
                _count: {
                    id: true,
                },
                orderBy: {
                    _count: {
                        id: 'desc',
                    },
                },
            }),

            // Records grouped by employee
            this.prisma.attendance.groupBy({
                by: ['employeeId'],
                where,
                _count: {
                    id: true,
                },
                orderBy: {
                    _count: {
                        id: 'desc',
                    },
                },
                take: 10, // Top 10 employees
            }),
        ]);

        // Get employee names for the top employees
        const employeeIds = recordsByEmployee.map(item => item.employeeId).filter(Boolean);
        const employees = await this.prisma.employee.findMany({
            where: {
                id: { in: employeeIds },
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
            },
        });

        const employeeMap = new Map(
            employees.map(e => [e.id, `${e.firstName} ${e.lastName} (${e.employeeCode})`])
        );

        return {
            totalRecords,
            eventsByType: eventsByType.map(item => ({
                eventType: item.eventType,
                count: item._count.id,
            })),
            recordsByEmployee: recordsByEmployee.map(item => ({
                employeeId: item.employeeId,
                employeeName: item.employeeId
                    ? employeeMap.get(item.employeeId) || 'Unknown Employee'
                    : 'Guest',
                count: item._count.id,
            })),
        };
    }

    async getAttendanceByDateRange(
        startDate: Date,
        endDate: Date,
        scope: DataScope
    ): Promise<Array<{ date: string; count: number }>> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const records = await this.prisma.attendance.findMany({
            where: {
                timestamp: {
                    gte: startDate,
                    lte: endDate,
                },
                ...whereClause,
            },
            select: {
                timestamp: true,
            },
        });

        // Group by date
        const dateGroups = new Map<string, number>();
        records.forEach(record => {
            const dateKey = record.timestamp.toISOString().split('T')[0];
            dateGroups.set(dateKey, (dateGroups.get(dateKey) || 0) + 1);
        });

        return Array.from(dateGroups.entries())
            .map(([date, count]) => ({
                date,
                count,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
}
