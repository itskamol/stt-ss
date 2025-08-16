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
    UploadedFile,
    UseInterceptors,
    NotFoundException,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiExtraModels,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
    getSchemaPath,
} from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
    CreateEmployeeDto,
    EmployeeCountResponseDto,
    EmployeePhotoUploadResponseDto,
    EmployeeResponseDto,
    PaginationDto,
    UpdateEmployeeDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { DataScope, UserContext } from '@/shared/interfaces';
import { AuditLog } from '@/shared/interceptors/audit-log.interceptor';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOkResponseData, ApiOkResponsePaginated } from '@/shared/utils';
import { Employee } from '@prisma/client';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
@ApiExtraModels(ApiSuccessResponse, EmployeeResponseDto, EmployeeCountResponseDto, EmployeePhotoUploadResponseDto)
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
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(EmployeeResponseDto) },
                    },
                },
            ],
        }
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async createEmployee(
        @Body() createEmployeeDto: CreateEmployeeDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Employee> {
        return this.employeeService.createEmployee(
            createEmployeeDto,
            scope,
            user.sub
        );
    }

    @Get()
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get all employees with pagination' })
    @ApiOkResponsePaginated(EmployeeResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getEmployees(
        @Scope() scope: DataScope,
        @Query() paginationDto: PaginationDto
    ) {
        console.log('Fetching employees with pagination:', paginationDto);
        return this.employeeService.getPaginatedEmployees(scope, paginationDto);
    }

    @Get('search')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Search for employees' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiOkResponsePaginated(EmployeeResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async searchEmployees(
        @Query('q') searchTerm: string,
        @Scope() scope: DataScope
    ): Promise<Employee[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }
        return this.employeeService.searchEmployees(searchTerm.trim(), scope);
    }

    @Get('count')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get the total number of employees' })
    @ApiOkResponseData(EmployeeCountResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getEmployeeCount(@Scope() scope: DataScope): Promise<{ count: number }> {
        const count = await this.employeeService.getEmployeeCount(scope);
        return { count };
    }

    @Get('branch/:branchId')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get all employees for a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiOkResponsePaginated(EmployeeResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ApiErrorResponse })
    async getEmployeesByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<Employee[]> {
        return this.employeeService.getEmployeesByBranch(branchId, scope);
    }

    @Get('branch/:branchId/count')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get the number of employees in a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiOkResponseData(EmployeeCountResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ApiErrorResponse })
    async getEmployeeCountByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<{ count: number }> {
        const count = await this.employeeService.getEmployeeCountByBranch(branchId, scope);
        return { count };
    }

    @Get('department/:departmentId')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get all employees for a specific department' })
    @ApiParam({ name: 'departmentId', description: 'ID of the department' })
    @ApiOkResponsePaginated(EmployeeResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Department not found.', type: ApiErrorResponse })
    async getEmployeesByDepartment(
        @Param('departmentId') departmentId: string,
        @Scope() scope: DataScope
    ): Promise<Employee[]> {
        return this.employeeService.getEmployeesByDepartment(departmentId, scope);
    }

    @Get('department/:departmentId/count')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get the number of employees in a specific department' })
    @ApiParam({ name: 'departmentId', description: 'ID of the department' })
    @ApiOkResponseData(EmployeeCountResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Department not found.', type: ApiErrorResponse })
    async getEmployeeCountByDepartment(
        @Param('departmentId') departmentId: string,
        @Scope() scope: DataScope
    ): Promise<{ count: number }> {
        const count = await this.employeeService.getEmployeeCountByDepartment(departmentId, scope);
        return { count };
    }

    @Get('code/:employeeCode')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get an employee by their employee code' })
    @ApiParam({ name: 'employeeCode', description: 'Employee code' })
    @ApiOkResponseData(EmployeeResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ApiErrorResponse })
    async getEmployeeByCode(
        @Param('employeeCode') employeeCode: string,
        @Scope() scope: DataScope
    ): Promise<Employee> {
        const employee = await this.employeeService.getEmployeeByCode(employeeCode, scope);
        if (!employee) {
            throw new NotFoundException('Employee not found.');
        }
        return employee;
    }

    @Get(':id')
    @Permissions(PERMISSIONS.EMPLOYEE.READ_ALL)
    @ApiOperation({ summary: 'Get a specific employee by ID' })
    @ApiParam({ name: 'id', description: 'ID of the employee' })
    @ApiOkResponseData(EmployeeResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ApiErrorResponse })
    async getEmployeeById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<Employee> {
        const employee = await this.employeeService.getEmployeeById(id, scope);
        if (!employee) {
            throw new NotFoundException('Employee not found.');
        }
        return employee;
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
    @ApiOkResponseData(EmployeeResponseDto)
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ApiErrorResponse })
    async updateEmployee(
        @Param('id') id: string,
        @Body() updateEmployeeDto: UpdateEmployeeDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Employee> {
        return this.employeeService.updateEmployee(
            id,
            updateEmployeeDto,
            scope,
            user.sub
        );
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
    @ApiOkResponseData(EmployeeResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ApiErrorResponse })
    async toggleEmployeeStatus(
        @Param('id') id: string,
        @Body('isActive') isActive: boolean,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Employee> {
        return this.employeeService.toggleEmployeeStatus(
            id,
            isActive,
            scope,
            user.sub
        );
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
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ApiErrorResponse })
    async deleteEmployee(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.employeeService.deleteEmployee(id, scope, user.sub);
    }

    @Post(':id/photo')
    @Permissions(PERMISSIONS.EMPLOYEE.UPDATE_MANAGED)
    @AuditLog({
        action: 'PHOTO_UPLOAD',
        resource: 'employee',
        captureRequest: true,
        captureResponse: true,
    })
    @UseInterceptors(FileInterceptor('photo'))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Upload employee photo' })
    @ApiParam({ name: 'id', description: 'ID of the employee' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                photo: {
                    type: 'string',
                    format: 'binary',
                    description: 'Employee photo file (JPEG, PNG, GIF, WebP, max 5MB)',
                },
            },
            required: ['photo'],
        },
    })
    @ApiOkResponseData(EmployeePhotoUploadResponseDto)
    @ApiResponse({
        status: 400,
        description: 'Invalid file format or size.',
        type: ApiErrorResponse,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ApiErrorResponse })
    async uploadEmployeePhoto(
        @Param('id') id: string,
        @UploadedFile() file: Express.Multer.File,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<{ photoUrl: string }> {
        return this.employeeService.uploadEmployeePhoto(id, file, scope, user.sub);
    }

    @Delete(':id/photo')
    @Permissions(PERMISSIONS.EMPLOYEE.UPDATE_MANAGED)
    @AuditLog({
        action: 'PHOTO_DELETE',
        resource: 'employee',
        captureRequest: true,
    })
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete employee photo' })
    @ApiParam({ name: 'id', description: 'ID of the employee' })
    @ApiResponse({ status: 204, description: 'The employee photo has been successfully deleted.' })
    @ApiResponse({
        status: 400,
        description: 'Employee does not have a photo.',
        type: ApiErrorResponse,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Employee not found.', type: ApiErrorResponse })
    async deleteEmployeePhoto(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.employeeService.deleteEmployeePhoto(id, scope, user.sub);
    }
}
