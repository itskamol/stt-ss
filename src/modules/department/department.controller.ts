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
import { DepartmentService } from './department.service';
import {
    CreateDepartmentDto,
    DepartmentResponseDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateDepartmentDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { DataScope, UserContext } from '@/shared/interfaces';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentController {
    constructor(private readonly departmentService: DepartmentService) {}

    @Post()
    @Permissions('department:create')
    @ApiOperation({ summary: 'Create a new department' })
    @ApiBody({ type: CreateDepartmentDto })
    @ApiResponse({
        status: 201,
        description: 'The department has been successfully created.',
        type: DepartmentResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async createDepartment(
        @Body() createDepartmentDto: CreateDepartmentDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DepartmentResponseDto> {
        const department = await this.departmentService.createDepartment(
            createDepartmentDto,
            scope,
            user.sub
        );

        return {
            id: department.id,
            branchId: department.branchId,
            name: department.name,
            parentId: department.parentId,
            createdAt: department.createdAt,
            updatedAt: department.updatedAt,
        };
    }

    @Get()
    @Permissions('department:read:all')
    @ApiOperation({ summary: 'Get all departments with pagination' })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of departments.',
        type: PaginationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getDepartments(
        @Scope() scope: DataScope,
        @Query() paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<DepartmentResponseDto>> {
        const departments = await this.departmentService.getDepartments(scope);

        // Simple pagination (in a real app, you'd do this at the database level)
        const { page = 1, limit = 10 } = paginationDto;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedDepartments = departments.slice(startIndex, endIndex);

        const responseDepartments = paginatedDepartments.map(department => ({
            id: department.id,
            branchId: department.branchId,
            name: department.name,
            parentId: department.parentId,
            createdAt: department.createdAt,
            updatedAt: department.updatedAt,
        }));

        return new PaginationResponseDto(responseDepartments, departments.length, page, limit);
    }

    @Get('search')
    @Permissions('department:read:all')
    @ApiOperation({ summary: 'Search for departments' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiResponse({
        status: 200,
        description: 'A list of departments matching the search term.',
        type: [DepartmentResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async searchDepartments(
        @Query('q') searchTerm: string,
        @Scope() scope: DataScope
    ): Promise<DepartmentResponseDto[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        const departments = await this.departmentService.searchDepartments(
            searchTerm.trim(),
            scope
        );

        return departments.map(department => ({
            id: department.id,
            branchId: department.branchId,
            name: department.name,
            parentId: department.parentId,
            createdAt: department.createdAt,
            updatedAt: department.updatedAt,
        }));
    }

    @Get('count')
    @Permissions('department:read:all')
    @ApiOperation({ summary: 'Get the total number of departments' })
    @ApiResponse({ status: 200, description: 'The total number of departments.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getDepartmentCount(@Scope() scope: DataScope): Promise<{ count: number }> {
        const count = await this.departmentService.getDepartmentCount(scope);
        return { count };
    }

    @Get('branch/:branchId')
    @Permissions('department:read:all')
    @ApiOperation({ summary: 'Get all departments for a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiResponse({
        status: 200,
        description: 'A list of departments for the branch.',
        type: [DepartmentResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Branch not found.' })
    async getDepartmentsByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<DepartmentResponseDto[]> {
        const departments = await this.departmentService.getDepartmentsByBranch(branchId, scope);

        return departments.map(department => ({
            id: department.id,
            branchId: department.branchId,
            name: department.name,
            parentId: department.parentId,
            createdAt: department.createdAt,
            updatedAt: department.updatedAt,
        }));
    }

    @Get('branch/:branchId/hierarchy')
    @Permissions('department:read:all')
    @ApiOperation({ summary: 'Get the department hierarchy for a branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiResponse({ status: 200, description: 'The department hierarchy.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Branch not found.' })
    async getDepartmentHierarchy(@Param('branchId') branchId: string, @Scope() scope: DataScope) {
        const hierarchy = await this.departmentService.getDepartmentHierarchy(branchId, scope);

        return hierarchy.map(department => this.mapDepartmentWithChildren(department));
    }

    @Get(':id')
    @Permissions('department:read:all')
    @ApiOperation({ summary: 'Get a specific department by ID' })
    @ApiParam({ name: 'id', description: 'ID of the department' })
    @ApiResponse({
        status: 200,
        description: 'The department details.',
        type: DepartmentResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Department not found.' })
    async getDepartmentById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<DepartmentResponseDto> {
        const department = await this.departmentService.getDepartmentById(id, scope);

        if (!department) {
            throw new Error('Department not found');
        }

        return {
            id: department.id,
            branchId: department.branchId,
            name: department.name,
            parentId: department.parentId,
            createdAt: department.createdAt,
            updatedAt: department.updatedAt,
        };
    }

    @Get(':id/stats')
    @Permissions('department:read:all')
    @ApiOperation({ summary: 'Get a department with its statistics' })
    @ApiParam({ name: 'id', description: 'ID of the department' })
    @ApiResponse({ status: 200, description: 'The department with statistics.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Department not found.' })
    async getDepartmentWithStats(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.departmentService.getDepartmentWithStats(id, scope);
    }

    @Patch(':id')
    @Permissions('department:update:managed')
    @ApiOperation({ summary: 'Update a department' })
    @ApiParam({ name: 'id', description: 'ID of the department to update' })
    @ApiBody({ type: UpdateDepartmentDto })
    @ApiResponse({
        status: 200,
        description: 'The department has been successfully updated.',
        type: DepartmentResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Department not found.' })
    async updateDepartment(
        @Param('id') id: string,
        @Body() updateDepartmentDto: UpdateDepartmentDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DepartmentResponseDto> {
        const department = await this.departmentService.updateDepartment(
            id,
            updateDepartmentDto,
            scope,
            user.sub
        );

        return {
            id: department.id,
            branchId: department.branchId,
            name: department.name,
            parentId: department.parentId,
            createdAt: department.createdAt,
            updatedAt: department.updatedAt,
        };
    }

    @Delete(':id')
    @Permissions('department:update:managed')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a department' })
    @ApiParam({ name: 'id', description: 'ID of the department to delete' })
    @ApiResponse({ status: 204, description: 'The department has been successfully deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Department not found.' })
    async deleteDepartment(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.departmentService.deleteDepartment(id, scope, user.sub);
    }

    private mapDepartmentWithChildren(department: any): any {
        return {
            id: department.id,
            branchId: department.branchId,
            name: department.name,
            parentId: department.parentId,
            createdAt: department.createdAt,
            updatedAt: department.updatedAt,
            children: department.children
                ? department.children.map(child => this.mapDepartmentWithChildren(child))
                : [],
        };
    }
}
