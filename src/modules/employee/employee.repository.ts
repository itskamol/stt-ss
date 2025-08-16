import { Injectable } from '@nestjs/common';
import { Employee, Prisma } from '@prisma/client';
import { PrismaService } from '@/core/database/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from '@/shared/dto/employee.dto';
import { DataScope } from '@/shared/interfaces/data-scope.interface';
import { QueryBuilder } from '@/shared/utils/query-builder.util';

@Injectable()
export class EmployeeRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: CreateEmployeeDto, scope: DataScope): Promise<Employee> {
        return this.prisma.employee.create({
            data: {
                ...data,
                organizationId: scope.organizationId,
            },
        });
    }

    async findById(id: string, scope: DataScope): Promise<Employee | null> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.employee.findFirst({
            where: {
                id,
                branch: whereClause,
            },
            include: {
                branch: true,
                department: true,
            },
        });
    }

    async findByEmployeeCode(employeeCode: string, scope: DataScope): Promise<Employee | null> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.employee.findFirst({
            where: {
                employeeCode,
                branch: whereClause,
            },
        });
    }

    async findMany(filters: any = {}, scope: DataScope): Promise<Employee[]> {
        const branchScope = QueryBuilder.buildBranchScope(scope);

        return this.prisma.employee.findMany({
            where: {
                ...filters,
                branch: branchScope,
            },
            include: {
                branch: true,
                department: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // Pagination bilan findMany
    async findManyPaginated(
        filters: any = {},
        scope: DataScope,
        page: number,
        limit: number
    ): Promise<Employee[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);
        const skip = (page - 1) * limit;

        return this.prisma.employee.findMany({
            where: {
                ...filters,
                branch: whereClause,
            },
            include: {
                branch: true,
                department: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        });
    }

    async update(id: string, data: UpdateEmployeeDto, scope: DataScope): Promise<Employee> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.employee.update({
            where: { id },
            data,
        });
    }

    async delete(id: string, scope: DataScope): Promise<void> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        await this.prisma.employee.delete({
            where: { id },
        });
    }

    async count(filters: any = {}, scope: DataScope): Promise<number> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.employee.count({
            where: {
                ...filters,
                branch: whereClause,
            },
        });
    }

    async findByBranch(branchId: string, scope: DataScope): Promise<Employee[]> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.employee.findMany({
            where: {
                branchId,
                branch: whereClause,
            },
            include: {
                department: true,
            },
            orderBy: { lastName: 'asc' },
        });
    }

    async findByDepartment(departmentId: string, scope: DataScope): Promise<Employee[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.employee.findMany({
            where: {
                departmentId,
                branch: whereClause,
            },
            include: {
                branch: true,
            },
            orderBy: { lastName: 'asc' },
        });
    }

    async searchEmployees(searchTerm: string, scope: DataScope): Promise<Employee[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.employee.findMany({
            where: {
                branch: whereClause,
                OR: [
                    { firstName: { contains: searchTerm, mode: 'insensitive' } },
                    { lastName: { contains: searchTerm, mode: 'insensitive' } },
                    { employeeCode: { contains: searchTerm, mode: 'insensitive' } },
                    { email: { contains: searchTerm, mode: 'insensitive' } },
                ],
            },
            include: {
                branch: true,
                department: true,
            },
            orderBy: { lastName: 'asc' },
        });
    }
}
