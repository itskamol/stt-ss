import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { LoggerService } from '../../core/logger/logger.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from '../../shared/dto';
import { DataScope, UserContext } from '../../shared/interfaces';

describe('DepartmentController', () => {
    let controller: DepartmentController;
    let departmentService: jest.Mocked<DepartmentService>;
    let loggerService: jest.Mocked<LoggerService>;

    const mockUserContext: UserContext = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        roles: ['ADMIN'],
        permissions: ['department:create', 'department:read:all'],
    };

    const mockDataScope: DataScope = {
        organizationId: 'org-123',
        branchIds: ['branch-123'],
    };

    const mockDepartment = {
        id: 'dept-123',
        branchId: 'branch-123',
        name: 'Engineering',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const mockDepartmentService = {
            createDepartment: jest.fn(),
            getDepartments: jest.fn(),
            getDepartmentsByBranch: jest.fn(),
            getDepartmentHierarchy: jest.fn(),
            getDepartmentById: jest.fn(),
            updateDepartment: jest.fn(),
            deleteDepartment: jest.fn(),
            getDepartmentWithStats: jest.fn(),
            searchDepartments: jest.fn(),
            getDepartmentCount: jest.fn(),
        };

        const mockLoggerService = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            logUserAction: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DepartmentController],
            providers: [
                {
                    provide: DepartmentService,
                    useValue: mockDepartmentService,
                },
                {
                    provide: LoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        controller = module.get<DepartmentController>(DepartmentController);
        departmentService = module.get(DepartmentService);
        loggerService = module.get(LoggerService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createDepartment', () => {
        it('should create a department successfully', async () => {
            const createDto: CreateDepartmentDto = {
                name: 'Engineering',
                branchId: 'branch-123',
            };

            departmentService.createDepartment.mockResolvedValue(mockDepartment);

            const result = await controller.createDepartment(
                createDto,
                mockUserContext,
                mockDataScope
            );

            expect(departmentService.createDepartment).toHaveBeenCalledWith(
                createDto,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result).toEqual({
                id: mockDepartment.id,
                branchId: mockDepartment.branchId,
                name: mockDepartment.name,
                parentId: mockDepartment.parentId,
                createdAt: mockDepartment.createdAt,
                updatedAt: mockDepartment.updatedAt,
            });
        });
    });

    describe('getDepartments', () => {
        it('should return paginated departments', async () => {
            const departments = [mockDepartment];
            departmentService.getDepartments.mockResolvedValue(departments);

            const result = await controller.getDepartments(mockDataScope, { page: 1, limit: 10 });

            expect(departmentService.getDepartments).toHaveBeenCalledWith(mockDataScope);
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
        });
    });

    describe('getDepartmentsByBranch', () => {
        it('should return departments for a specific branch', async () => {
            const departments = [mockDepartment];
            departmentService.getDepartmentsByBranch.mockResolvedValue(departments);

            const result = await controller.getDepartmentsByBranch('branch-123', mockDataScope);

            expect(departmentService.getDepartmentsByBranch).toHaveBeenCalledWith(
                'branch-123',
                mockDataScope
            );
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(mockDepartment.id);
        });
    });

    describe('getDepartmentHierarchy', () => {
        it('should return department hierarchy for a branch', async () => {
            const hierarchyDepartment = {
                ...mockDepartment,
                children: [
                    {
                        id: 'dept-child-123',
                        branchId: 'branch-123',
                        name: 'Frontend Team',
                        parentId: 'dept-123',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        children: [],
                    },
                ],
            };

            departmentService.getDepartmentHierarchy.mockResolvedValue([hierarchyDepartment]);

            const result = await controller.getDepartmentHierarchy('branch-123', mockDataScope);

            expect(departmentService.getDepartmentHierarchy).toHaveBeenCalledWith(
                'branch-123',
                mockDataScope
            );
            expect(result).toHaveLength(1);
            expect(result[0].children).toHaveLength(1);
        });
    });

    describe('updateDepartment', () => {
        it('should update a department successfully', async () => {
            const updateDto: UpdateDepartmentDto = {
                name: 'Updated Engineering',
            };

            const updatedDepartment = { ...mockDepartment, name: 'Updated Engineering' };
            departmentService.updateDepartment.mockResolvedValue(updatedDepartment);

            const result = await controller.updateDepartment(
                'dept-123',
                updateDto,
                mockUserContext,
                mockDataScope
            );

            expect(departmentService.updateDepartment).toHaveBeenCalledWith(
                'dept-123',
                updateDto,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.name).toBe('Updated Engineering');
        });
    });

    describe('deleteDepartment', () => {
        it('should delete a department successfully', async () => {
            departmentService.deleteDepartment.mockResolvedValue();

            await controller.deleteDepartment('dept-123', mockUserContext, mockDataScope);

            expect(departmentService.deleteDepartment).toHaveBeenCalledWith(
                'dept-123',
                mockDataScope,
                mockUserContext.sub
            );
        });
    });

    describe('searchDepartments', () => {
        it('should return empty array for short search terms', async () => {
            const result = await controller.searchDepartments('a', mockDataScope);

            expect(result).toEqual([]);
            expect(departmentService.searchDepartments).not.toHaveBeenCalled();
        });

        it('should search departments with valid search term', async () => {
            const departments = [mockDepartment];
            departmentService.searchDepartments.mockResolvedValue(departments);

            const result = await controller.searchDepartments('eng', mockDataScope);

            expect(departmentService.searchDepartments).toHaveBeenCalledWith('eng', mockDataScope);
            expect(result).toHaveLength(1);
        });
    });

    describe('getDepartmentCount', () => {
        it('should return department count', async () => {
            departmentService.getDepartmentCount.mockResolvedValue(5);

            const result = await controller.getDepartmentCount(mockDataScope);

            expect(departmentService.getDepartmentCount).toHaveBeenCalledWith(mockDataScope);
            expect(result.count).toBe(5);
        });
    });
});
