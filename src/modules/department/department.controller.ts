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
    NotFoundException,
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
import { DepartmentService } from './department.service';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
    CreateDepartmentDto,
    DepartmentCountResponseDto,
    DepartmentResponseDto,
    DepartmentStatsResponseDto,
    PaginationDto,
    UpdateDepartmentDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';
import { ApiOkResponseData, ApiOkResponsePaginated } from '@/shared/utils';
import { Department } from '@prisma/client';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
@ApiExtraModels(ApiSuccessResponse, DepartmentResponseDto, DepartmentStatsResponseDto, DepartmentCountResponseDto)
export class DepartmentController {
    constructor(private readonly departmentService: DepartmentService) {}

    @Post()
    @Permissions(PERMISSIONS.DEPARTMENT.CREATE)
    @ApiOperation({ summary: 'Create a new department' })
    @ApiBody({ type: CreateDepartmentDto })
    @ApiResponse({
        status: 201,
        description: 'The department has been successfully created.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(DepartmentResponseDto) },
                    },
                },
            ],
        }
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async createDepartment(
        @Body() createDepartmentDto: CreateDepartmentDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Department> {
        return this.departmentService.createDepartment(
            createDepartmentDto,
            scope,
            user.sub
        );
    }

    @Get()
    @Permissions(PERMISSIONS.DEPARTMENT.MANAGE_ALL)
    @ApiOperation({ summary: 'Get all departments with pagination' })
    @ApiOkResponsePaginated(DepartmentResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getDepartments(
        @Scope() scope: DataScope,
        @Query() paginationDto: PaginationDto
    ) {
        return this.departmentService.getDepartments(scope, paginationDto);
    }

    @Get('search')
    @Permissions(PERMISSIONS.DEPARTMENT.MANAGE_ALL)
    @ApiOperation({ summary: 'Search for departments' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiOkResponsePaginated(DepartmentResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async searchDepartments(
        @Query('q') searchTerm: string,
        @Scope() scope: DataScope
    ): Promise<Department[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }
        return this.departmentService.searchDepartments(
            searchTerm.trim(),
            scope
        );
    }

    @Get('count')
    @Permissions(PERMISSIONS.DEPARTMENT.MANAGE_ALL)
    @ApiOperation({ summary: 'Get the total number of departments' })
    @ApiOkResponseData(DepartmentCountResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getDepartmentCount(@Scope() scope: DataScope): Promise<{ count: number }> {
        const count = await this.departmentService.getDepartmentCount(scope);
        return { count };
    }

    @Get('branch/:branchId')
    @Permissions(PERMISSIONS.DEPARTMENT.MANAGE_ALL)
    @ApiOperation({ summary: 'Get all departments for a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiOkResponsePaginated(DepartmentResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ApiErrorResponse })
    async getDepartmentsByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<Department[]> {
        return this.departmentService.getDepartmentsByBranch(branchId, scope);
    }

    @Get('branch/:branchId/hierarchy')
    @Permissions(PERMISSIONS.DEPARTMENT.MANAGE_ALL)
    @ApiOperation({ summary: 'Get the department hierarchy for a branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiOkResponseData(DepartmentResponseDto) // Note: This returns a tree structure, so paginated might not be the best fit.
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ApiErrorResponse })
    async getDepartmentHierarchy(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<Department[]> {
        return this.departmentService.getDepartmentHierarchy(branchId, scope);
    }

    @Get(':id')
    @Permissions(PERMISSIONS.DEPARTMENT.MANAGE_ALL)
    @ApiOperation({ summary: 'Get a specific department by ID' })
    @ApiParam({ name: 'id', description: 'ID of the department' })
    @ApiOkResponseData(DepartmentResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Department not found.', type: ApiErrorResponse })
    async getDepartmentById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<Department> {
        const department = await this.departmentService.getDepartmentById(id, scope);
        if (!department) {
            throw new NotFoundException('Department not found.');
        }
        return department;
    }

    @Get(':id/stats')
    @Permissions(PERMISSIONS.DEPARTMENT.MANAGE_ALL)
    @ApiOperation({ summary: 'Get a department with its statistics' })
    @ApiParam({ name: 'id', description: 'ID of the department' })
    @ApiOkResponseData(DepartmentStatsResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Department not found.', type: ApiErrorResponse })
    async getDepartmentWithStats(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ) {
        return this.departmentService.getDepartmentWithStats(id, scope);
    }

    @Patch(':id')
    @Permissions(PERMISSIONS.DEPARTMENT.MANAGE_ALL)
    @ApiOperation({ summary: 'Update a department' })
    @ApiParam({ name: 'id', description: 'ID of the department to update' })
    @ApiBody({ type: UpdateDepartmentDto })
    @ApiOkResponseData(DepartmentResponseDto)
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Department not found.', type: ApiErrorResponse })
    async updateDepartment(
        @Param('id') id: string,
        @Body() updateDepartmentDto: UpdateDepartmentDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Department> {
        return this.departmentService.updateDepartment(
            id,
            updateDepartmentDto,
            scope,
            user.sub
        );
    }

    @Delete(':id')
    @Permissions(PERMISSIONS.DEPARTMENT.MANAGE_ALL)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a department' })
    @ApiParam({ name: 'id', description: 'ID of the department to delete' })
    @ApiResponse({ status: 204, description: 'The department has been successfully deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Department not found.', type: ApiErrorResponse })
    async deleteDepartment(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.departmentService.deleteDepartment(id, scope, user.sub);
    }
}
