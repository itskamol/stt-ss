import { Injectable } from '@nestjs/common';
import { GuestVisit } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateGuestVisitDto, UpdateGuestVisitDto } from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';
import { QueryBuilder } from '../../shared/utils/query-builder.util';

@Injectable()
export class GuestRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(
        data: CreateGuestVisitDto,
        scope: DataScope,
        createdByUserId: string
    ): Promise<GuestVisit> {
        return this.prisma.guestVisit.create({
            data: {
                organizationId: scope.organizationId,
                branchId: data.branchId,
                guestName: data.guestName,
                guestContact: data.guestContact,
                responsibleEmployeeId: data.responsibleEmployeeId,
                scheduledEntryTime: new Date(data.scheduledEntryTime),
                scheduledExitTime: new Date(data.scheduledExitTime),
                status: 'PENDING_APPROVAL',
                accessCredentialType: 'QR_CODE', // Default
                createdByUserId,
            },
        });
    }

    async findById(id: string, scope: DataScope): Promise<GuestVisit | null> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.guestVisit.findFirst({
            where: {
                id,
                branch: whereClause,
            },
        });
    }

    async findMany(
        filters: {
            status?: string;
            branchId?: string;
            startDate?: Date;
            endDate?: Date;
        },
        scope: DataScope
    ): Promise<GuestVisit[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        const where: any = {
            branch: whereClause,
        };

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.branchId) {
            where.branchId = filters.branchId;
        }

        if (filters.startDate || filters.endDate) {
            where.scheduledEntryTime = {};
            if (filters.startDate) {
                where.scheduledEntryTime.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.scheduledEntryTime.lte = filters.endDate;
            }
        }

        return this.prisma.guestVisit.findMany({
            where,
            orderBy: { scheduledEntryTime: 'desc' },
        });
    }

    async update(
        id: string,
        data: Partial<UpdateGuestVisitDto> & {
            status?: string;
            accessCredentialType?: string;
            accessCredentialHash?: string;
        },
        scope: DataScope
    ): Promise<GuestVisit> {
        const updateData: any = {};

        if (data.guestName !== undefined) updateData.guestName = data.guestName;
        if (data.guestContact !== undefined) updateData.guestContact = data.guestContact;
        if (data.responsibleEmployeeId !== undefined)
            updateData.responsibleEmployeeId = data.responsibleEmployeeId;
        if (data.scheduledEntryTime !== undefined)
            updateData.scheduledEntryTime = new Date(data.scheduledEntryTime);
        if (data.scheduledExitTime !== undefined)
            updateData.scheduledExitTime = new Date(data.scheduledExitTime);
        if (data.status !== undefined) updateData.status = data.status;
        if (data.accessCredentialType !== undefined)
            updateData.accessCredentialType = data.accessCredentialType;
        if (data.accessCredentialHash !== undefined)
            updateData.accessCredentialHash = data.accessCredentialHash;

        return this.prisma.guestVisit.update({
            where: { id },
            data: updateData,
        });
    }

    async delete(id: string, scope: DataScope): Promise<void> {
        await this.prisma.guestVisit.delete({
            where: { id },
        });
    }

    async findByStatus(status: string, scope: DataScope): Promise<GuestVisit[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.guestVisit.findMany({
            where: {
                status: status as any,
                branch: whereClause,
            },
            orderBy: { scheduledEntryTime: 'desc' },
        });
    }

    async searchGuestVisits(searchTerm: string, scope: DataScope): Promise<GuestVisit[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.guestVisit.findMany({
            where: {
                branch: whereClause,
                OR: [
                    { guestName: { contains: searchTerm, mode: 'insensitive' } },
                    { guestContact: { contains: searchTerm, mode: 'insensitive' } },
                ],
            },
            orderBy: { scheduledEntryTime: 'desc' },
        });
    }

    async getGuestVisitStats(
        filters: {
            branchId?: string;
            startDate?: Date;
            endDate?: Date;
        },
        scope: DataScope
    ) {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        const where: any = {
            branch: whereClause,
        };

        if (filters.branchId) {
            where.branchId = filters.branchId;
        }

        if (filters.startDate || filters.endDate) {
            where.scheduledEntryTime = {};
            if (filters.startDate) {
                where.scheduledEntryTime.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.scheduledEntryTime.lte = filters.endDate;
            }
        }

        const [totalVisits, visitsByStatus, visitsByBranch] = await Promise.all([
            // Total visits
            this.prisma.guestVisit.count({ where }),

            // Visits grouped by status
            this.prisma.guestVisit.groupBy({
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

            // Visits grouped by branch
            this.prisma.guestVisit.groupBy({
                by: ['branchId'],
                where,
                _count: {
                    id: true,
                },
                orderBy: {
                    _count: {
                        id: 'desc',
                    },
                },
                take: 10, // Top 10 branches
            }),
        ]);

        // Get branch names for the top branches
        const branchIds = visitsByBranch.map(item => item.branchId);
        const branches = await this.prisma.branch.findMany({
            where: {
                id: { in: branchIds },
            },
            select: {
                id: true,
                name: true,
            },
        });

        const branchMap = new Map(branches.map(b => [b.id, b.name]));

        return {
            totalVisits,
            visitsByStatus: visitsByStatus.map(item => ({
                status: item.status,
                count: item._count.id,
            })),
            visitsByBranch: visitsByBranch.map(item => ({
                branchId: item.branchId,
                branchName: branchMap.get(item.branchId) || 'Unknown Branch',
                count: item._count.id,
            })),
        };
    }

    async findOverdueVisits(scope?: DataScope): Promise<GuestVisit[]> {
        const now = new Date();
        const whereClause = scope ? QueryBuilder.buildOrganizationScope(scope) : {};

        return this.prisma.guestVisit.findMany({
            where: {
                status: {
                    in: ['APPROVED', 'ACTIVE'],
                },
                scheduledExitTime: {
                    lt: now,
                },
                ...whereClause,
            },
            orderBy: { scheduledExitTime: 'asc' },
        });
    }

    async findByAccessCredential(
        credentialHash: string,
        scope: DataScope
    ): Promise<GuestVisit | null> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.guestVisit.findFirst({
            where: {
                accessCredentialHash: credentialHash,
                status: {
                    in: ['APPROVED', 'ACTIVE'],
                },
                ...whereClause,
            },
        });
    }

    async findUpcomingVisits(hoursAhead: number = 24, scope?: DataScope): Promise<GuestVisit[]> {
        const now = new Date();
        const futureTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
        const whereClause = scope ? QueryBuilder.buildOrganizationScope(scope) : {};

        return this.prisma.guestVisit.findMany({
            where: {
                status: 'APPROVED',
                scheduledEntryTime: {
                    gte: now,
                    lte: futureTime,
                },
                ...whereClause,
            },
            orderBy: { scheduledEntryTime: 'asc' },
        });
    }

    async getVisitsByDateRange(
        startDate: Date,
        endDate: Date,
        scope: DataScope
    ): Promise<Array<{ date: string; count: number }>> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        const visits = await this.prisma.guestVisit.findMany({
            where: {
                scheduledEntryTime: {
                    gte: startDate,
                    lte: endDate,
                },
                branch: whereClause,
            },
            select: {
                scheduledEntryTime: true,
            },
        });

        // Group by date
        const dateGroups = new Map<string, number>();
        visits.forEach(visit => {
            const dateKey = visit.scheduledEntryTime.toISOString().split('T')[0];
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
