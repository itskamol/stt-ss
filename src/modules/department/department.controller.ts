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
import { DepartmentService } from './department.service';
import {
    CreateDepartmentDto,
    DepartmentResponseDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateDepartmentDto,
} from '../../shared/dto';
import { Permissions, Scope, User } from '../../shared/decorators';
import { DataScope, UserContext } from '../../shared/interfaces';

@Controller('departments')
export class DepartmentController {
    constructor(private readonly departmentService: DepartmentService) {}

    @Post()
    @Permissions('department:create')
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
    async getDepartmentCount(@Scope() scope: DataScope): Promise<{ count: number }> {
        const count = await this.departmentService.getDepartmentCount(scope);
        return { count };
    }

    @Get('branch/:branchId')
    @Permissions('department:read:all')
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
    async getDepartmentHierarchy(@Param('branchId') branchId: string, @Scope() scope: DataScope) {
        const hierarchy = await this.departmentService.getDepartmentHierarchy(branchId, scope);

        return hierarchy.map(department => this.mapDepartmentWithChildren(department));
    }

    @Get(':id')
    @Permissions('department:read:all')
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
    async getDepartmentWithStats(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.departmentService.getDepartmentWithStats(id, scope);
    }

    @Patch(':id')
    @Permissions('department:update:managed')
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
