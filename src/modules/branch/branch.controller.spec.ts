import { Test, TestingModule } from '@nestjs/testing';
import { BranchController } from './branch.controller';
import { BranchService } from './branch.service';
import { LoggerService } from '@/core/logger';
import { CreateBranchDto, UpdateBranchDto } from '@/shared/dto';
import { DataScope, UserContext } from '@/shared/interfaces';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { Branch, ManagedBranch } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('BranchController', () => {
    let controller: BranchController;
    let branchService: jest.Mocked<BranchService>;

    const mockUserContext: UserContext = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        roles: ['ADMIN'],
        permissions: [
            PERMISSIONS.BRANCH.CREATE,
            PERMISSIONS.BRANCH.READ_ALL,
            PERMISSIONS.BRANCH.UPDATE_MANAGED,
            PERMISSIONS.USER.MANAGE_ORG,
        ],
    };

    const mockDataScope: DataScope = {
        organizationId: 'org-123',
        branchIds: ['branch-123'],
    };

    const mockBranch: Branch = {
        id: 'branch-123',
        organizationId: 'org-123',
        name: 'Main Branch',
        address: '123 Main St',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockManagedBranch: ManagedBranch & { manager: any } = {
        id: 'managed-123',
        managerId: 'user-123',
        branchId: 'branch-123',
        assignedAt: new Date(),
        manager: {
            id: 'org-user-123',
            createdAt: new Date(),
            userId: 'user-123',
            organizationId: 'org-123',
            role: 'BRANCH_MANAGER' as any,
            user: {
                id: 'user-123',
                email: 'manager@example.com',
                passwordHash: 'hashed',
                fullName: 'John Manager',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        },
    };

    beforeEach(async () => {
        const mockBranchService = {
            createBranch: jest.fn(),
            getBranches: jest.fn(),
            getBranchById: jest.fn(),
            updateBranch: jest.fn(),
            deleteBranch: jest.fn(),
            getBranchWithStats: jest.fn(),
            assignBranchManager: jest.fn(),
            removeBranchManager: jest.fn(),
            getBranchManagers: jest.fn(),
            searchBranches: jest.fn(),
            getBranchCount: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [BranchController],
            providers: [
                {
                    provide: BranchService,
                    useValue: mockBranchService,
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

        controller = module.get<BranchController>(BranchController);
        branchService = module.get(BranchService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createBranch', () => {
        it('should create a branch successfully', async () => {
            const createDto: CreateBranchDto = {
                name: 'New Branch',
                address: '456 New St',
            };

            branchService.createBranch.mockResolvedValue(mockBranch);

            const result = await controller.createBranch(createDto, mockUserContext, mockDataScope);

            expect(branchService.createBranch).toHaveBeenCalledWith(
                createDto,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result).toEqual(mockBranch);
        });
    });

    describe('getBranches', () => {
        it('should return paginated branches', async () => {
            const paginatedResult = {
                data: [mockBranch],
                total: 1,
                page: 1,
                limit: 10,
                totalPages: 1,
            };
            const paginationDto = { page: 1, limit: 10 };
            branchService.getBranches.mockResolvedValue(paginatedResult as any);

            const result = await controller.getBranches(mockDataScope, paginationDto);

            expect(branchService.getBranches).toHaveBeenCalledWith(mockDataScope, paginationDto);
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('getBranchById', () => {
        it('should return a branch by ID', async () => {
            branchService.getBranchById.mockResolvedValue(mockBranch);

            const result = await controller.getBranchById('branch-123', mockDataScope);

            expect(branchService.getBranchById).toHaveBeenCalledWith('branch-123', mockDataScope);
            expect(result).toEqual(mockBranch);
        });

        it('should throw error when branch not found', async () => {
            branchService.getBranchById.mockResolvedValue(null);

            await expect(
                controller.getBranchById('nonexistent', mockDataScope)
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('updateBranch', () => {
        it('should update a branch successfully', async () => {
            const updateDto: UpdateBranchDto = {
                name: 'Updated Branch',
            };

            const updatedBranch = { ...mockBranch, name: 'Updated Branch' };
            branchService.updateBranch.mockResolvedValue(updatedBranch);

            const result = await controller.updateBranch(
                'branch-123',
                updateDto,
                mockUserContext,
                mockDataScope
            );

            expect(branchService.updateBranch).toHaveBeenCalledWith(
                'branch-123',
                updateDto,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result).toEqual(updatedBranch);
        });
    });

    describe('deleteBranch', () => {
        it('should delete a branch successfully', async () => {
            branchService.deleteBranch.mockResolvedValue(undefined);

            await controller.deleteBranch('branch-123', mockUserContext, mockDataScope);

            expect(branchService.deleteBranch).toHaveBeenCalledWith(
                'branch-123',
                mockDataScope,
                mockUserContext.sub
            );
        });
    });

    describe('assignBranchManager', () => {
        it('should assign a branch manager successfully', async () => {
            const assignDto = {
                managerId: 'user-123',
            };

            branchService.assignBranchManager.mockResolvedValue(mockManagedBranch);

            const result = await controller.assignBranchManager(
                'branch-123',
                assignDto,
                mockUserContext
            );

            expect(branchService.assignBranchManager).toHaveBeenCalledWith(
                { ...assignDto, branchId: 'branch-123' },
                mockUserContext.sub
            );
            expect(result).toEqual(mockManagedBranch);
        });
    });

    describe('removeBranchManager', () => {
        it('should remove a branch manager successfully', async () => {
            branchService.removeBranchManager.mockResolvedValue(undefined);

            await controller.removeBranchManager('branch-123', 'user-123', mockUserContext);

            expect(branchService.removeBranchManager).toHaveBeenCalledWith(
                'user-123',
                'branch-123',
                mockUserContext.sub
            );
        });
    });

    describe('getBranchManagers', () => {
        it('should return branch managers', async () => {
            branchService.getBranchManagers.mockResolvedValue([mockManagedBranch]);

            const result = await controller.getBranchManagers('branch-123', mockDataScope);

            expect(branchService.getBranchManagers).toHaveBeenCalledWith(
                'branch-123',
                mockDataScope
            );
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(mockManagedBranch);
        });
    });

    describe('searchBranches', () => {
        it('should return empty array for short search terms', async () => {
            const result = await controller.searchBranches('a', mockDataScope);

            expect(result).toEqual([]);
            expect(branchService.searchBranches).not.toHaveBeenCalled();
        });

        it('should search branches with valid search term', async () => {
            const branches = [mockBranch];
            branchService.searchBranches.mockResolvedValue(branches);

            const result = await controller.searchBranches('main', mockDataScope);

            expect(branchService.searchBranches).toHaveBeenCalledWith('main', mockDataScope);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(mockBranch);
        });
    });

    describe('getBranchCount', () => {
        it('should return branch count', async () => {
            branchService.getBranchCount.mockResolvedValue(3);

            const result = await controller.getBranchCount(mockDataScope);

            expect(branchService.getBranchCount).toHaveBeenCalledWith(mockDataScope);
            expect(result).toEqual({ count: 3 });
        });
    });

    describe('getBranchWithStats', () => {
        it('should return branch with statistics', async () => {
            const branchWithStats: any = {
                ...mockBranch,
                statistics: {
                    totalEmployees: 25,
                    totalDevices: 3,
                },
            };

            branchService.getBranchWithStats.mockResolvedValue(branchWithStats);

            const result = await controller.getBranchWithStats('branch-123', mockDataScope);

            expect(branchService.getBranchWithStats).toHaveBeenCalledWith(
                'branch-123',
                mockDataScope
            );
            expect(result.statistics.totalEmployees).toBe(25);
        });
    });
});
