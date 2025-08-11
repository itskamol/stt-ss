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
import { EmployeeService } from './employee.service';
import {
    CreateEmployeeDto,
    EmployeeResponseDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateEmployeeDto,
} from '../../shared/dto';
import { Permissions, Scope, User } from '../../shared/decorators';
import { DataScope, UserContext } from '../../shared/interfaces';
import { AuditLog } from '../../shared/interceptors/audit-log.interceptor';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeeController {
    constructor(private readonly employeeService: EmployeeService) {}

    @Post()
    @Permissions('employee:create')
    @AuditLog({
        action: 'CREATE',
        resource: 'employee',
        captureRequest: true,
        captureResponse: true,
    })
    @ApiOperation({ summary: 'Create a new employee' })
    @ApiBody({ type: CreateEmployeeDto })
    @ApiResponse({
        status: 201,
        description: 'The employee has been successfully created.',
        type: EmployeeResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async createEmployee(
        @Body() createEmployeeDto: CreateEmployeeDto,
        @User() user: UserContext,
        @Scope() scope: DataScope,
    ): Promise<EmployeeResponseDto> {
        const employee = await this.employeeService.createEmployee(
            createEmployeeDto,
            scope,
            user.sub,
        );

        return {
            id: employee.id,
            organizationId: employee.organizationId,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeCode: employee.employeeCode,
            email: employee.email,
            phone: employee.phone,
            isActive: employee.isActive,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
        };
    }

    @Get()
    @Permissions('employee:read:all')
    @ApiOperation({ summary: 'Get all employees with pagination' })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of employees.',
        type: PaginationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getEmployees(
        @Scope() scope: DataScope,
        @Query() paginationDto: PaginationDto,
    ): Promise<PaginationResponseDto<EmployeeResponseDto>> {
        const employees = await this.employeeService.getEmployees(scope);

        // Simple pagination (in a real app, you'd do this at the database level)
        const { page = 1, limit = 10 } = paginationDto;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedEmployees = employees.slice(startIndex, endIndex);

        const responseEmployees = paginatedEmployees.map(employee => ({
            id: employee.id,
            organizationId: employee.organizationId,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeCode: employee.employeeCode,
            email: employee.email,
            phone: employee.phone,
            isActive: employee.isActive,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
        }));

        return new PaginationResponseDto(responseEmployees, employees.length, page, limit);
    }

    @Get('search')
    @Permissions('employee:read:all')
    @ApiOperation({ summary: 'Search for employees' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiResponse({
        status: 200,
        description: 'A list of employees matching the search term.',
        type: [EmployeeResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async searchEmployees(
        @Query('q') searchTerm: string,
        @Scope() scope: DataScope,
    ): Promise<EmployeeResponseDto[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        const employees = await this.employeeService.searchEmployees(searchTerm.trim(), scope);

        return employees.map(employee => ({
            id: employee.id,
            organizationId: employee.organizationId,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeCode: employee.employeeCode,
            email: employee.email,
            phone: employee.phone,
            isActive: employee.isActive,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
        }));
    }

    @Get('count')
    @Permissions('employee:read:all')
    @ApiOperation({ summary: 'Get the total number of employees' })
    @ApiResponse({ status: 200, description: 'The total number of employees.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getEmployeeCount(@Scope() scope: DataScope): Promise<{ count: number }> {
        const count = await this.employeeService.getEmployeeCount(scope);
        return { count };
    }

    @Get('branch/:branchId')
    @Permissions('employee:read:all')
    @ApiOperation({ summary: 'Get all employees for a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiResponse({
        status: 200,
        description: 'A list of employees for the branch.',
        type: [EmployeeResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Branch not found.' })
    async getEmployeesByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope,
    ): Promise<EmployeeResponseDto[]> {
        const employees = await this.employeeService.getEmployeesByBranch(branchId, scope);

        return employees.map(employee => ({
            id: employee.id,
            organizationId: employee.organizationId,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeCode: employee.employeeCode,
            email: employee.email,
            phone: employee.phone,
            isActive: employee.isActive,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
        }));
    }

    @Get('branch/:branchId/count')
    @Permissions('employee:read:all')
    @ApiOperation({ summary: 'Get the number of employees in a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiResponse({ status: 200, description: 'The number of employees in the branch.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Branch not found.' })
    async getEmployeeCountByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope,
    ): Promise<{ count: number }> {
        const count = await this.employeeService.getEmployeeCountByBranch(branchId, scope);
        return { count };
    }

    @Get('department/:departmentId')
    @Permissions('employee:read:all')
    @ApiOperation({ summary: 'Get all employees for a specific department' })
    @ApiParam({ name: 'departmentId', description: 'ID of the department' })
    @ApiResponse({
        status: 200,
        description: 'A list of employees for the department.',
        type: [EmployeeResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Department not found.' })
    async getEmployeesByDepartment(
        @Param('departmentId') departmentId: string,
        @Scope() scope: DataScope,
    ): Promise<EmployeeResponseDto[]> {
        const employees = await this.employeeService.getEmployeesByDepartment(departmentId, scope);

        return employees.map(employee => ({
            id: employee.id,
            organizationId: employee.organizationId,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeCode: employee.employeeCode,
            email: employee.email,
            phone: employee.phone,
            isActive: employee.isActive,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
        }));
    }

    @Get('department/:departmentId/count')
    @Permissions('employee:read:all')
    @ApiOperation({ summary: 'Get the number of employees in a specific department' })
    @ApiParam({ name: 'departmentId', description: 'ID of the department' })
    @ApiResponse({ status: 200, description: 'The number of employees in the department.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Department not found.' })
    async getEmployeeCountByDepartment(
        @Param('departmentId') departmentId: string,
        @Scope() scope: DataScope,
    ): Promise<{ count: number }> {
        const count = await this.employeeService.getEmployeeCountByDepartment(departmentId, scope);
        return { count };
    }

    @Get('code/:employeeCode')
    @Permissions('employee:read:all')
    @ApiOperation({ summary: 'Get an employee by their employee code' })
    @ApiParam({ name: 'employeeCode', description: 'Employee code' })
    @ApiResponse({ status: 200, description: 'The employee details.', type: EmployeeResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Employee not found.' })
    async getEmployeeByCode(
        @Param('employeeCode') employeeCode: string,
        @Scope() scope: DataScope,
    ): Promise<EmployeeResponseDto> {
        const employee = await this.employeeService.getEmployeeByCode(employeeCode, scope);

        if (!employee) {
            throw new Error('Employee not found');
        }

        return {
            id: employee.id,
            organizationId: employee.organizationId,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeCode: employee.employeeCode,
            email: employee.email,
            phone: employee.phone,
            isActive: employee.isActive,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
        };
    }

    @Get(':id')
    @Permissions('employee:read:all')
    @ApiOperation({ summary: 'Get a specific employee by ID' })
    @ApiParam({ name: 'id', description: 'ID of the employee' })
    @ApiResponse({ status: 200, description: 'The employee details.', type: EmployeeResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Employee not found.' })
    async getEmployeeById(
        @Param('id') id: string,
        @Scope() scope: DataScope,
    ): Promise<EmployeeResponseDto> {
        const employee = await this.employeeService.getEmployeeById(id, scope);

        if (!employee) {
            throw new Error('Employee not found');
        }

        return {
            id: employee.id,
            organizationId: employee.organizationId,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeCode: employee.employeeCode,
            email: employee.email,
            phone: employee.phone,
            isActive: employee.isActive,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
        };
    }

    @Patch(':id')
    @Permissions('employee:update:managed')
    @AuditLog({
        action: 'UPDATE',
        resource: 'employee',
        captureRequest: true,
        captureResponse: true,
    })
    @ApiOperation({ summary: 'Update an employee' })
    @ApiParam({ name: 'id', description: 'ID of the employee to update' })
    @ApiBody({ type: UpdateEmployeeDto })
    @ApiResponse({
        status: 200,
        description: 'The employee has been successfully updated.',
        type: EmployeeResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Employee not found.' })
    async updateEmployee(
        @Param('id') id: string,
        @Body() updateEmployeeDto: UpdateEmployeeDto,
        @User() user: UserContext,
        @Scope() scope: DataScope,
    ): Promise<EmployeeResponseDto> {
        const employee = await this.employeeService.updateEmployee(
            id,
            updateEmployeeDto,
            scope,
            user.sub,
        );

        return {
            id: employee.id,
            organizationId: employee.organizationId,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeCode: employee.employeeCode,
            email: employee.email,
            phone: employee.phone,
            isActive: employee.isActive,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
        };
    }

    @Patch(':id/status')
    @Permissions('employee:update:managed')
    @AuditLog({
        action: 'STATUS_CHANGE',
        resource: 'employee',
        captureRequest: true,
        captureResponse: true,
    })
    @ApiOperation({ summary: 'Toggle the active status of an employee' })
    @ApiParam({ name: 'id', description: 'ID of the employee' })
    @ApiBody({
        schema: { type: 'object', properties: { isActive: { type: 'boolean' } } },
    })
    @ApiResponse({
        status: 200,
        description: 'The employee status has been updated.',
        type: EmployeeResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Employee not found.' })
    async toggleEmployeeStatus(
        @Param('id') id: string,
        @Body('isActive') isActive: boolean,
        @User() user: UserContext,
        @Scope() scope: DataScope,
    ): Promise<EmployeeResponseDto> {
        const employee = await this.employeeService.toggleEmployeeStatus(
            id,
            isActive,
            scope,
            user.sub,
        );

        return {
            id: employee.id,
            organizationId: employee.organizationId,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeCode: employee.employeeCode,
            email: employee.email,
            phone: employee.phone,
            isActive: employee.isActive,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt,
        };
    }

    @Delete(':id')
    @Permissions('employee:update:managed')
    @AuditLog({
        action: 'DELETE',
        resource: 'employee',
        captureRequest: true,
    })
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete an employee' })
    @ApiParam({ name: 'id', description: 'ID of the employee to delete' })
    @ApiResponse({ status: 204, description: 'The employee has been successfully deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Employee not found.' })
    async deleteEmployee(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope,
    ): Promise<void> {
        await this.employeeService.deleteEmployee(id, scope, user.sub);
    }
}
