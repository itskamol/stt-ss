import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiExtraModels,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
    getSchemaPath,
} from '@nestjs/swagger';
import { BranchService } from './branch.service';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
    AssignBranchManagerBodyDto,
    AssignBranchManagerDto,
    BranchCountResponseDto,
    BranchManagerResponseDto,
    BranchResponseDto,
    BranchStatsResponseDto,
    CreateBranchDto,
    ManagedBranchResponseDto,
    PaginationDto,
    UpdateBranchDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';
import { ApiOkResponseData, ApiOkResponsePaginated } from '@/shared/utils';
import { Branch, ManagedBranch } from '@prisma/client';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
@ApiExtraModels(
    ApiSuccessResponse,
    BranchResponseDto,
    BranchStatsResponseDto,
    BranchCountResponseDto,
    BranchManagerResponseDto,
    ManagedBranchResponseDto
)
export class BranchController {
    constructor(private readonly branchService: BranchService) {}

    @Post()
    @Permissions(PERMISSIONS.BRANCH.CREATE)
    @ApiOperation({ summary: 'Create a new branch' })
    @ApiBody({ type: CreateBranchDto })
    @ApiResponse({
        status: 201,
        description: 'The branch has been successfully created.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(BranchResponseDto) },
                    },
                },
            ],
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async createBranch(
        @Body() createBranchDto: CreateBranchDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Branch> {
        return this.branchService.createBranch(createBranchDto, scope, user.sub);
    }

    @Get()
    @Permissions(PERMISSIONS.BRANCH.READ_ALL)
    @ApiOperation({ summary: 'Get all branches with pagination' })
    @ApiOkResponsePaginated(BranchResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getBranches(@Scope() scope: DataScope, @Query() paginationDto: PaginationDto) {
        return this.branchService.getBranches(scope, paginationDto);
    }

    @Get('search')
    @Permissions(PERMISSIONS.BRANCH.READ_ALL)
    @ApiOperation({ summary: 'Search for branches' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiOkResponsePaginated(BranchResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async searchBranches(
        @Query('q') searchTerm: string,
        @Scope() scope: DataScope
    ): Promise<Branch[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }
        return this.branchService.searchBranches(searchTerm.trim(), scope);
    }

    @Get('count')
    @Permissions(PERMISSIONS.BRANCH.READ_ALL)
    @ApiOperation({ summary: 'Get the total number of branches' })
    @ApiOkResponseData(BranchCountResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getBranchCount(@Scope() scope: DataScope): Promise<{ count: number }> {
        const count = await this.branchService.getBranchCount(scope);
        return { count };
    }

    @Get(':id')
    @Permissions(PERMISSIONS.BRANCH.READ_ALL)
    @ApiOperation({ summary: 'Get a specific branch by ID' })
    @ApiParam({ name: 'id', description: 'ID of the branch' })
    @ApiOkResponseData(BranchResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ApiErrorResponse })
    async getBranchById(@Param('id') id: string, @Scope() scope: DataScope): Promise<Branch> {
        const branch = await this.branchService.getBranchById(id, scope);
        if (!branch) {
            throw new NotFoundException('Branch not found.');
        }
        return branch;
    }

    @Get(':id/stats')
    @Permissions(PERMISSIONS.BRANCH.READ_ALL)
    @ApiOperation({ summary: 'Get a branch with its statistics' })
    @ApiParam({ name: 'id', description: 'ID of the branch' })
    @ApiOkResponseData(BranchStatsResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ApiErrorResponse })
    async getBranchWithStats(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.branchService.getBranchWithStats(id, scope);
    }

    @Patch(':id')
    @Permissions(PERMISSIONS.BRANCH.UPDATE_MANAGED)
    @ApiOperation({ summary: 'Update a branch' })
    @ApiParam({ name: 'id', description: 'ID of the branch to update' })
    @ApiBody({ type: UpdateBranchDto })
    @ApiOkResponseData(BranchResponseDto)
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ApiErrorResponse })
    async updateBranch(
        @Param('id') id: string,
        @Body() updateBranchDto: UpdateBranchDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Branch> {
        return this.branchService.updateBranch(id, updateBranchDto, scope, user.sub);
    }

    @Delete(':id')
    @Permissions(PERMISSIONS.BRANCH.UPDATE_MANAGED)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a branch' })
    @ApiParam({ name: 'id', description: 'ID of the branch to delete' })
    @ApiResponse({ status: 204, description: 'The branch has been successfully deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ApiErrorResponse })
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
    @ApiOkResponseData(ManagedBranchResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({
        status: 404,
        description: 'Branch or user not found.',
        type: ApiErrorResponse,
    })
    async assignBranchManager(
        @Param('branchId') branchId: string,
        @Body() assignDto: AssignBranchManagerBodyDto,
        @User() user: UserContext
    ): Promise<ManagedBranch> {
        const fullAssignDto: AssignBranchManagerDto = {
            managerId: assignDto.managerId,
            branchId,
        };

        return this.branchService.assignBranchManager(fullAssignDto, user.sub);
    }

    @Delete(':branchId/managers/:managerId')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove a manager from a branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiParam({ name: 'managerId', description: 'ID of the manager to remove' })
    @ApiResponse({ status: 204, description: 'Manager removed successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Assignment not found.', type: ApiErrorResponse })
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
    @ApiOkResponsePaginated(BranchManagerResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ApiErrorResponse })
    async getBranchManagers(@Param('branchId') branchId: string, @Scope() scope: DataScope) {
        return this.branchService.getBranchManagers(branchId, scope);
    }
}
