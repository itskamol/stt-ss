import { Injectable } from '@nestjs/common';
import { Department } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from '../../shared/dto/department.dto';
import { DataScope } from '../../shared/interfaces/data-scope.interface';
import { QueryBuilder } from '../../shared/utils/query-builder.util';

@Injectable()
export class DepartmentRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: CreateDepartmentDto): Promise<Department> {
        return this.prisma.department.create({
            data,
        });
    }

    async findById(id: string, scope: DataScope): Promise<Department | null> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.department.findFirst({
            where: {
                id,
                branch: whereClause,
            },
            include: {
                parent: true,
                children: true,
            },
        });
    }

    async findMany(filters: any = {}, scope: DataScope): Promise<Department[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.department.findMany({
            where: {
                ...filters,
                branch: whereClause,
            },
            include: {
                parent: true,
                children: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    async findByBranch(branchId: string, scope: DataScope): Promise<Department[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.department.findMany({
            where: {
                branchId,
                branch: whereClause,
            },
            include: {
                parent: true,
                children: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    async findHierarchy(branchId: string, scope: DataScope): Promise<Department[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        // Get root departments (no parent) with their full hierarchy
        return this.prisma.department.findMany({
            where: {
                branchId,
                parentId: null,
                branch: whereClause,
            },
            include: {
                children: {
                    include: {
                        children: {
                            include: {
                                children: true, // Support up to 3 levels deep
                            },
                        },
                    },
                },
            },
            orderBy: { name: 'asc' },
        });
    }

    async update(id: string, data: UpdateDepartmentDto, scope: DataScope): Promise<Department> {
        return this.prisma.department.update({
            where: { id },
            data,
            include: {
                parent: true,
                children: true,
            },
        });
    }

    async delete(id: string, scope: DataScope): Promise<void> {
        await this.prisma.department.delete({
            where: { id },
        });
    }

    async count(filters: any = {}, scope: DataScope): Promise<number> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.department.count({
            where: {
                ...filters,
                branch: whereClause,
            },
        });
    }

    async findWithStats(id: string, scope: DataScope) {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.department.findFirst({
            where: {
                id,
                branch: whereClause,
            },
            include: {
                parent: true,
                children: true,
                _count: {
                    select: {
                        employees: true,
                        children: true,
                    },
                },
            },
        });
    }

    async searchDepartments(searchTerm: string, scope: DataScope): Promise<Department[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.department.findMany({
            where: {
                name: {
                    contains: searchTerm,
                    mode: 'insensitive',
                },
                branch: whereClause,
            },
            include: {
                parent: true,
                children: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    async validateParentDepartment(
        parentId: string,
        branchId: string,
        scope: DataScope
    ): Promise<boolean> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        const parent = await this.prisma.department.findFirst({
            where: {
                id: parentId,
                branchId,
                branch: whereClause,
            },
        });

        return !!parent;
    }

    async checkCircularReference(departmentId: string, parentId: string): Promise<boolean> {
        // Check if setting parentId would create a circular reference
        let currentParent = await this.prisma.department.findUnique({
            where: { id: parentId },
            select: { id: true, parentId: true },
        });

        while (currentParent) {
            if (currentParent.id === departmentId) {
                return true; // Circular reference detected
            }

            if (!currentParent.parentId) {
                break;
            }

            currentParent = await this.prisma.department.findUnique({
                where: { id: currentParent.parentId },
                select: { id: true, parentId: true },
            });
        }

        return false;
    }
}
