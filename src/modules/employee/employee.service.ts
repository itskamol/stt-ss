import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Employee, Prisma } from '@prisma/client';
import { EmployeeRepository } from './employee.repository';
import { LoggerService } from '@/core/logger';
import { DatabaseUtil } from '@/shared/utils';
import {
    CreateEmployeeDto,
    EmployeeResponseDto,
    PaginationResponseDto,
    UpdateEmployeeDto,
} from '@/shared/dto';
import { DataScope } from '@/shared/interfaces';
import { IStorageAdapter } from '@/modules/integrations/adapters/interfaces/storage.adapter';
import { PaginationService } from '@/shared/services/pagination.service';

@Injectable()
export class EmployeeService {
    constructor(
        private readonly employeeRepository: EmployeeRepository,
        private readonly logger: LoggerService,
        private readonly paginationService: PaginationService,
        @Inject('IStorageAdapter')
        private readonly storageAdapter: IStorageAdapter
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

            this.logger.logUserAction(createdByUserId, 'EMPLOYEE_CREATED', {
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                fullName: `${employee.firstName} ${employee.lastName}`,
                branchId: employee.branchId,
                departmentId: employee.departmentId,
                correlationId,
                organizationId: scope.organizationId,
            });

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
    async getEmployees(filters: Prisma.EmployeeWhereInput, scope: DataScope): Promise<Employee[]> {
        return this.employeeRepository.findMany(filters, scope);
    }

    async getPaginatedEmployees(
        filters: Prisma.EmployeeWhereInput,
        scope: DataScope,
        page: number = 1,
        limit: number = 10
    ): Promise<PaginationResponseDto<EmployeeResponseDto>> {
        return this.paginationService.paginate<Employee, EmployeeResponseDto>(
            this.employeeRepository.findManyPaginated(filters, scope, page, limit),
            this.employeeRepository.count(filters, scope),
            page,
            limit,
            EmployeeResponseDto
        );
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

            this.logger.logUserAction(updatedByUserId, 'EMPLOYEE_UPDATED', {
                employeeId: id,
                changes: updateEmployeeDto,
                oldEmployeeCode: existingEmployee.employeeCode,
                newEmployeeCode: updatedEmployee.employeeCode,
                oldFullName: `${existingEmployee.firstName} ${existingEmployee.lastName}`,
                newFullName: `${updatedEmployee.firstName} ${updatedEmployee.lastName}`,
                correlationId,
                organizationId: scope.organizationId,
            });

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

        this.logger.logUserAction(deletedByUserId, 'EMPLOYEE_DELETED', {
            employeeId: id,
            employeeCode: existingEmployee.employeeCode,
            fullName: `${existingEmployee.firstName} ${existingEmployee.lastName}`,
            branchId: existingEmployee.branchId,
            correlationId,
            organizationId: scope.organizationId,
        });
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
                correlationId,
                organizationId: scope.organizationId,
            }
        );

        return updatedEmployee;
    }

    /**
     * Upload employee photo
     */
    async uploadEmployeePhoto(
        employeeId: string,
        file: Express.Multer.File,
        scope: DataScope,
        updatedByUserId: string,
        correlationId?: string
    ): Promise<{ photoUrl: string; photoKey: string; fileSize: number }> {
        const employee = await this.employeeRepository.findById(employeeId, scope);
        if (!employee) {
            throw new NotFoundException('Employee not found');
        }
        console.log(file);
        // Validate file type (only allow images)
        const allowedMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException('Only image files are allowed (JPEG, PNG, GIF, WebP)');
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            throw new BadRequestException('File size must be less than 5MB');
        }

        // Generate a unique key for the photo
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
        const photoKey = `employees/${employee.organizationId}/${employeeId}/photo.${fileExtension}`;

        // Delete existing photo if it exists
        if (employee.photoKey) {
            try {
                await this.storageAdapter.deleteFile(employee.photoKey);
            } catch (error) {
                this.logger.warn('Failed to delete existing employee photo', {
                    employeeId,
                    photoKey: employee.photoKey,
                    error: error.message,
                    correlationId,
                });
            }
        }

        // Upload the new photo
        const uploadResult = await this.storageAdapter.uploadFile(
            photoKey,
            file.buffer,
            file.mimetype
        );

        // Update employee record with photo key
        await this.employeeRepository.update(employeeId, { photoKey }, scope);

        this.logger.logUserAction(updatedByUserId, 'EMPLOYEE_PHOTO_UPLOADED', {
            employeeId,
            photoKey,
            fileSize: file.size,
            mimeType: file.mimetype,
            correlationId,
            organizationId: scope.organizationId,
        });

        return {
            photoUrl: uploadResult.url,
            photoKey: uploadResult.key,
            fileSize: uploadResult.size || file.size,
        };
    }

    /**
     * Delete employee photo
     */
    async deleteEmployeePhoto(
        employeeId: string,
        scope: DataScope,
        deletedByUserId: string,
        correlationId?: string
    ): Promise<void> {
        const employee = await this.employeeRepository.findById(employeeId, scope);
        if (!employee) {
            throw new NotFoundException('Employee not found');
        }

        if (!employee.photoKey) {
            throw new BadRequestException('Employee does not have a photo');
        }

        // Delete photo from storage
        await this.storageAdapter.deleteFile(employee.photoKey);

        // Update employee record to remove photo key
        await this.employeeRepository.update(employeeId, { photoKey: null }, scope);

        this.logger.logUserAction(deletedByUserId, 'EMPLOYEE_PHOTO_DELETED', {
            employeeId,
            photoKey: employee.photoKey,
            correlationId,
            organizationId: scope.organizationId,
        });
    }
}
