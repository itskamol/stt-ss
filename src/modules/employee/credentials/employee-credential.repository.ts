import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { EmployeeCredential, Prisma, CredentialType } from '@prisma/client';
import { DataScope } from '@/shared/interfaces';
import { CreateEmployeeCredentialDto, UpdateEmployeeCredentialDto } from '@/shared/dto';

@Injectable()
export class EmployeeCredentialRepository {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Create a new employee credential
     */
    async create(
        employeeId: string,
        createDto: CreateEmployeeCredentialDto,
        scope: DataScope
    ): Promise<EmployeeCredential> {
        return this.prisma.employeeCredential.create({
            data: {
                employeeId,
                type: createDto.type,
                value: createDto.value,
                metadata: createDto.metadata,
                isActive: createDto.isActive ?? true,
            },
        });
    }

    /**
     * Find all credentials for an employee
     */
    async findByEmployeeId(
        employeeId: string,
        scope: DataScope
    ): Promise<EmployeeCredential[]> {
        return this.prisma.employeeCredential.findMany({
            where: {
                employeeId,
                employee: {
                    organizationId: scope.organizationId,
                    ...(scope.branchIds && { branchId: { in: scope.branchIds } }),
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Find credential by ID
     */
    async findById(id: string, scope: DataScope): Promise<EmployeeCredential | null> {
        return this.prisma.employeeCredential.findFirst({
            where: {
                id,
                employee: {
                    organizationId: scope.organizationId,
                    ...(scope.branchIds && { branchId: { in: scope.branchIds } }),
                },
            },
        });
    }

    /**
     * Find credential by type for an employee
     */
    async findByEmployeeIdAndType(
        employeeId: string,
        type: CredentialType,
        scope: DataScope
    ): Promise<EmployeeCredential | null> {
        return this.prisma.employeeCredential.findFirst({
            where: {
                employeeId,
                type,
                employee: {
                    organizationId: scope.organizationId,
                    ...(scope.branchIds && { branchId: { in: scope.branchIds } }),
                },
            },
        });
    }

    /**
     * Update credential
     */
    async update(
        id: string,
        updateDto: UpdateEmployeeCredentialDto,
        scope: DataScope
    ): Promise<EmployeeCredential> {
        return this.prisma.employeeCredential.update({
            where: { id },
            data: {
                ...(updateDto.value && { value: updateDto.value }),
                ...(updateDto.metadata !== undefined && { metadata: updateDto.metadata }),
                ...(updateDto.isActive !== undefined && { isActive: updateDto.isActive }),
            },
        });
    }

    /**
     * Delete credential
     */
    async delete(id: string, scope: DataScope): Promise<void> {
        await this.prisma.employeeCredential.delete({
            where: { id },
        });
    }

    /**
     * Check if credential value exists
     */
    async existsByTypeAndValue(
        type: CredentialType,
        value: string,
        excludeId?: string
    ): Promise<boolean> {
        const credential = await this.prisma.employeeCredential.findFirst({
            where: {
                type,
                value,
                ...(excludeId && { id: { not: excludeId } }),
            },
        });
        return !!credential;
    }

    /**
     * Get active credentials by type for an employee
     */
    async findActiveByEmployeeIdAndType(
        employeeId: string,
        type: CredentialType,
        scope: DataScope
    ): Promise<EmployeeCredential[]> {
        return this.prisma.employeeCredential.findMany({
            where: {
                employeeId,
                type,
                isActive: true,
                employee: {
                    organizationId: scope.organizationId,
                    ...(scope.branchIds && { branchId: { in: scope.branchIds } }),
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}