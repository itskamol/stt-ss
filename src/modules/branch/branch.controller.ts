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
    ErrorResponseDto,
    ManagedBranchResponseDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateBranchDto,
    BranchCountResponseDto,
    BranchStatsResponseDto,
    BranchManagerResponseDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';
import { plainToClass } from 'class-transformer';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchController {
    constructor(private readonly branchService: BranchService) {}

    @Post()
    @Permissions(PERMISSIONS.BRANCH.CREATE)
    @ApiOperation({ summary: 'Create a new branch' })
    @ApiBody({ type: CreateBranchDto })
    @ApiResponse({
        status: 201,
        description: 'The branch has been successfully created.',
        type: BranchResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async createBranch(
        @Body() createBranchDto: CreateBranchDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<BranchResponseDto> {
        const branch = await this.branchService.createBranch(createBranchDto, scope, user.sub);
        return plainToClass(BranchResponseDto, branch);
    }

    @Get()
    @Permissions(PERMISSIONS.BRANCH.READ_ALL)
    @ApiOperation({ summary: 'Get all branches with pagination' })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of branches.',
        type: PaginationResponseDto<BranchResponseDto>,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
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

        const responseBranches = paginatedBranches.map(branch =>
            plainToClass(BranchResponseDto, branch)
        );

        return new PaginationResponseDto(responseBranches, branches.length, page, limit);
    }

    @Get('search')
    @Permissions(PERMISSIONS.BRANCH.READ_ALL)
    @ApiOperation({ summary: 'Search for branches' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiResponse({
        status: 200,
        description: 'A list of branches matching the search term.',
        type: [BranchResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async searchBranches(
        @Query('q') searchTerm: string,
        @Scope() scope: DataScope
    ): Promise<BranchResponseDto[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        const branches = await this.branchService.searchBranches(searchTerm.trim(), scope);

        return branches.map(branch => plainToClass(BranchResponseDto, branch));
    }

    @Get('count')
    @Permissions(PERMISSIONS.BRANCH.READ_ALL)
    @ApiOperation({ summary: 'Get the total number of branches' })
    @ApiResponse({
        status: 200,
        description: 'The total number of branches.',
        type: BranchCountResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async getBranchCount(@Scope() scope: DataScope): Promise<BranchCountResponseDto> {
        const count = await this.branchService.getBranchCount(scope);
        return { count };
    }

    @Get(':id')
    @Permissions(PERMISSIONS.BRANCH.READ_ALL)
    @ApiOperation({ summary: 'Get a specific branch by ID' })
    @ApiParam({ name: 'id', description: 'ID of the branch' })
    @ApiResponse({ status: 200, description: 'The branch details.', type: BranchResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ErrorResponseDto })
    async getBranchById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<BranchResponseDto> {
        const branch = await this.branchService.getBranchById(id, scope);
        if (!branch) {
            throw new Error('Branch not found');
        }
        return plainToClass(BranchResponseDto, branch);
    }

    @Get(':id/stats')
    @Permissions(PERMISSIONS.BRANCH.READ_ALL)
    @ApiOperation({ summary: 'Get a branch with its statistics' })
    @ApiParam({ name: 'id', description: 'ID of the branch' })
    @ApiResponse({
        status: 200,
        description: 'The branch with statistics.',
        type: BranchStatsResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ErrorResponseDto })
    async getBranchWithStats(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<BranchStatsResponseDto> {
        const stats = await this.branchService.getBranchWithStats(id, scope);
        return plainToClass(BranchStatsResponseDto, stats);
    }

    @Patch(':id')
    @Permissions(PERMISSIONS.BRANCH.UPDATE_MANAGED)
    @ApiOperation({ summary: 'Update a branch' })
    @ApiParam({ name: 'id', description: 'ID of the branch to update' })
    @ApiBody({ type: UpdateBranchDto })
    @ApiResponse({
        status: 200,
        description: 'The branch has been successfully updated.',
        type: BranchResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ErrorResponseDto })
    async updateBranch(
        @Param('id') id: string,
        @Body() updateBranchDto: UpdateBranchDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<BranchResponseDto> {
        const branch = await this.branchService.updateBranch(id, updateBranchDto, scope, user.sub);
        return plainToClass(BranchResponseDto, branch);
    }

    @Delete(':id')
    @Permissions(PERMISSIONS.BRANCH.UPDATE_MANAGED)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a branch' })
    @ApiParam({ name: 'id', description: 'ID of the branch to delete' })
    @ApiResponse({ status: 204, description: 'The branch has been successfully deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ErrorResponseDto })
    async deleteBranch(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.branchService.deleteBranch(id, scope, user.sub);
    }

    @Post(':branchId/managers')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Assign a manager to a branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiBody({ type: AssignBranchManagerBodyDto })
    @ApiResponse({
        status: 201,
        description: 'Manager assigned successfully.',
        type: ManagedBranchResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({
        status: 404,
        description: 'Branch or user not found.',
        type: ErrorResponseDto,
    })
    async assignBranchManager(
        @Param('branchId') branchId: string,
        @Body() assignDto: AssignBranchManagerBodyDto,
        @User() user: UserContext
    ): Promise<ManagedBranchResponseDto> {
        const fullAssignDto: AssignBranchManagerDto = {
            managerId: assignDto.managerId,
            branchId,
        };

        const managedBranch = await this.branchService.assignBranchManager(fullAssignDto, user.sub);
        return plainToClass(ManagedBranchResponseDto, managedBranch);
    }

    @Delete(':branchId/managers/:managerId')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove a manager from a branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiParam({ name: 'managerId', description: 'ID of the manager to remove' })
    @ApiResponse({ status: 204, description: 'Manager removed successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Assignment not found.', type: ErrorResponseDto })
    async removeBranchManager(
        @Param('branchId') branchId: string,
        @Param('managerId') managerId: string,
        @User() user: UserContext
    ): Promise<void> {
        await this.branchService.removeBranchManager(managerId, branchId, user.sub);
    }

    @Get(':branchId/managers')
    @Permissions(PERMISSIONS.BRANCH.READ_ALL)
    @ApiOperation({ summary: 'Get all managers for a branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiResponse({
        status: 200,
        description: 'A list of branch managers.',
        type: [BranchManagerResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ErrorResponseDto })
    async getBranchManagers(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<BranchManagerResponseDto[]> {
        const managers = await this.branchService.getBranchManagers(branchId, scope);

        return managers.map(managedBranch =>
            plainToClass(BranchManagerResponseDto, {
                ...managedBranch,
                manager: {
                    id: managedBranch.manager.user.id,
                    email: managedBranch.manager.user.email,
                    fullName: managedBranch.manager.user.fullName,
                    role: managedBranch.manager.role,
                },
            })
        );
    }
}
