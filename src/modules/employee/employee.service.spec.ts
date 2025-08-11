import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeRepository } from './employee.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';

describe('EmployeeService', () => {
    let service: EmployeeService;
    let employeeRepository: jest.Mocked<EmployeeRepository>;
    let loggerService: jest.Mocked<LoggerService>;

    const mockDataScope: DataScope = {
        organizationId: 'org-123',
        branchIds: ['branch-123'],
    };

    const mockEmployee = {
        id: 'emp-123',
        organizationId: 'org-123',
        branchId: 'branch-123',
        departmentId: 'dept-123',
        firstName: 'John',
        lastName: 'Doe',
        employeeCode: 'EMP001',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const mockEmployeeRepository = {
            create: jest.fn(),
            findById: jest.fn(),
            findByEmployeeCode: jest.fn(),
            findMany: jest.fn(),
            findByBranch: jest.fn(),
            findByDepartment: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
            searchEmployees: jest.fn(),
        };

        const mockLoggerService = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            logUserAction: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EmployeeService,
                {
                    provide: EmployeeRepository,
                    useValue: mockEmployeeRepository,
                },
                {
                    provide: LoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        service = module.get<EmployeeService>(EmployeeService);
        employeeRepository = module.get(EmployeeRepository);
        loggerService = module.get(LoggerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createEmployee', () => {
        const createDto: CreateEmployeeDto = {
            firstName: 'John',
            lastName: 'Doe',
            employeeCode: 'EMP001',
            branchId: 'branch-123',
            departmentId: 'dept-123',
            email: 'john.doe@example.com',
            phone: '+1234567890',
            isActive: true,
        };

        it('should create an employee successfully', async () => {
            employeeRepository.findByEmployeeCode.mockResolvedValue(null);
            employeeRepository.create.mockResolvedValue(mockEmployee);

            const result = await service.createEmployee(createDto, mockDataScope, 'user-123');

            expect(employeeRepository.findByEmployeeCode).toHaveBeenCalledWith(
                'EMP001',
                mockDataScope
            );
            expect(employeeRepository.create).toHaveBeenCalledWith(createDto, mockDataScope);
            expect(loggerService.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'EMPLOYEE_CREATED',
                expect.objectContaining({
                    employeeId: mockEmployee.id,
                    employeeCode: mockEmployee.employeeCode,
                }),
                mockDataScope.organizationId,
                undefined
            );
            expect(result).toEqual(mockEmployee);
        });

        it('should throw BadRequestException for inaccessible branch', async () => {
            const invalidDto = { ...createDto, branchId: 'invalid-branch' };

            await expect(
                service.createEmployee(invalidDto, mockDataScope, 'user-123')
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw ConflictException for duplicate employee code', async () => {
            employeeRepository.findByEmployeeCode.mockResolvedValue(mockEmployee);

            await expect(
                service.createEmployee(createDto, mockDataScope, 'user-123')
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('getEmployeesByBranch', () => {
        it('should return employees for accessible branch', async () => {
            const employees = [mockEmployee];
            employeeRepository.findByBranch.mockResolvedValue(employees);

            const result = await service.getEmployeesByBranch('branch-123', mockDataScope);

            expect(employeeRepository.findByBranch).toHaveBeenCalledWith(
                'branch-123',
                mockDataScope
            );
            expect(result).toEqual(employees);
        });

        it('should throw BadRequestException for inaccessible branch', async () => {
            await expect(
                service.getEmployeesByBranch('invalid-branch', mockDataScope)
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('updateEmployee', () => {
        const updateDto: UpdateEmployeeDto = {
            firstName: 'Jane',
            email: 'jane.doe@example.com',
        };

        it('should update an employee successfully', async () => {
            const updatedEmployee = {
                ...mockEmployee,
                firstName: 'Jane',
                email: 'jane.doe@example.com',
            };

            employeeRepository.findById.mockResolvedValue(mockEmployee);
            employeeRepository.update.mockResolvedValue(updatedEmployee);

            const result = await service.updateEmployee(
                'emp-123',
                updateDto,
                mockDataScope,
                'user-123'
            );

            expect(employeeRepository.findById).toHaveBeenCalledWith('emp-123', mockDataScope);
            expect(employeeRepository.update).toHaveBeenCalledWith(
                'emp-123',
                updateDto,
                mockDataScope
            );
            expect(loggerService.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'EMPLOYEE_UPDATED',
                expect.objectContaining({
                    employeeId: 'emp-123',
                    changes: updateDto,
                }),
                mockDataScope.organizationId,
                undefined
            );
            expect(result).toEqual(updatedEmployee);
        });

        it('should throw NotFoundException when employee not found', async () => {
            employeeRepository.findById.mockResolvedValue(null);

            await expect(
                service.updateEmployee('nonexistent', updateDto, mockDataScope, 'user-123')
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ConflictException for duplicate employee code', async () => {
            const updateWithCode = { ...updateDto, employeeCode: 'EMP002' };
            const existingEmployee = { ...mockEmployee, id: 'emp-456', employeeCode: 'EMP002' };

            employeeRepository.findById.mockResolvedValue(mockEmployee);
            employeeRepository.findByEmployeeCode.mockResolvedValue(existingEmployee);

            await expect(
                service.updateEmployee('emp-123', updateWithCode, mockDataScope, 'user-123')
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('deleteEmployee', () => {
        it('should delete an employee successfully', async () => {
            employeeRepository.findById.mockResolvedValue(mockEmployee);
            employeeRepository.delete.mockResolvedValue();

            await service.deleteEmployee('emp-123', mockDataScope, 'user-123');

            expect(employeeRepository.findById).toHaveBeenCalledWith('emp-123', mockDataScope);
            expect(employeeRepository.delete).toHaveBeenCalledWith('emp-123', mockDataScope);
            expect(loggerService.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'EMPLOYEE_DELETED',
                expect.objectContaining({
                    employeeId: 'emp-123',
                    employeeCode: mockEmployee.employeeCode,
                }),
                mockDataScope.organizationId,
                undefined
            );
        });

        it('should throw NotFoundException when employee not found', async () => {
            employeeRepository.findById.mockResolvedValue(null);

            await expect(
                service.deleteEmployee('nonexistent', mockDataScope, 'user-123')
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('toggleEmployeeStatus', () => {
        it('should activate an employee successfully', async () => {
            const deactivatedEmployee = { ...mockEmployee, isActive: false };
            const activatedEmployee = { ...mockEmployee, isActive: true };

            employeeRepository.findById.mockResolvedValue(deactivatedEmployee);
            employeeRepository.update.mockResolvedValue(activatedEmployee);

            const result = await service.toggleEmployeeStatus(
                'emp-123',
                true,
                mockDataScope,
                'user-123'
            );

            expect(employeeRepository.findById).toHaveBeenCalledWith('emp-123', mockDataScope);
            expect(employeeRepository.update).toHaveBeenCalledWith(
                'emp-123',
                { isActive: true },
                mockDataScope
            );
            expect(loggerService.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'EMPLOYEE_ACTIVATED',
                expect.objectContaining({
                    employeeId: 'emp-123',
                    previousStatus: false,
                    newStatus: true,
                }),
                mockDataScope.organizationId,
                undefined
            );
            expect(result).toEqual(activatedEmployee);
        });

        it('should deactivate an employee successfully', async () => {
            const deactivatedEmployee = { ...mockEmployee, isActive: false };

            employeeRepository.findById.mockResolvedValue(mockEmployee);
            employeeRepository.update.mockResolvedValue(deactivatedEmployee);

            const result = await service.toggleEmployeeStatus(
                'emp-123',
                false,
                mockDataScope,
                'user-123'
            );

            expect(loggerService.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'EMPLOYEE_DEACTIVATED',
                expect.objectContaining({
                    employeeId: 'emp-123',
                    previousStatus: true,
                    newStatus: false,
                }),
                mockDataScope.organizationId,
                undefined
            );
            expect(result).toEqual(deactivatedEmployee);
        });
    });

    describe('searchEmployees', () => {
        it('should return empty array for short search terms', async () => {
            const result = await service.searchEmployees('a', mockDataScope);

            expect(result).toEqual([]);
            expect(employeeRepository.searchEmployees).not.toHaveBeenCalled();
        });

        it('should search employees with valid search term', async () => {
            const employees = [mockEmployee];
            employeeRepository.searchEmployees.mockResolvedValue(employees);

            const result = await service.searchEmployees('john', mockDataScope);

            expect(employeeRepository.searchEmployees).toHaveBeenCalledWith('john', mockDataScope);
            expect(result).toEqual(employees);
        });
    });

    describe('getEmployeeCountByBranch', () => {
        it('should return count for accessible branch', async () => {
            employeeRepository.count.mockResolvedValue(5);

            const result = await service.getEmployeeCountByBranch('branch-123', mockDataScope);

            expect(employeeRepository.count).toHaveBeenCalledWith(
                { branchId: 'branch-123' },
                mockDataScope
            );
            expect(result).toBe(5);
        });

        it('should throw BadRequestException for inaccessible branch', async () => {
            await expect(
                service.getEmployeeCountByBranch('invalid-branch', mockDataScope)
            ).rejects.toThrow(BadRequestException);
        });
    });
});
