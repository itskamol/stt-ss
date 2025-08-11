import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Employee } from '@prisma/client';
import { EmployeeRepository } from './employee.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { DatabaseUtil } from '../../shared/utils';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';

@Injectable()
export class EmployeeService {
    constructor(
        private readonly employeeRepository: EmployeeRepository,
        private readonly logger: LoggerService
    ) {}

    /**
     * Create a new employee
     */
    async createEmployee(
        createEmployeeDto: CreateEmployeeDto,
        scope: DataScope,
        createdByUserId: string,
        correlationId?: string
    ): Promise<Employee> {
        try {
            // Validate that the branch is accessible within the scope
            if (scope.branchIds && !scope.branchIds.includes(createEmployeeDto.branchId)) {
                throw new BadRequestException('Branch not accessible within your scope');
            }

            // Check if employee code is unique within the organization
            const existingEmployee = await this.employeeRepository.findByEmployeeCode(
                createEmployeeDto.employeeCode,
                scope
            );

            if (existingEmployee) {
                throw new ConflictException('Employee code already exists in this organization');
            }

            const employee = await this.employeeRepository.create(createEmployeeDto, scope);

            this.logger.logUserAction(
                createdByUserId,
                'EMPLOYEE_CREATED',
                {
                    employeeId: employee.id,
                    employeeCode: employee.employeeCode,
                    fullName: `${employee.firstName} ${employee.lastName}`,
                    branchId: employee.branchId,
                    departmentId: employee.departmentId,
                },
                scope.organizationId,
                correlationId
            );

            return employee;
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                const fields = DatabaseUtil.getUniqueConstraintFields(error);
                throw new ConflictException(
                    `Employee with this ${fields.join(', ')} already exists`
                );
            }
            throw error;
        }
    }

    /**
     * Get all employees (scoped to managed branches)
     */
    async getEmployees(scope: DataScope): Promise<Employee[]> {
        return this.employeeRepository.findMany({}, scope);
    }

    /**
     * Get employees by branch
     */
    async getEmployeesByBranch(branchId: string, scope: DataScope): Promise<Employee[]> {
        // Validate branch access
        if (scope.branchIds && !scope.branchIds.includes(branchId)) {
            throw new BadRequestException('Branch not accessible within your scope');
        }

        return this.employeeRepository.findByBranch(branchId, scope);
    }

    /**
     * Get employees by department
     */
    async getEmployeesByDepartment(departmentId: string, scope: DataScope): Promise<Employee[]> {
        return this.employeeRepository.findByDepartment(departmentId, scope);
    }

    /**
     * Get employee by ID
     */
    async getEmployeeById(id: string, scope: DataScope): Promise<Employee | null> {
        return this.employeeRepository.findById(id, scope);
    }

    /**
     * Get employee by employee code
     */
    async getEmployeeByCode(employeeCode: string, scope: DataScope): Promise<Employee | null> {
        return this.employeeRepository.findByEmployeeCode(employeeCode, scope);
    }

    /**
     * Update employee
     */
    async updateEmployee(
        id: string,
        updateEmployeeDto: UpdateEmployeeDto,
        scope: DataScope,
        updatedByUserId: string,
        correlationId?: string
    ): Promise<Employee> {
        try {
            const existingEmployee = await this.employeeRepository.findById(id, scope);
            if (!existingEmployee) {
                throw new NotFoundException('Employee not found');
            }

            // Validate branch access if changing branch
            if (
                updateEmployeeDto.branchId &&
                scope.branchIds &&
                !scope.branchIds.includes(updateEmployeeDto.branchId)
            ) {
                throw new BadRequestException('Target branch not accessible within your scope');
            }

            // Check employee code uniqueness if being updated
            if (
                updateEmployeeDto.employeeCode &&
                updateEmployeeDto.employeeCode !== existingEmployee.employeeCode
            ) {
                const existingByCode = await this.employeeRepository.findByEmployeeCode(
                    updateEmployeeDto.employeeCode,
                    scope
                );

                if (existingByCode && existingByCode.id !== id) {
                    throw new ConflictException(
                        'Employee code already exists in this organization'
                    );
                }
            }

            const updatedEmployee = await this.employeeRepository.update(
                id,
                updateEmployeeDto,
                scope
            );

            this.logger.logUserAction(
                updatedByUserId,
                'EMPLOYEE_UPDATED',
                {
                    employeeId: id,
                    changes: updateEmployeeDto,
                    oldEmployeeCode: existingEmployee.employeeCode,
                    newEmployeeCode: updatedEmployee.employeeCode,
                    oldFullName: `${existingEmployee.firstName} ${existingEmployee.lastName}`,
                    newFullName: `${updatedEmployee.firstName} ${updatedEmployee.lastName}`,
                },
                scope.organizationId,
                correlationId
            );

            return updatedEmployee;
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                const fields = DatabaseUtil.getUniqueConstraintFields(error);
                throw new ConflictException(
                    `Employee with this ${fields.join(', ')} already exists`
                );
            }
            throw error;
        }
    }

    /**
     * Delete employee
     */
    async deleteEmployee(
        id: string,
        scope: DataScope,
        deletedByUserId: string,
        correlationId?: string
    ): Promise<void> {
        const existingEmployee = await this.employeeRepository.findById(id, scope);
        if (!existingEmployee) {
            throw new NotFoundException('Employee not found');
        }

        await this.employeeRepository.delete(id, scope);

        this.logger.logUserAction(
            deletedByUserId,
            'EMPLOYEE_DELETED',
            {
                employeeId: id,
                employeeCode: existingEmployee.employeeCode,
                fullName: `${existingEmployee.firstName} ${existingEmployee.lastName}`,
                branchId: existingEmployee.branchId,
            },
            scope.organizationId,
            correlationId
        );
    }

    /**
     * Search employees
     */
    async searchEmployees(searchTerm: string, scope: DataScope): Promise<Employee[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        return this.employeeRepository.searchEmployees(searchTerm.trim(), scope);
    }

    /**
     * Get employee count
     */
    async getEmployeeCount(scope: DataScope): Promise<number> {
        return this.employeeRepository.count({}, scope);
    }

    /**
     * Get employee count by branch
     */
    async getEmployeeCountByBranch(branchId: string, scope: DataScope): Promise<number> {
        // Validate branch access
        if (scope.branchIds && !scope.branchIds.includes(branchId)) {
            throw new BadRequestException('Branch not accessible within your scope');
        }

        return this.employeeRepository.count({ branchId }, scope);
    }

    /**
     * Get employee count by department
     */
    async getEmployeeCountByDepartment(departmentId: string, scope: DataScope): Promise<number> {
        return this.employeeRepository.count({ departmentId }, scope);
    }

    /**
     * Activate/Deactivate employee
     */
    async toggleEmployeeStatus(
        id: string,
        isActive: boolean,
        scope: DataScope,
        updatedByUserId: string,
        correlationId?: string
    ): Promise<Employee> {
        const existingEmployee = await this.employeeRepository.findById(id, scope);
        if (!existingEmployee) {
            throw new NotFoundException('Employee not found');
        }

        const updatedEmployee = await this.employeeRepository.update(id, { isActive }, scope);

        this.logger.logUserAction(
            updatedByUserId,
            isActive ? 'EMPLOYEE_ACTIVATED' : 'EMPLOYEE_DEACTIVATED',
            {
                employeeId: id,
                employeeCode: existingEmployee.employeeCode,
                fullName: `${existingEmployee.firstName} ${existingEmployee.lastName}`,
                previousStatus: existingEmployee.isActive,
                newStatus: isActive,
            },
            scope.organizationId,
            correlationId
        );

        return updatedEmployee;
    }
}
