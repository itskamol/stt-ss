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
    EmployeeCountResponseDto,
    EmployeeResponseDto,
    ErrorResponseDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateEmployeeDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { DataScope, UserContext } from '@/shared/interfaces';
import { AuditLog } from '@/shared/interceptors/audit-log.interceptor';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { plainToClass } from 'class-transformer';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeeController {
    constructor(private readonly employeeService: EmployeeService) {}

    @Post()
    @Permissions(PERMISSIONS.EMPLOYEE.CREATE)
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
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async createEmployee(
        @Body() createEmployeeDto: CreateEmployeeDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<EmployeeResponseDto> {
        const employee = await this.employeeService.createEmployee(
            createEmployeeDto,
            scope,
            user.sub
        );
        return plainToClass(EmployeeResponseDto, employee);
    }

    @Get()
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get all employees with pagination' })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of employees.',
        type: PaginationResponseDto<EmployeeResponseDto>,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async getEmployees(
        @Scope() scope: DataScope,
        @Query() paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<EmployeeResponseDto>> {
        const employees = await this.employeeService.getEmployees(scope);

        // Simple pagination (in a real app, you'd do this at the database level)
        const { page = 1, limit = 10 } = paginationDto;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedEmployees = employees.slice(startIndex, endIndex);

        const responseEmployees = paginatedEmployees.map(employee =>
            plainToClass(EmployeeResponseDto, employee)
        );

        return new PaginationResponseDto(responseEmployees, employees.length, page, limit);
    }

    @Get('search')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Search for employees' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiResponse({
        status: 200,
        description: 'A list of employees matching the search term.',
        type: [EmployeeResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async searchEmployees(
        @Query('q') searchTerm: string,
        @Scope() scope: DataScope
    ): Promise<EmployeeResponseDto[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        const employees = await this.employeeService.searchEmployees(searchTerm.trim(), scope);

        return employees.map(employee => plainToClass(EmployeeResponseDto, employee));
    }

    @Get('count')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get the total number of employees' })
    @ApiResponse({
        status: 200,
        description: 'The total number of employees.',
        type: EmployeeCountResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async getEmployeeCount(@Scope() scope: DataScope): Promise<EmployeeCountResponseDto> {
        const count = await this.employeeService.getEmployeeCount(scope);
        return { count };
    }

    @Get('branch/:branchId')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get all employees for a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiResponse({
        status: 200,
        description: 'A list of employees for the branch.',
        type: [EmployeeResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ErrorResponseDto })
    async getEmployeesByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<EmployeeResponseDto[]> {
        const employees = await this.employeeService.getEmployeesByBranch(branchId, scope);
        return employees.map(employee => plainToClass(EmployeeResponseDto, employee));
    }

    @Get('branch/:branchId/count')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get the number of employees in a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiResponse({
        status: 200,
        description: 'The number of employees in the branch.',
        type: EmployeeCountResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ErrorResponseDto })
    async getEmployeeCountByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<EmployeeCountResponseDto> {
        const count = await this.employeeService.getEmployeeCountByBranch(branchId, scope);
        return { count };
    }

    @Get('department/:departmentId')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get all employees for a specific department' })
    @ApiParam({ name: 'departmentId', description: 'ID of the department' })
    @ApiResponse({
        status: 200,
        description: 'A list of employees for the department.',
        type: [EmployeeResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Department not found.', type: ErrorResponseDto })
    async getEmployeesByDepartment(
        @Param('departmentId') departmentId: string,
        @Scope() scope: DataScope
    ): Promise<EmployeeResponseDto[]> {
        const employees = await this.employeeService.getEmployeesByDepartment(departmentId, scope);
        return employees.map(employee => plainToClass(EmployeeResponseDto, employee));
    }

    @Get('department/:departmentId/count')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get the number of employees in a specific department' })
    @ApiParam({ name: 'departmentId', description: 'ID of the department' })
    @ApiResponse({
        status: 200,
        description: 'The number of employees in the department.',
        type: EmployeeCountResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Department not found.', type: ErrorResponseDto })
    async getEmployeeCountByDepartment(
        @Param('departmentId') departmentId: string,
        @Scope() scope: DataScope
    ): Promise<EmployeeCountResponseDto> {
        const count = await this.employeeService.getEmployeeCountByDepartment(departmentId, scope);
        return { count };
    }

    @Get('code/:employeeCode')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get an employee by their employee code' })
    @ApiParam({ name: 'employeeCode', description: 'Employee code' })
    @ApiResponse({ status: 200, description: 'The employee details.', type: EmployeeResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ErrorResponseDto })
    async getEmployeeByCode(
        @Param('employeeCode') employeeCode: string,
        @Scope() scope: DataScope
    ): Promise<EmployeeResponseDto> {
        const employee = await this.employeeService.getEmployeeByCode(employeeCode, scope);
        if (!employee) {
            throw new Error('Employee not found');
        }
        return plainToClass(EmployeeResponseDto, employee);
    }

    @Get(':id')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get a specific employee by ID' })
    @ApiParam({ name: 'id', description: 'ID of the employee' })
    @ApiResponse({ status: 200, description: 'The employee details.', type: EmployeeResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ErrorResponseDto })
    async getEmployeeById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<EmployeeResponseDto> {
        const employee = await this.employeeService.getEmployeeById(id, scope);
        if (!employee) {
            throw new Error('Employee not found');
        }
        return plainToClass(EmployeeResponseDto, employee);
    }

    @Patch(':id')
    @Permissions(PERMISSIONS.EMPLOYEE.UPDATE_MANAGED)
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
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ErrorResponseDto })
    async updateEmployee(
        @Param('id') id: string,
        @Body() updateEmployeeDto: UpdateEmployeeDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<EmployeeResponseDto> {
        const employee = await this.employeeService.updateEmployee(
            id,
            updateEmployeeDto,
            scope,
            user.sub
        );
        return plainToClass(EmployeeResponseDto, employee);
    }

    @Patch(':id/status')
    @Permissions(PERMISSIONS.EMPLOYEE.UPDATE_MANAGED)
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
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ErrorResponseDto })
    async toggleEmployeeStatus(
        @Param('id') id: string,
        @Body('isActive') isActive: boolean,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<EmployeeResponseDto> {
        const employee = await this.employeeService.toggleEmployeeStatus(
            id,
            isActive,
            scope,
            user.sub
        );
        return plainToClass(EmployeeResponseDto, employee);
    }

    @Delete(':id')
    @Permissions(PERMISSIONS.EMPLOYEE.UPDATE_MANAGED)
    @AuditLog({
        action: 'DELETE',
        resource: 'employee',
        captureRequest: true,
    })
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete an employee' })
    @ApiParam({ name: 'id', description: 'ID of the employee to delete' })
    @ApiResponse({ status: 204, description: 'The employee has been successfully deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ErrorResponseDto })
    async deleteEmployee(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.employeeService.deleteEmployee(id, scope, user.sub);
    }
}
