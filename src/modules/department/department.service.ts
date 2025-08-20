import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Department } from '@prisma/client';
import { DepartmentRepository } from './department.repository';
import { DatabaseUtil } from '@/shared/utils';
import {
    CreateDepartmentDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateDepartmentDto,
} from '@/shared/dto';
import { DataScope } from '@/shared/interfaces';

@Injectable()
export class DepartmentService {
    constructor(private readonly departmentRepository: DepartmentRepository) {}

    /**
     * Create a new department
     */
    async createDepartment(
        createDepartmentDto: CreateDepartmentDto,
        scope: DataScope,
        createdByUserId: string
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

            return await this.departmentRepository.create(createDepartmentDto);
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
    async getDepartments(
        scope: DataScope,
        paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<Department>> {
        const { page, limit } = paginationDto;
        const skip = (page - 1) * limit;

        const [departments, total] = await Promise.all([
            this.departmentRepository.findMany(scope, skip, limit),
            this.departmentRepository.count(scope),
        ]);

        return new PaginationResponseDto(departments, total, page, limit);
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
    async getDepartmentById(id: string, scope: DataScope): Promise<Department> {
        const department = await this.departmentRepository.findById(id, scope);
        if (!department) {
            throw new NotFoundException('Department not found');
        }
        return department;
    }

    /**
     * Update department
     */
    async updateDepartment(
        id: string,
        updateDepartmentDto: UpdateDepartmentDto,
        scope: DataScope,
        updatedByUserId: string
    ): Promise<Department> {
        const existingDepartment = await this.getDepartmentById(id, scope);

        try {
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

            return await this.departmentRepository.update(id, updateDepartmentDto, scope);
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
    async deleteDepartment(id: string, scope: DataScope, deletedByUserId: string): Promise<void> {
        await this.getDepartmentById(id, scope); // Ensure department exists and is in scope

        // Check if department has children
        const childrenCount = await this.departmentRepository.count(scope, { parentId: id });
        if (childrenCount > 0) {
            throw new BadRequestException(
                'Cannot delete department with child departments. Please delete or reassign child departments first.'
            );
        }

        await this.departmentRepository.delete(id, scope);
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
        const skip = 0;
        const take = 10;
        return this.departmentRepository.searchDepartments(searchTerm.trim(), scope, skip, take);
    }

    /**
     * Get department count
     */
    async getDepartmentCount(scope: DataScope): Promise<number> {
        return this.departmentRepository.count(scope);
    }
}
