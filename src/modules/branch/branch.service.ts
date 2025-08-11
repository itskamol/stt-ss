import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Branch } from '@prisma/client';
import { BranchRepository } from './branch.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { DatabaseUtil } from '../../shared/utils';
import { AssignBranchManagerDto, CreateBranchDto, UpdateBranchDto } from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';

@Injectable()
export class BranchService {
    constructor(
        private readonly branchRepository: BranchRepository,
        private readonly logger: LoggerService
    ) {}

    /**
     * Create a new branch
     */
    async createBranch(
        createBranchDto: CreateBranchDto,
        scope: DataScope,
        createdByUserId: string,
        correlationId?: string
    ): Promise<Branch> {
        try {
            const branch = await this.branchRepository.create(createBranchDto, scope);

            this.logger.logUserAction(
                createdByUserId,
                'BRANCH_CREATED',
                {
                    branchId: branch.id,
                    branchName: branch.name,
                    organizationId: scope.organizationId,
                },
                scope.organizationId,
                correlationId
            );

            return branch;
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
    async getBranches(scope: DataScope): Promise<Branch[]> {
        return this.branchRepository.findManagedBranches(scope);
    }

    /**
     * Get branch by ID
     */
    async getBranchById(id: string, scope: DataScope): Promise<Branch | null> {
        return this.branchRepository.findById(id, scope);
    }

    /**
     * Update branch
     */
    async updateBranch(
        id: string,
        updateBranchDto: UpdateBranchDto,
        scope: DataScope,
        updatedByUserId: string,
        correlationId?: string
    ): Promise<Branch> {
        try {
            const existingBranch = await this.branchRepository.findById(id, scope);
            if (!existingBranch) {
                throw new NotFoundException('Branch not found');
            }

            const updatedBranch = await this.branchRepository.update(id, updateBranchDto, scope);

            this.logger.logUserAction(
                updatedByUserId,
                'BRANCH_UPDATED',
                {
                    branchId: id,
                    changes: updateBranchDto,
                    oldName: existingBranch.name,
                    newName: updatedBranch.name,
                },
                scope.organizationId,
                correlationId
            );

            return updatedBranch;
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
        deletedByUserId: string,
        correlationId?: string
    ): Promise<void> {
        const existingBranch = await this.branchRepository.findById(id, scope);
        if (!existingBranch) {
            throw new NotFoundException('Branch not found');
        }

        await this.branchRepository.delete(id, scope);

        this.logger.logUserAction(
            deletedByUserId,
            'BRANCH_DELETED',
            {
                branchId: id,
                branchName: existingBranch.name,
            },
            scope.organizationId,
            correlationId
        );
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
        assignedByUserId: string,
        correlationId?: string
    ) {
        try {
            const managedBranch = await this.branchRepository.assignManager(
                assignDto.managerId,
                assignDto.branchId
            );

            this.logger.logUserAction(
                assignedByUserId,
                'BRANCH_MANAGER_ASSIGNED',
                {
                    managerId: assignDto.managerId,
                    branchId: assignDto.branchId,
                },
                undefined,
                correlationId
            );

            return managedBranch;
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
        removedByUserId: string,
        correlationId?: string
    ): Promise<void> {
        await this.branchRepository.removeManager(managerId, branchId);

        this.logger.logUserAction(
            removedByUserId,
            'BRANCH_MANAGER_REMOVED',
            {
                managerId,
                branchId,
            },
            undefined,
            correlationId
        );
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

        return this.branchRepository.searchBranches(searchTerm.trim(), scope);
    }

    /**
     * Get branch count
     */
    async getBranchCount(scope: DataScope): Promise<number> {
        return this.branchRepository.count({}, scope);
    }
}
