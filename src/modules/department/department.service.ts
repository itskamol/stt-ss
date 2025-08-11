import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Department } from '@prisma/client';
import { DepartmentRepository } from './department.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { DatabaseUtil } from '../../shared/utils';
import { CreateDepartmentDto, UpdateDepartmentDto } from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';

@Injectable()
export class DepartmentService {
    constructor(
        private readonly departmentRepository: DepartmentRepository,
        private readonly logger: LoggerService
    ) {}

    /**
     * Create a new department
     */
    async createDepartment(
        createDepartmentDto: CreateDepartmentDto,
        scope: DataScope,
        createdByUserId: string,
        correlationId?: string
    ): Promise<Department> {
        try {
            // Validate parent department if provided
            if (createDepartmentDto.parentId) {
                const isValidParent = await this.departmentRepository.validateParentDepartment(
                    createDepartmentDto.parentId,
                    createDepartmentDto.branchId,
                    scope
                );

                if (!isValidParent) {
                    throw new BadRequestException(
                        'Invalid parent department or parent department not in the same branch'
                    );
                }
            }

            const department = await this.departmentRepository.create(createDepartmentDto);

            this.logger.logUserAction(
                createdByUserId,
                'DEPARTMENT_CREATED',
                {
                    departmentId: department.id,
                    departmentName: department.name,
                    branchId: department.branchId,
                    parentId: department.parentId,
                },
                scope.organizationId,
                correlationId
            );

            return department;
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                const fields = DatabaseUtil.getUniqueConstraintFields(error);
                throw new ConflictException(
                    `Department with this ${fields.join(', ')} already exists in this branch`
                );
            }
            throw error;
        }
    }

    /**
     * Get all departments (scoped to managed branches)
     */
    async getDepartments(scope: DataScope): Promise<Department[]> {
        return this.departmentRepository.findMany({}, scope);
    }

    /**
     * Get departments by branch
     */
    async getDepartmentsByBranch(branchId: string, scope: DataScope): Promise<Department[]> {
        return this.departmentRepository.findByBranch(branchId, scope);
    }

    /**
     * Get department hierarchy for a branch
     */
    async getDepartmentHierarchy(branchId: string, scope: DataScope): Promise<Department[]> {
        return this.departmentRepository.findHierarchy(branchId, scope);
    }

    /**
     * Get department by ID
     */
    async getDepartmentById(id: string, scope: DataScope): Promise<Department | null> {
        return this.departmentRepository.findById(id, scope);
    }

    /**
     * Update department
     */
    async updateDepartment(
        id: string,
        updateDepartmentDto: UpdateDepartmentDto,
        scope: DataScope,
        updatedByUserId: string,
        correlationId?: string
    ): Promise<Department> {
        try {
            const existingDepartment = await this.departmentRepository.findById(id, scope);
            if (!existingDepartment) {
                throw new NotFoundException('Department not found');
            }

            // Validate parent department if being updated
            if (updateDepartmentDto.parentId) {
                // Check if setting this parent would create a circular reference
                const wouldCreateCircularRef =
                    await this.departmentRepository.checkCircularReference(
                        id,
                        updateDepartmentDto.parentId
                    );

                if (wouldCreateCircularRef) {
                    throw new BadRequestException(
                        'Cannot set parent department: would create circular reference'
                    );
                }

                const isValidParent = await this.departmentRepository.validateParentDepartment(
                    updateDepartmentDto.parentId,
                    existingDepartment.branchId,
                    scope
                );

                if (!isValidParent) {
                    throw new BadRequestException(
                        'Invalid parent department or parent department not in the same branch'
                    );
                }
            }

            const updatedDepartment = await this.departmentRepository.update(
                id,
                updateDepartmentDto,
                scope
            );

            this.logger.logUserAction(
                updatedByUserId,
                'DEPARTMENT_UPDATED',
                {
                    departmentId: id,
                    changes: updateDepartmentDto,
                    oldName: existingDepartment.name,
                    newName: updatedDepartment.name,
                    oldParentId: existingDepartment.parentId,
                    newParentId: updatedDepartment.parentId,
                },
                scope.organizationId,
                correlationId
            );

            return updatedDepartment;
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                const fields = DatabaseUtil.getUniqueConstraintFields(error);
                throw new ConflictException(
                    `Department with this ${fields.join(', ')} already exists in this branch`
                );
            }
            throw error;
        }
    }

    /**
     * Delete department
     */
    async deleteDepartment(
        id: string,
        scope: DataScope,
        deletedByUserId: string,
        correlationId?: string
    ): Promise<void> {
        const existingDepartment = await this.departmentRepository.findById(id, scope);
        if (!existingDepartment) {
            throw new NotFoundException('Department not found');
        }

        // Check if department has children
        const childrenCount = await this.departmentRepository.count({ parentId: id }, scope);
        if (childrenCount > 0) {
            throw new BadRequestException(
                'Cannot delete department with child departments. Please delete or reassign child departments first.'
            );
        }

        await this.departmentRepository.delete(id, scope);

        this.logger.logUserAction(
            deletedByUserId,
            'DEPARTMENT_DELETED',
            {
                departmentId: id,
                departmentName: existingDepartment.name,
                branchId: existingDepartment.branchId,
            },
            scope.organizationId,
            correlationId
        );
    }

    /**
     * Get department with statistics
     */
    async getDepartmentWithStats(id: string, scope: DataScope) {
        const departmentWithStats = await this.departmentRepository.findWithStats(id, scope);

        if (!departmentWithStats) {
            throw new NotFoundException('Department not found');
        }

        return {
            id: departmentWithStats.id,
            branchId: departmentWithStats.branchId,
            name: departmentWithStats.name,
            parentId: departmentWithStats.parentId,
            createdAt: departmentWithStats.createdAt,
            updatedAt: departmentWithStats.updatedAt,
            parent: departmentWithStats.parent,
            children: departmentWithStats.children,
            statistics: {
                totalEmployees: departmentWithStats._count.employees,
                totalSubDepartments: departmentWithStats._count.children,
            },
        };
    }

    /**
     * Search departments
     */
    async searchDepartments(searchTerm: string, scope: DataScope): Promise<Department[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        return this.departmentRepository.searchDepartments(searchTerm.trim(), scope);
    }

    /**
     * Get department count
     */
    async getDepartmentCount(scope: DataScope): Promise<number> {
        return this.departmentRepository.count({}, scope);
    }
}
