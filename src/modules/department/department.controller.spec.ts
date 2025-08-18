import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { LoggerService } from '@/core/logger';
import { CreateDepartmentDto, UpdateDepartmentDto } from '@/shared/dto';
import { DataScope, UserContext } from '@/shared/interfaces';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { Department } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('DepartmentController', () => {
    let controller: DepartmentController;
    let departmentService: jest.Mocked<DepartmentService>;

    const mockUserContext: UserContext = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        roles: ['ADMIN'],
        permissions: [PERMISSIONS.DEPARTMENT.CREATE, PERMISSIONS.DEPARTMENT.MANAGE_ALL],
    };

    const mockDataScope: DataScope = {
        organizationId: 'org-123',
        branchIds: ['branch-123'],
    };

    const mockDepartment: Department = {
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

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DepartmentController],
            providers: [
                {
                    provide: DepartmentService,
                    useValue: mockDepartmentService,
                },
                {
                    provide: LoggerService,
                    useValue: {
                        log: jest.fn(),
                        error: jest.fn(),
                        warn: jest.fn(),
                        debug: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get<DepartmentController>(DepartmentController);
        departmentService = module.get(DepartmentService);
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
            expect(result).toEqual(mockDepartment);
        });
    });

    describe('getDepartments', () => {
        it('should return paginated departments', async () => {
            const paginatedResult = {
                data: [mockDepartment],
                total: 1,
                page: 1,
                limit: 10,
                totalPages: 1,
            };
            const paginationDto = { page: 1, limit: 10 };
            departmentService.getDepartments.mockResolvedValue(paginatedResult as any);

            const result = await controller.getDepartments(mockDataScope, paginationDto);

            expect(departmentService.getDepartments).toHaveBeenCalledWith(
                mockDataScope,
                paginationDto
            );
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('getDepartmentById', () => {
        it('should return a department by ID', async () => {
            departmentService.getDepartmentById.mockResolvedValue(mockDepartment);

            const result = await controller.getDepartmentById('dept-123', mockDataScope);

            expect(departmentService.getDepartmentById).toHaveBeenCalledWith(
                'dept-123',
                mockDataScope
            );
            expect(result).toEqual(mockDepartment);
        });

        it('should throw error when department not found', async () => {
            departmentService.getDepartmentById.mockResolvedValue(null);

            await expect(
                controller.getDepartmentById('nonexistent', mockDataScope)
            ).rejects.toThrow(NotFoundException);
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

            departmentService.getDepartmentHierarchy.mockResolvedValue([
                hierarchyDepartment,
            ] as any);

            const result = await controller.getDepartmentHierarchy('branch-123', mockDataScope);

            expect(departmentService.getDepartmentHierarchy).toHaveBeenCalledWith(
                'branch-123',
                mockDataScope
            );
            expect(result).toHaveLength(1);
            expect((result[0] as any).children).toHaveLength(1);
            expect((result[0] as any).children[0].name).toBe('Frontend Team');
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
            expect(result).toEqual(updatedDepartment);
        });
    });

    describe('deleteDepartment', () => {
        it('should delete a department successfully', async () => {
            departmentService.deleteDepartment.mockResolvedValue(undefined);

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
            expect(result[0]).toEqual(mockDepartment);
        });
    });

    describe('getDepartmentCount', () => {
        it('should return department count', async () => {
            departmentService.getDepartmentCount.mockResolvedValue(5);

            const result = await controller.getDepartmentCount(mockDataScope);

            expect(departmentService.getDepartmentCount).toHaveBeenCalledWith(mockDataScope);
            expect(result).toEqual({ count: 5 });
        });
    });
});
