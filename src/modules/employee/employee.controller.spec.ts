import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../../shared/dto';
import { DataScope, UserContext } from '../../shared/interfaces';

describe('EmployeeController', () => {
    let controller: EmployeeController;
    let employeeService: jest.Mocked<EmployeeService>;

    const mockUserContext: UserContext = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        roles: ['ADMIN'],
        permissions: ['employee:create', 'employee:read:all'],
    };

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
        const mockEmployeeService = {
            createEmployee: jest.fn(),
            getEmployees: jest.fn(),
            getEmployeesByBranch: jest.fn(),
            getEmployeesByDepartment: jest.fn(),
            getEmployeeById: jest.fn(),
            getEmployeeByCode: jest.fn(),
            updateEmployee: jest.fn(),
            deleteEmployee: jest.fn(),
            searchEmployees: jest.fn(),
            getEmployeeCount: jest.fn(),
            getEmployeeCountByBranch: jest.fn(),
            getEmployeeCountByDepartment: jest.fn(),
            toggleEmployeeStatus: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [EmployeeController],
            providers: [
                {
                    provide: EmployeeService,
                    useValue: mockEmployeeService,
                },
            ],
        }).compile();

        controller = module.get<EmployeeController>(EmployeeController);
        employeeService = module.get(EmployeeService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createEmployee', () => {
        it('should create an employee successfully', async () => {
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

            employeeService.createEmployee.mockResolvedValue(mockEmployee);

            const result = await controller.createEmployee(
                createDto,
                mockUserContext,
                mockDataScope
            );

            expect(employeeService.createEmployee).toHaveBeenCalledWith(
                createDto,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result).toEqual({
                id: mockEmployee.id,
                organizationId: mockEmployee.organizationId,
                branchId: mockEmployee.branchId,
                departmentId: mockEmployee.departmentId,
                firstName: mockEmployee.firstName,
                lastName: mockEmployee.lastName,
                employeeCode: mockEmployee.employeeCode,
                email: mockEmployee.email,
                phone: mockEmployee.phone,
                isActive: mockEmployee.isActive,
                createdAt: mockEmployee.createdAt,
                updatedAt: mockEmployee.updatedAt,
            });
        });
    });

    describe('getEmployees', () => {
        it('should return paginated employees', async () => {
            const employees = [mockEmployee];
            employeeService.getEmployees.mockResolvedValue(employees);

            const result = await controller.getEmployees(mockDataScope, { page: 1, limit: 10 });

            expect(employeeService.getEmployees).toHaveBeenCalledWith(mockDataScope);
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
        });
    });

    describe('getEmployeesByBranch', () => {
        it('should return employees for a specific branch', async () => {
            const employees = [mockEmployee];
            employeeService.getEmployeesByBranch.mockResolvedValue(employees);

            const result = await controller.getEmployeesByBranch('branch-123', mockDataScope);

            expect(employeeService.getEmployeesByBranch).toHaveBeenCalledWith(
                'branch-123',
                mockDataScope
            );
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(mockEmployee.id);
        });
    });

    describe('getEmployeesByDepartment', () => {
        it('should return employees for a specific department', async () => {
            const employees = [mockEmployee];
            employeeService.getEmployeesByDepartment.mockResolvedValue(employees);

            const result = await controller.getEmployeesByDepartment('dept-123', mockDataScope);

            expect(employeeService.getEmployeesByDepartment).toHaveBeenCalledWith(
                'dept-123',
                mockDataScope
            );
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(mockEmployee.id);
        });
    });

    describe('getEmployeeById', () => {
        it('should return an employee by ID', async () => {
            employeeService.getEmployeeById.mockResolvedValue(mockEmployee);

            const result = await controller.getEmployeeById('emp-123', mockDataScope);

            expect(employeeService.getEmployeeById).toHaveBeenCalledWith('emp-123', mockDataScope);
            expect(result.id).toBe(mockEmployee.id);
        });

        it('should throw error when employee not found', async () => {
            employeeService.getEmployeeById.mockResolvedValue(null);

            await expect(controller.getEmployeeById('nonexistent', mockDataScope)).rejects.toThrow(
                'Employee not found'
            );
        });
    });

    describe('getEmployeeByCode', () => {
        it('should return an employee by employee code', async () => {
            employeeService.getEmployeeByCode.mockResolvedValue(mockEmployee);

            const result = await controller.getEmployeeByCode('EMP001', mockDataScope);

            expect(employeeService.getEmployeeByCode).toHaveBeenCalledWith('EMP001', mockDataScope);
            expect(result.employeeCode).toBe(mockEmployee.employeeCode);
        });

        it('should throw error when employee not found by code', async () => {
            employeeService.getEmployeeByCode.mockResolvedValue(null);

            await expect(
                controller.getEmployeeByCode('NONEXISTENT', mockDataScope)
            ).rejects.toThrow('Employee not found');
        });
    });

    describe('updateEmployee', () => {
        it('should update an employee successfully', async () => {
            const updateDto: UpdateEmployeeDto = {
                firstName: 'Jane',
                email: 'jane.doe@example.com',
            };

            const updatedEmployee = {
                ...mockEmployee,
                firstName: 'Jane',
                email: 'jane.doe@example.com',
            };
            employeeService.updateEmployee.mockResolvedValue(updatedEmployee);

            const result = await controller.updateEmployee(
                'emp-123',
                updateDto,
                mockUserContext,
                mockDataScope
            );

            expect(employeeService.updateEmployee).toHaveBeenCalledWith(
                'emp-123',
                updateDto,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.firstName).toBe('Jane');
            expect(result.email).toBe('jane.doe@example.com');
        });
    });

    describe('toggleEmployeeStatus', () => {
        it('should toggle employee status successfully', async () => {
            const deactivatedEmployee = { ...mockEmployee, isActive: false };
            employeeService.toggleEmployeeStatus.mockResolvedValue(deactivatedEmployee);

            const result = await controller.toggleEmployeeStatus(
                'emp-123',
                false,
                mockUserContext,
                mockDataScope
            );

            expect(employeeService.toggleEmployeeStatus).toHaveBeenCalledWith(
                'emp-123',
                false,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.isActive).toBe(false);
        });
    });

    describe('deleteEmployee', () => {
        it('should delete an employee successfully', async () => {
            employeeService.deleteEmployee.mockResolvedValue();

            await controller.deleteEmployee('emp-123', mockUserContext, mockDataScope);

            expect(employeeService.deleteEmployee).toHaveBeenCalledWith(
                'emp-123',
                mockDataScope,
                mockUserContext.sub
            );
        });
    });

    describe('searchEmployees', () => {
        it('should return empty array for short search terms', async () => {
            const result = await controller.searchEmployees('a', mockDataScope);

            expect(result).toEqual([]);
            expect(employeeService.searchEmployees).not.toHaveBeenCalled();
        });

        it('should search employees with valid search term', async () => {
            const employees = [mockEmployee];
            employeeService.searchEmployees.mockResolvedValue(employees);

            const result = await controller.searchEmployees('john', mockDataScope);

            expect(employeeService.searchEmployees).toHaveBeenCalledWith('john', mockDataScope);
            expect(result).toHaveLength(1);
        });
    });

    describe('getEmployeeCount', () => {
        it('should return employee count', async () => {
            employeeService.getEmployeeCount.mockResolvedValue(10);

            const result = await controller.getEmployeeCount(mockDataScope);

            expect(employeeService.getEmployeeCount).toHaveBeenCalledWith(mockDataScope);
            expect(result.count).toBe(10);
        });
    });

    describe('getEmployeeCountByBranch', () => {
        it('should return employee count for a branch', async () => {
            employeeService.getEmployeeCountByBranch.mockResolvedValue(5);

            const result = await controller.getEmployeeCountByBranch('branch-123', mockDataScope);

            expect(employeeService.getEmployeeCountByBranch).toHaveBeenCalledWith(
                'branch-123',
                mockDataScope
            );
            expect(result.count).toBe(5);
        });
    });

    describe('getEmployeeCountByDepartment', () => {
        it('should return employee count for a department', async () => {
            employeeService.getEmployeeCountByDepartment.mockResolvedValue(3);

            const result = await controller.getEmployeeCountByDepartment('dept-123', mockDataScope);

            expect(employeeService.getEmployeeCountByDepartment).toHaveBeenCalledWith(
                'dept-123',
                mockDataScope
            );
            expect(result.count).toBe(3);
        });
    });
});
