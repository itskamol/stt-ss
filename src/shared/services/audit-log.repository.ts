import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { DataScope } from '../interfaces';
import { QueryBuilder } from '../utils/query-builder.util';

export interface CreateAuditLogData {
    action: string;
    resource: string;
    resourceId?: string;
    userId?: string;
    organizationId?: string;
    method: string;
    url: string;
    userAgent?: string;
    ipAddress?: string;
    requestData?: any;
    responseData?: any;
    status: string;
    duration: number;
    timestamp: Date;
    errorMessage?: string;
    errorStack?: string;
    oldValues?: any;
    newValues?: any;
}

@Injectable()
export class AuditLogRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: CreateAuditLogData) {
        return this.prisma.auditLog.create({
            data: {
                action: data.action,
                resource: data.resource,
                resourceId: data.resourceId,
                userId: data.userId,
                organizationId: data.organizationId,
                method: data.method,
                url: data.url,
                userAgent: data.userAgent,
                ipAddress: data.ipAddress,
                requestData: data.requestData,
                responseData: data.responseData,
                status: data.status as any,
                duration: data.duration,
                timestamp: data.timestamp,
                errorMessage: data.errorMessage,
                errorStack: data.errorStack,
                oldValues: data.oldValues,
                newValues: data.newValues,
            },
        });
    }

    async findById(id: string, scope: DataScope) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.auditLog.findFirst({
            where: {
                id,
                ...whereClause,
            },
            include: {
                user: {
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
        filters: {
            userId?: string;
            resource?: string;
            action?: string;
            resourceId?: string;
            startDate?: Date;
            endDate?: Date;
            status?: string;
        },
        scope: DataScope,
        pagination: {
            page: number;
            limit: number;
        } = { page: 1, limit: 50 }
    ) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const where: any = {
            ...whereClause,
        };

        if (filters.userId) {
            where.userId = filters.userId;
        }

        if (filters.resource) {
            where.resource = filters.resource;
        }

        if (filters.action) {
            where.action = { contains: filters.action, mode: 'insensitive' };
        }

        if (filters.resourceId) {
            where.resourceId = filters.resourceId;
        }

        if (filters.status) {
            where.status = filters.status;
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

        const skip = (pagination.page - 1) * pagination.limit;

        const [auditLogs, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            fullName: true,
                        },
                    },
                },
                orderBy: { timestamp: 'desc' },
                skip,
                take: pagination.limit,
            }),
            this.prisma.auditLog.count({ where }),
        ]);

        return {
            data: auditLogs,
            total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: Math.ceil(total / pagination.limit),
        };
    }

    async getAuditLogStats(
        filters: {
            startDate?: Date;
            endDate?: Date;
        },
        scope: DataScope
    ) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const where: any = {
            ...whereClause,
        };

        if (filters.startDate || filters.endDate) {
            where.timestamp = {};
            if (filters.startDate) {
                where.timestamp.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.timestamp.lte = filters.endDate;
            }
        }

        const [totalLogs, logsByAction, logsByResource, logsByStatus, logsByUser] =
            await Promise.all([
                // Total audit logs
                this.prisma.auditLog.count({ where }),

                // Logs grouped by action
                this.prisma.auditLog.groupBy({
                    by: ['action'],
                    where,
                    _count: {
                        id: true,
                    },
                    orderBy: {
                        _count: {
                            id: 'desc',
                        },
                    },
                    take: 10,
                }),

                // Logs grouped by resource
                this.prisma.auditLog.groupBy({
                    by: ['resource'],
                    where,
                    _count: {
                        id: true,
                    },
                    orderBy: {
                        _count: {
                            id: 'desc',
                        },
                    },
                    take: 10,
                }),

                // Logs grouped by status
                this.prisma.auditLog.groupBy({
                    by: ['status'],
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

                // Logs grouped by user
                this.prisma.auditLog.groupBy({
                    by: ['userId'],
                    where: {
                        ...where,
                        userId: { not: null },
                    },
                    _count: {
                        id: true,
                    },
                    orderBy: {
                        _count: {
                            id: 'desc',
                        },
                    },
                    take: 10,
                }),
            ]);

        // Get user details for top users
        const userIds = logsByUser.map(item => item.userId).filter(Boolean);
        const users = await this.prisma.user.findMany({
            where: {
                id: { in: userIds },
            },
            select: {
                id: true,
                email: true,
                fullName: true,
            },
        });

        const userMap = new Map(users.map(u => [u.id, u]));

        return {
            totalLogs,
            logsByAction: logsByAction.map(item => ({
                action: item.action,
                count: item._count.id,
            })),
            logsByResource: logsByResource.map(item => ({
                resource: item.resource,
                count: item._count.id,
            })),
            logsByStatus: logsByStatus.map(item => ({
                status: item.status,
                count: item._count.id,
            })),
            logsByUser: logsByUser.map(item => ({
                userId: item.userId,
                user: item.userId ? userMap.get(item.userId) : null,
                count: item._count.id,
            })),
        };
    }

    async getAuditLogsByDateRange(
        startDate: Date,
        endDate: Date,
        scope: DataScope
    ): Promise<Array<{ date: string; count: number }>> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const logs = await this.prisma.auditLog.findMany({
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
        logs.forEach(log => {
            const dateKey = log.timestamp.toISOString().split('T')[0];
            dateGroups.set(dateKey, (dateGroups.get(dateKey) || 0) + 1);
        });

        return Array.from(dateGroups.entries())
            .map(([date, count]) => ({
                date,
                count,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    async deleteOldLogs(cutoffDate: Date, organizationId?: string): Promise<number> {
        const where: any = {
            timestamp: {
                lt: cutoffDate,
            },
        };

        if (organizationId) {
            where.organizationId = organizationId;
        }

        const result = await this.prisma.auditLog.deleteMany({
            where,
        });

        return result.count;
    }

    async getFailedOperations(
        startDate: Date,
        endDate: Date,
        scope: DataScope,
        limit: number = 100
    ) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.auditLog.findMany({
            where: {
                status: 'FAILED',
                timestamp: {
                    gte: startDate,
                    lte: endDate,
                },
                ...whereClause,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                    },
                },
            },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }

    async getUserLoginHistory(userId: string, startDate: Date, endDate: Date, scope: DataScope) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.auditLog.findMany({
            where: {
                userId,
                action: {
                    in: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED'],
                },
                timestamp: {
                    gte: startDate,
                    lte: endDate,
                },
                ...whereClause,
            },
            orderBy: { timestamp: 'desc' },
        });
    }

    async getResourceAccessHistory(
        resource: string,
        resourceId: string,
        scope: DataScope,
        limit: number = 50
    ) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.auditLog.findMany({
            where: {
                resource,
                resourceId,
                ...whereClause,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                    },
                },
            },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }
}
