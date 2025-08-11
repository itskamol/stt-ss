import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { DataScope } from '../../shared/interfaces';
import { QueryBuilder } from '../../shared/utils/query-builder.util';

export interface CreateReportData {
    name: string;
    type: string;
    format: string;
    parameters: Record<string, any>;
    organizationId: string;
    createdByUserId: string;
    status: string;
    startedAt: Date;
}

export interface UpdateReportData {
    status?: string;
    startedAt?: Date;
    completedAt?: Date;
    errorMessage?: string;
    fileUrl?: string;
    filePath?: string;
    fileSize?: number;
    recordCount?: number;
}

export interface ReportFilters {
    type?: string;
    status?: string;
    createdByUserId?: string;
    startDate?: Date;
    endDate?: Date;
}

@Injectable()
export class ReportRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: CreateReportData) {
        return this.prisma.report.create({
            data: {
                name: data.name,
                type: data.type as any,
                format: data.format as any,
                parameters: data.parameters,
                organizationId: data.organizationId,
                createdByUserId: data.createdByUserId,
                status: data.status as any,
                startedAt: data.startedAt,
            },
        });
    }

    async findById(id: string, scope: DataScope) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.report.findFirst({
            where: {
                id,
                ...whereClause,
            },
            include: {
                createdByUser: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                    },
                },
            },
        });
    }

    async findMany(
        filters: ReportFilters,
        scope: DataScope,
        pagination: {
            page: number;
            limit: number;
        } = { page: 1, limit: 20 }
    ) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const where: any = {
            ...whereClause,
        };

        if (filters.type) {
            where.type = filters.type;
        }

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.createdByUserId) {
            where.createdByUserId = filters.createdByUserId;
        }

        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            if (filters.startDate) {
                where.createdAt.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.createdAt.lte = filters.endDate;
            }
        }

        const skip = (pagination.page - 1) * pagination.limit;

        const [reports, total] = await Promise.all([
            this.prisma.report.findMany({
                where,
                include: {
                    createdByUser: {
                        select: {
                            id: true,
                            email: true,
                            fullName: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: pagination.limit,
            }),
            this.prisma.report.count({ where }),
        ]);

        return {
            data: reports,
            total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: Math.ceil(total / pagination.limit),
        };
    }

    async update(id: string, data: UpdateReportData) {
        const updateData: any = {};

        if (data.status !== undefined) updateData.status = data.status;
        if (data.startedAt !== undefined) updateData.startedAt = data.startedAt;
        if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;
        if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;
        if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl;
        if (data.filePath !== undefined) updateData.filePath = data.filePath;
        if (data.fileSize !== undefined) updateData.fileSize = data.fileSize;
        if (data.recordCount !== undefined) updateData.recordCount = data.recordCount;

        return this.prisma.report.update({
            where: { id },
            data: updateData,
        });
    }

    async delete(id: string) {
        return this.prisma.report.delete({
            where: { id },
        });
    }

    async getReportStats(scope: DataScope) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const [totalReports, reportsByType, reportsByStatus, recentReports] = await Promise.all([
            // Total reports
            this.prisma.report.count({ where: whereClause }),

            // Reports grouped by type
            this.prisma.report.groupBy({
                by: ['type'],
                where: whereClause,
                _count: {
                    id: true,
                },
                orderBy: {
                    _count: {
                        id: 'desc',
                    },
                },
            }),

            // Reports grouped by status
            this.prisma.report.groupBy({
                by: ['status'],
                where: whereClause,
                _count: {
                    id: true,
                },
                orderBy: {
                    _count: {
                        id: 'desc',
                    },
                },
            }),

            // Recent reports (last 10)
            this.prisma.report.findMany({
                where: whereClause,
                include: {
                    createdByUser: {
                        select: {
                            id: true,
                            email: true,
                            fullName: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
        ]);

        return {
            totalReports,
            reportsByType: reportsByType.map(item => ({
                type: item.type,
                count: item._count.id,
            })),
            reportsByStatus: reportsByStatus.map(item => ({
                status: item.status,
                count: item._count.id,
            })),
            recentReports,
        };
    }

    async findOldReports(cutoffDate: Date, organizationId?: string) {
        const where: any = {
            createdAt: {
                lt: cutoffDate,
            },
            status: {
                in: ['COMPLETED', 'FAILED'],
            },
        };

        if (organizationId) {
            where.organizationId = organizationId;
        }

        return this.prisma.report.findMany({
            where,
            select: {
                id: true,
                filePath: true,
            },
        });
    }

    async getReportsByDateRange(
        startDate: Date,
        endDate: Date,
        scope: DataScope
    ): Promise<Array<{ date: string; count: number }>> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const reports = await this.prisma.report.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
                ...whereClause,
            },
            select: {
                createdAt: true,
            },
        });

        // Group by date
        const dateGroups = new Map<string, number>();
        reports.forEach(report => {
            const dateKey = report.createdAt.toISOString().split('T')[0];
            dateGroups.set(dateKey, (dateGroups.get(dateKey) || 0) + 1);
        });

        return Array.from(dateGroups.entries())
            .map(([date, count]) => ({
                date,
                count,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    async getReportsByUser(userId: string, scope: DataScope, limit: number = 50) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.report.findMany({
            where: {
                createdByUserId: userId,
                ...whereClause,
            },
            include: {
                createdByUser: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async getFailedReports(scope: DataScope, limit: number = 50) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.report.findMany({
            where: {
                status: 'FAILED',
                ...whereClause,
            },
            include: {
                createdByUser: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async getPendingReports(limit: number = 100) {
        return this.prisma.report.findMany({
            where: {
                status: {
                    in: ['PENDING', 'PROCESSING'],
                },
            },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });
    }

    async getReportSizeStats(scope: DataScope) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const result = await this.prisma.report.aggregate({
            where: {
                ...whereClause,
                fileSize: {
                    not: null,
                },
            },
            _sum: {
                fileSize: true,
            },
            _avg: {
                fileSize: true,
            },
            _max: {
                fileSize: true,
            },
            _min: {
                fileSize: true,
            },
            _count: {
                fileSize: true,
            },
        });

        return {
            totalSize: result._sum.fileSize || 0,
            averageSize: result._avg.fileSize || 0,
            maxSize: result._max.fileSize || 0,
            minSize: result._min.fileSize || 0,
            reportCount: result._count.fileSize || 0,
        };
    }
}
