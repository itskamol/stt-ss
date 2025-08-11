import { Injectable } from '@nestjs/common';
import { OrganizationUser, User } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import {
    AssignUserToOrganizationDto,
    CreateUserDto,
    UpdateUserDto,
} from '../../shared/dto/user.dto';
import { DataScope } from '../../shared/interfaces/data-scope.interface';
import { QueryBuilder } from '../../shared/utils/query-builder.util';

@Injectable()
export class UserRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: CreateUserDto & { passwordHash: string }): Promise<User> {
        const { password, ...userData } = data as any;
        return this.prisma.user.create({
            data: userData,
        });
    }

    async findById(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { id },
        });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async findMany(filters: any = {}): Promise<User[]> {
        return this.prisma.user.findMany({
            where: filters,
            orderBy: { createdAt: 'desc' },
        });
    }

    async update(id: string, data: UpdateUserDto): Promise<User> {
        return this.prisma.user.update({
            where: { id },
            data,
        });
    }

    async updatePassword(id: string, passwordHash: string): Promise<User> {
        return this.prisma.user.update({
            where: { id },
            data: { passwordHash },
        });
    }

    async delete(id: string): Promise<void> {
        await this.prisma.user.delete({
            where: { id },
        });
    }

    async count(filters: any = {}): Promise<number> {
        return this.prisma.user.count({
            where: filters,
        });
    }

    async assignToOrganization(data: AssignUserToOrganizationDto): Promise<OrganizationUser> {
        const { branchIds, ...orgUserData } = data;

        // Create organization user relationship
        const orgUser = await this.prisma.organizationUser.create({
            data: orgUserData,
        });

        // If branch IDs are provided and role is BRANCH_MANAGER, create managed branch relationships
        if (branchIds && branchIds.length > 0 && data.role === 'BRANCH_MANAGER') {
            await this.prisma.managedBranch.createMany({
                data: branchIds.map(branchId => ({
                    managerId: orgUser.id,
                    branchId,
                })),
            });
        }

        return orgUser;
    }

    async removeFromOrganization(userId: string, organizationId: string): Promise<void> {
        await this.prisma.organizationUser.delete({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId,
                },
            },
        });
    }

    async findUserWithOrganizations(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                organizationLinks: {
                    include: {
                        organization: true,
                        managedBranches: {
                            include: {
                                branch: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async findOrganizationUsers(organizationId: string, scope: DataScope) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.organizationUser.findMany({
            where: {
                organizationId: whereClause.organizationId,
            },
            include: {
                user: true,
                managedBranches: {
                    include: {
                        branch: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
