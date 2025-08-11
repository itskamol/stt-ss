import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { DataScope } from '../../shared/interfaces';
import { QueryBuilder } from '../../shared/utils/query-builder.util';

export interface CreateDeviceEventLogDto {
    deviceId: string;
    eventType: string;
    metadata?: any;
    rawPayloadUrl?: string;
    timestamp: Date;
    organizationId: string;
}

export interface EventLogFilters {
    deviceId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
}

@Injectable()
export class EventRepository {
    constructor(private readonly prisma: PrismaService) {}

    async createDeviceEventLog(data: CreateDeviceEventLogDto) {
        return this.prisma.deviceEventLog.create({
            data: {
                deviceId: data.deviceId,
                eventType: data.eventType,
                metadata: data.metadata,
                rawPayloadUrl: data.rawPayloadUrl,
                timestamp: data.timestamp,
                organizationId: data.organizationId,
            },
        });
    }

    async findEventLogById(id: string, scope?: DataScope) {
        const whereClause = scope ? QueryBuilder.buildOrganizationScope(scope) : {};

        return this.prisma.deviceEventLog.findFirst({
            where: {
                id,
                ...whereClause,
            },
            include: {
                device: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        macAddress: true,
                    },
                },
            },
        });
    }

    async findEventLogs(filters: EventLogFilters, scope?: DataScope) {
        const whereClause = scope ? QueryBuilder.buildOrganizationScope(scope) : {};

        const where: any = {
            ...whereClause,
        };

        if (filters.deviceId) {
            where.deviceId = filters.deviceId;
        }

        if (filters.eventType) {
            where.eventType = filters.eventType;
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

        return this.prisma.deviceEventLog.findMany({
            where,
            include: {
                device: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        macAddress: true,
                    },
                },
            },
            orderBy: { timestamp: 'desc' },
            take: 1000, // Limit to prevent large queries
        });
    }

    async getEventStats(filters: EventLogFilters, scope?: DataScope) {
        const whereClause = scope ? QueryBuilder.buildOrganizationScope(scope) : {};

        const where: any = {
            ...whereClause,
        };

        if (filters.deviceId) {
            where.deviceId = filters.deviceId;
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

        const [totalEvents, eventsByType, eventsByDevice] = await Promise.all([
            // Total event count
            this.prisma.deviceEventLog.count({ where }),

            // Events grouped by type
            this.prisma.deviceEventLog.groupBy({
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

            // Events grouped by device
            this.prisma.deviceEventLog.groupBy({
                by: ['deviceId'],
                where,
                _count: {
                    id: true,
                },
                orderBy: {
                    _count: {
                        id: 'desc',
                    },
                },
                take: 10, // Top 10 devices
            }),
        ]);

        // Get device names for the top devices
        const deviceIds = eventsByDevice.map(item => item.deviceId);
        const devices = await this.prisma.device.findMany({
            where: {
                id: { in: deviceIds },
            },
            select: {
                id: true,
                name: true,
            },
        });

        const deviceMap = new Map(devices.map(d => [d.id, d.name]));

        return {
            totalEvents,
            eventsByType: eventsByType.map(item => ({
                eventType: item.eventType,
                count: item._count.id,
            })),
            eventsByDevice: eventsByDevice.map(item => ({
                deviceId: item.deviceId,
                deviceName: deviceMap.get(item.deviceId) || 'Unknown Device',
                count: item._count.id,
            })),
        };
    }

    async deleteOldEventLogs(olderThanDays: number, organizationId?: string): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const where: any = {
            timestamp: {
                lt: cutoffDate,
            },
        };

        if (organizationId) {
            where.organizationId = organizationId;
        }

        const result = await this.prisma.deviceEventLog.deleteMany({
            where,
        });

        return result.count;
    }

    async getRecentEventsByDevice(deviceId: string, limit: number = 50) {
        return this.prisma.deviceEventLog.findMany({
            where: {
                deviceId,
            },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }

    async getEventCountByDateRange(
        startDate: Date,
        endDate: Date,
        scope?: DataScope
    ): Promise<Array<{ date: string; count: number }>> {
        const whereClause = scope ? QueryBuilder.buildOrganizationScope(scope) : {};

        // This is a simplified version - in a real implementation you'd use raw SQL
        // or a more sophisticated grouping mechanism
        const events = await this.prisma.deviceEventLog.findMany({
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
        events.forEach(event => {
            const dateKey = event.timestamp.toISOString().split('T')[0];
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
