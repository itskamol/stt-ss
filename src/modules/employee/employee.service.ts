import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Employee, Prisma } from '@prisma/client';
import { EmployeeRepository } from './employee.repository';
import { DatabaseUtil } from '@/shared/utils';
import {
    CreateEmployeeDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateEmployeeDto,
} from '@/shared/dto';
import { DataScope } from '@/shared/interfaces';
import { IStorageAdapter } from '@/modules/integrations/adapters/interfaces/storage.adapter';

@Injectable()
export class EmployeeService {
    constructor(
        private readonly employeeRepository: EmployeeRepository,
        @Inject('IStorageAdapter')
        private readonly storageAdapter: IStorageAdapter
    ) {}

    /**
     * Create a new employee
     */
    async createEmployee(
        createEmployeeDto: CreateEmployeeDto,
        scope: DataScope,
        createdByUserId: string
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

            return await this.employeeRepository.create(createEmployeeDto, scope);
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
        scope: DataScope,
        paginationDto: PaginationDto,
        filters: Prisma.EmployeeWhereInput = {}
    ): Promise<PaginationResponseDto<Employee>> {
        const { page, limit } = paginationDto;
        const skip = (page - 1) * limit;

        const [employees, total] = await Promise.all([
            this.employeeRepository.findManyPaginated(filters, scope, page, limit),
            this.employeeRepository.count(filters, scope),
        ]);

        return new PaginationResponseDto(employees, total, page, limit);
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
    async getEmployeeById(id: string, scope: DataScope): Promise<Employee> {
        const employee = await this.employeeRepository.findById(id, scope);
        if (!employee) {
            throw new NotFoundException('Employee not found');
        }
        return employee;
    }

    /**
     * Get employee by employee code
     */
    async getEmployeeByCode(employeeCode: string, scope: DataScope): Promise<Employee> {
        const employee = await this.employeeRepository.findByEmployeeCode(employeeCode, scope);
        if (!employee) {
            throw new NotFoundException('Employee not found');
        }
        return employee;
    }

    /**
     * Update employee
     */
    async updateEmployee(
        id: string,
        updateEmployeeDto: UpdateEmployeeDto,
        scope: DataScope,
        updatedByUserId: string
    ): Promise<Employee> {
        const existingEmployee = await this.getEmployeeById(id, scope);

        try {
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

            return await this.employeeRepository.update(
                id,
                updateEmployeeDto,
                scope
            );
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
        deletedByUserId: string
    ): Promise<void> {
        await this.getEmployeeById(id, scope);
        await this.employeeRepository.delete(id, scope);
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
        updatedByUserId: string
    ): Promise<Employee> {
        await this.getEmployeeById(id, scope);
        return this.employeeRepository.update(id, { isActive }, scope);
    }

    /**
     * Upload employee photo
     */
    async uploadEmployeePhoto(
        employeeId: string,
        file: Express.Multer.File,
        scope: DataScope,
        updatedByUserId: string
    ): Promise<{ photoUrl: string }> {
        const employee = await this.getEmployeeById(employeeId, scope);

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
                // Log and ignore error
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

        return {
            photoUrl: uploadResult.url,
        };
    }

    /**
     * Delete employee photo
     */
    async deleteEmployeePhoto(
        employeeId: string,
        scope: DataScope,
        deletedByUserId: string
    ): Promise<void> {
        const employee = await this.getEmployeeById(employeeId, scope);

        if (!employee.photoKey) {
            throw new BadRequestException('Employee does not have a photo');
        }

        // Delete photo from storage
        await this.storageAdapter.deleteFile(employee.photoKey);

        // Update employee record to remove photo key
        await this.employeeRepository.update(employeeId, { photoKey: null }, scope);
    }
}
