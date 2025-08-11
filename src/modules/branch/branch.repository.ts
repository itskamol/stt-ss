import { Injectable } from '@nestjs/common';
import { Branch, ManagedBranch } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from '../../shared/dto/branch.dto';
import { DataScope } from '../../shared/interfaces/data-scope.interface';
import { QueryBuilder } from '../../shared/utils/query-builder.util';

@Injectable()
export class BranchRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: CreateBranchDto, scope: DataScope): Promise<Branch> {
        return this.prisma.branch.create({
            data: {
                ...data,
                organizationId: scope.organizationId,
            },
        });
    }

    async findById(id: string, scope: DataScope): Promise<Branch | null> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.branch.findFirst({
            where: {
                id,
                ...whereClause,
            },
        });
    }

    async findMany(filters: any = {}, scope: DataScope): Promise<Branch[]> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.branch.findMany({
            where: {
                ...filters,
                ...whereClause,
            },
            orderBy: { name: 'asc' },
        });
    }

    async findManagedBranches(scope: DataScope): Promise<Branch[]> {
        // For branch managers, only return branches they manage
        if (scope.branchIds && scope.branchIds.length > 0) {
            return this.prisma.branch.findMany({
                where: {
                    organizationId: scope.organizationId,
                    id: { in: scope.branchIds },
                },
                orderBy: { name: 'asc' },
            });
        }

        // For org admins, return all branches in organization
        return this.findMany({}, scope);
    }

    async update(id: string, data: UpdateBranchDto, scope: DataScope): Promise<Branch> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.branch.update({
            where: { id },
            data,
        });
    }

    async delete(id: string, scope: DataScope): Promise<void> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        await this.prisma.branch.delete({
            where: { id },
        });
    }

    async count(filters: any = {}, scope: DataScope): Promise<number> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.branch.count({
            where: {
                ...filters,
                ...whereClause,
            },
        });
    }

    async findWithStats(id: string, scope: DataScope) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.branch.findFirst({
            where: {
                id,
                ...whereClause,
            },
            include: {
                _count: {
                    select: {
                        departments: true,
                        employees: true,
                        devices: true,
                        guestVisits: true,
                    },
                },
            },
        });
    }

    async assignManager(managerId: string, branchId: string): Promise<ManagedBranch> {
        return this.prisma.managedBranch.create({
            data: {
                managerId,
                branchId,
            },
        });
    }

    async removeManager(managerId: string, branchId: string): Promise<void> {
        await this.prisma.managedBranch.delete({
            where: {
                managerId_branchId: {
                    managerId,
                    branchId,
                },
            },
        });
    }

    async findBranchManagers(branchId: string, scope: DataScope) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.managedBranch.findMany({
            where: {
                branchId,
                manager: {
                    organizationId: whereClause.organizationId,
                },
            },
            include: {
                manager: {
                    include: {
                        user: true,
                    },
                },
            },
        });
    }

    async searchBranches(searchTerm: string, scope: DataScope): Promise<Branch[]> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.branch.findMany({
            where: {
                ...whereClause,
                OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                    { address: { contains: searchTerm, mode: 'insensitive' } },
                ],
            },
            orderBy: { name: 'asc' },
        });
    }
}
