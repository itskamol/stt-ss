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
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { BranchService } from './branch.service';
import {
    AssignBranchManagerBodyDto,
    AssignBranchManagerDto,
    BranchResponseDto,
    CreateBranchDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateBranchDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { DataScope, UserContext } from '@/shared/interfaces';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchController {
    constructor(private readonly branchService: BranchService) {}

    @Post()
    @Permissions('branch:create')
    @ApiOperation({ summary: 'Create a new branch' })
    @ApiBody({ type: CreateBranchDto })
    @ApiResponse({
        status: 201,
        description: 'The branch has been successfully created.',
        type: BranchResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
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
    @ApiOperation({ summary: 'Get all branches with pagination' })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of branches.',
        type: PaginationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
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
    @ApiOperation({ summary: 'Search for branches' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiResponse({
        status: 200,
        description: 'A list of branches matching the search term.',
        type: [BranchResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
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
    @ApiOperation({ summary: 'Get the total number of branches' })
    @ApiResponse({ status: 200, description: 'The total number of branches.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getBranchCount(@Scope() scope: DataScope): Promise<{ count: number }> {
        const count = await this.branchService.getBranchCount(scope);
        return { count };
    }

    @Get(':id')
    @Permissions('branch:read:all')
    @ApiOperation({ summary: 'Get a specific branch by ID' })
    @ApiParam({ name: 'id', description: 'ID of the branch' })
    @ApiResponse({ status: 200, description: 'The branch details.', type: BranchResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Branch not found.' })
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
    @ApiOperation({ summary: 'Get a branch with its statistics' })
    @ApiParam({ name: 'id', description: 'ID of the branch' })
    @ApiResponse({ status: 200, description: 'The branch with statistics.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Branch not found.' })
    async getBranchWithStats(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.branchService.getBranchWithStats(id, scope);
    }

    @Patch(':id')
    @Permissions('branch:update:managed')
    @ApiOperation({ summary: 'Update a branch' })
    @ApiParam({ name: 'id', description: 'ID of the branch to update' })
    @ApiBody({ type: UpdateBranchDto })
    @ApiResponse({
        status: 200,
        description: 'The branch has been successfully updated.',
        type: BranchResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Branch not found.' })
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
    @ApiOperation({ summary: 'Delete a branch' })
    @ApiParam({ name: 'id', description: 'ID of the branch to delete' })
    @ApiResponse({ status: 204, description: 'The branch has been successfully deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Branch not found.' })
    async deleteBranch(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.branchService.deleteBranch(id, scope, user.sub);
    }

    @Post(':branchId/managers')
    @Permissions('user:manage:org')
    @ApiOperation({ summary: 'Assign a manager to a branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiBody({ type: AssignBranchManagerBodyDto })
    @ApiResponse({ status: 201, description: 'Manager assigned successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Branch or user not found.' })
    async assignBranchManager(
        @Param('branchId') branchId: string,
        @Body() assignDto: AssignBranchManagerBodyDto,
        @User() user: UserContext
    ) {
        const fullAssignDto: AssignBranchManagerDto = {
            managerId: assignDto.managerId,
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
    @ApiOperation({ summary: 'Remove a manager from a branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiParam({ name: 'managerId', description: 'ID of the manager to remove' })
    @ApiResponse({ status: 204, description: 'Manager removed successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Assignment not found.' })
    async removeBranchManager(
        @Param('branchId') branchId: string,
        @Param('managerId') managerId: string,
        @User() user: UserContext
    ): Promise<void> {
        await this.branchService.removeBranchManager(managerId, branchId, user.sub);
    }

    @Get(':branchId/managers')
    @Permissions('branch:read:all')
    @ApiOperation({ summary: 'Get all managers for a branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiResponse({ status: 200, description: 'A list of branch managers.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Branch not found.' })
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
