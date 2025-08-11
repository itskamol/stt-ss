import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { BranchService } from './branch.service';
import {
    AssignBranchManagerDto,
    BranchResponseDto,
    CreateBranchDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateBranchDto,
} from '../../shared/dto';
import { Permissions, Scope, User } from '../../shared/decorators';
import { DataScope, UserContext } from '../../shared/interfaces';

@Controller('branches')
export class BranchController {
    constructor(private readonly branchService: BranchService) {}

    @Post()
    @Permissions('branch:create')
    async createBranch(
        @Body() createBranchDto: CreateBranchDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<BranchResponseDto> {
        const branch = await this.branchService.createBranch(createBranchDto, scope, user.sub);

        return {
            id: branch.id,
            organizationId: branch.organizationId,
            name: branch.name,
            address: branch.address,
            createdAt: branch.createdAt,
            updatedAt: branch.updatedAt,
        };
    }

    @Get()
    @Permissions('branch:read:all')
    async getBranches(
        @Scope() scope: DataScope,
        @Query() paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<BranchResponseDto>> {
        const branches = await this.branchService.getBranches(scope);

        // Simple pagination (in a real app, you'd do this at the database level)
        const { page = 1, limit = 10 } = paginationDto;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedBranches = branches.slice(startIndex, endIndex);

        const responseBranches = paginatedBranches.map(branch => ({
            id: branch.id,
            organizationId: branch.organizationId,
            name: branch.name,
            address: branch.address,
            createdAt: branch.createdAt,
            updatedAt: branch.updatedAt,
        }));

        return new PaginationResponseDto(responseBranches, branches.length, page, limit);
    }

    @Get('search')
    @Permissions('branch:read:all')
    async searchBranches(
        @Query('q') searchTerm: string,
        @Scope() scope: DataScope
    ): Promise<BranchResponseDto[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        const branches = await this.branchService.searchBranches(searchTerm.trim(), scope);

        return branches.map(branch => ({
            id: branch.id,
            organizationId: branch.organizationId,
            name: branch.name,
            address: branch.address,
            createdAt: branch.createdAt,
            updatedAt: branch.updatedAt,
        }));
    }

    @Get('count')
    @Permissions('branch:read:all')
    async getBranchCount(@Scope() scope: DataScope): Promise<{ count: number }> {
        const count = await this.branchService.getBranchCount(scope);
        return { count };
    }

    @Get(':id')
    @Permissions('branch:read:all')
    async getBranchById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<BranchResponseDto> {
        const branch = await this.branchService.getBranchById(id, scope);

        if (!branch) {
            throw new Error('Branch not found');
        }

        return {
            id: branch.id,
            organizationId: branch.organizationId,
            name: branch.name,
            address: branch.address,
            createdAt: branch.createdAt,
            updatedAt: branch.updatedAt,
        };
    }

    @Get(':id/stats')
    @Permissions('branch:read:all')
    async getBranchWithStats(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.branchService.getBranchWithStats(id, scope);
    }

    @Patch(':id')
    @Permissions('branch:update:managed')
    async updateBranch(
        @Param('id') id: string,
        @Body() updateBranchDto: UpdateBranchDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<BranchResponseDto> {
        const branch = await this.branchService.updateBranch(id, updateBranchDto, scope, user.sub);

        return {
            id: branch.id,
            organizationId: branch.organizationId,
            name: branch.name,
            address: branch.address,
            createdAt: branch.createdAt,
            updatedAt: branch.updatedAt,
        };
    }

    @Delete(':id')
    @Permissions('branch:update:managed')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteBranch(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.branchService.deleteBranch(id, scope, user.sub);
    }

    @Post(':branchId/managers')
    @Permissions('user:manage:org')
    async assignBranchManager(
        @Param('branchId') branchId: string,
        @Body() assignDto: Omit<AssignBranchManagerDto, 'branchId'>,
        @User() user: UserContext
    ) {
        const fullAssignDto: AssignBranchManagerDto = {
            ...assignDto,
            branchId,
        };

        const managedBranch = await this.branchService.assignBranchManager(fullAssignDto, user.sub);

        return {
            id: managedBranch.id,
            managerId: managedBranch.managerId,
            branchId: managedBranch.branchId,
            assignedAt: managedBranch.assignedAt,
        };
    }

    @Delete(':branchId/managers/:managerId')
    @Permissions('user:manage:org')
    @HttpCode(HttpStatus.NO_CONTENT)
    async removeBranchManager(
        @Param('branchId') branchId: string,
        @Param('managerId') managerId: string,
        @User() user: UserContext
    ): Promise<void> {
        await this.branchService.removeBranchManager(managerId, branchId, user.sub);
    }

    @Get(':branchId/managers')
    @Permissions('branch:read:all')
    async getBranchManagers(@Param('branchId') branchId: string, @Scope() scope: DataScope) {
        const managers = await this.branchService.getBranchManagers(branchId, scope);

        return managers.map(managedBranch => ({
            id: managedBranch.id,
            managerId: managedBranch.managerId,
            branchId: managedBranch.branchId,
            assignedAt: managedBranch.assignedAt,
            manager: {
                id: managedBranch.manager.user.id,
                email: managedBranch.manager.user.email,
                fullName: managedBranch.manager.user.fullName,
                role: managedBranch.manager.role,
            },
        }));
    }
}
