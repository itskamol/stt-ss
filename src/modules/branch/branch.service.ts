import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Branch } from '@prisma/client';
import { BranchRepository } from './branch.repository';
import { DatabaseUtil } from '@/shared/utils';
import {
    AssignBranchManagerDto,
    CreateBranchDto,
    UpdateBranchDto,
    PaginationDto,
    PaginationResponseDto,
} from '@/shared/dto';
import { DataScope } from '@/shared/interfaces';

@Injectable()
export class BranchService {
    constructor(private readonly branchRepository: BranchRepository) {}

    /**
     * Create a new branch
     */
    async createBranch(
        createBranchDto: CreateBranchDto,
        scope: DataScope,
        createdByUserId: string
    ): Promise<Branch> {
        try {
            return await this.branchRepository.create(createBranchDto, scope);
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                const fields = DatabaseUtil.getUniqueConstraintFields(error);
                throw new ConflictException(
                    `Branch with this ${fields.join(', ')} already exists in this organization`
                );
            }
            throw error;
        }
    }

    /**
     * Get all branches (scoped to organization/managed branches)
     */
    async getBranches(
        scope: DataScope,
        paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<Branch>> {
        const { page, limit } = paginationDto;
        const skip = (page - 1) * limit;

        const [branches, total] = await Promise.all([
            this.branchRepository.findMany(scope, skip, limit),
            this.branchRepository.count(scope),
        ]);

        return new PaginationResponseDto(branches, total, page, limit);
    }

    /**
     * Get branch by ID
     */
    async getBranchById(id: string, scope: DataScope): Promise<Branch> {
        const branch = await this.branchRepository.findById(id, scope);
        if (!branch) {
            throw new NotFoundException('Branch not found');
        }
        return branch;
    }

    /**
     * Update branch
     */
    async updateBranch(
        id: string,
        updateBranchDto: UpdateBranchDto,
        scope: DataScope,
        updatedByUserId: string
    ): Promise<Branch> {
        await this.getBranchById(id, scope); // Ensure branch exists and is in scope

        try {
            return await this.branchRepository.update(id, updateBranchDto, scope);
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                const fields = DatabaseUtil.getUniqueConstraintFields(error);
                throw new ConflictException(
                    `Branch with this ${fields.join(', ')} already exists in this organization`
                );
            }
            throw error;
        }
    }

    /**
     * Delete branch
     */
    async deleteBranch(
        id: string,
        scope: DataScope,
        deletedByUserId: string
    ): Promise<void> {
        await this.getBranchById(id, scope); // Ensure branch exists and is in scope
        await this.branchRepository.delete(id, scope);
    }

    /**
     * Get branch with statistics
     */
    async getBranchWithStats(id: string, scope: DataScope) {
        const branchWithStats = await this.branchRepository.findWithStats(id, scope);

        if (!branchWithStats) {
            throw new NotFoundException('Branch not found');
        }

        return {
            id: branchWithStats.id,
            organizationId: branchWithStats.organizationId,
            name: branchWithStats.name,
            address: branchWithStats.address,
            createdAt: branchWithStats.createdAt,
            updatedAt: branchWithStats.updatedAt,
            statistics: {
                totalDepartments: branchWithStats._count.departments,
                totalEmployees: branchWithStats._count.employees,
                totalDevices: branchWithStats._count.devices,
                totalGuestVisits: branchWithStats._count.guestVisits,
            },
        };
    }

    /**
     * Assign branch manager
     */
    async assignBranchManager(
        assignDto: AssignBranchManagerDto,
        assignedByUserId: string
    ) {
        // Here you might want to add validation to ensure the user and branch exist
        // and belong to the same organization before assigning.
        try {
            return await this.branchRepository.assignManager(
                assignDto.managerId,
                assignDto.branchId
            );
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                throw new ConflictException('Manager is already assigned to this branch');
            }
            throw error;
        }
    }

    /**
     * Remove branch manager
     */
    async removeBranchManager(
        managerId: string,
        branchId: string,
        removedByUserId: string
    ): Promise<void> {
        await this.branchRepository.removeManager(managerId, branchId);
    }

    /**
     * Get branch managers
     */
    async getBranchManagers(branchId: string, scope: DataScope) {
        return this.branchRepository.findBranchManagers(branchId, scope);
    }

    /**
     * Search branches
     */
    async searchBranches(searchTerm: string, scope: DataScope): Promise<Branch[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }
        const skip = 0;
        const take = 10;
        return this.branchRepository.searchBranches(searchTerm.trim(), scope, skip, take);
    }

    /**
     * Get branch count
     */
    async getBranchCount(scope: DataScope): Promise<number> {
        return this.branchRepository.count(scope);
    }
}
