import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { LoggerService } from '../../core/logger/logger.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../../shared/dto';
import { DataScope, UserContext } from '../../shared/interfaces';

describe('OrganizationController', () => {
    let controller: OrganizationController;
    let organizationService: OrganizationService;
    let logger: LoggerService;

    const mockOrganizationService = {
        createOrganization: jest.fn(),
        getAllOrganizations: jest.fn(),
        getOrganizationById: jest.fn(),
        updateOrganization: jest.fn(),
        deleteOrganization: jest.fn(),
        getOrganizationWithStats: jest.fn(),
        searchOrganizations: jest.fn(),
        getOrganizationCount: jest.fn(),
    };

    const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    };

    const mockUser: UserContext = {
        sub: 'user-123',
        email: 'admin@example.com',
        organizationId: 'org-456',
        branchIds: [],
        roles: ['SUPER_ADMIN'],
        permissions: ['organization:create', 'organization:read:all'],
    };

    const mockScope: DataScope = {
        organizationId: 'org-456',
        branchIds: [],
    };

    const mockOrganization = {
        id: 'org-123',
        name: 'Test Organization',
        description: 'Test Description',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [OrganizationController],
            providers: [
                {
                    provide: OrganizationService,
                    useValue: mockOrganizationService,
                },
                {
                    provide: LoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        controller = module.get<OrganizationController>(OrganizationController);
        organizationService = module.get<OrganizationService>(OrganizationService);
        logger = module.get<LoggerService>(LoggerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createOrganization', () => {
        it('should create a new organization', async () => {
            const createOrganizationDto: CreateOrganizationDto = {
                name: 'New Organization',
                description: 'New Description',
            };

            mockOrganizationService.createOrganization.mockResolvedValue(mockOrganization);

            const result = await controller.createOrganization(createOrganizationDto, mockUser);

            expect(mockOrganizationService.createOrganization).toHaveBeenCalledWith(
                createOrganizationDto,
                'user-123'
            );
            expect(result).toEqual({
                id: mockOrganization.id,
                name: mockOrganization.name,
                description: mockOrganization.description,
                createdAt: mockOrganization.createdAt,
                updatedAt: mockOrganization.updatedAt,
            });
        });
    });

    describe('getAllOrganizations', () => {
        it('should return paginated organizations', async () => {
            const organizations = [mockOrganization];
            mockOrganizationService.getAllOrganizations.mockResolvedValue(organizations);

            const result = await controller.getAllOrganizations({ page: 1, limit: 10 });

            expect(mockOrganizationService.getAllOrganizations).toHaveBeenCalled();
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
            expect(result.data[0]).toEqual({
                id: mockOrganization.id,
                name: mockOrganization.name,
                description: mockOrganization.description,
                createdAt: mockOrganization.createdAt,
                updatedAt: mockOrganization.updatedAt,
            });
        });
    });

    describe('searchOrganizations', () => {
        it('should search organizations by term', async () => {
            const organizations = [mockOrganization];
            mockOrganizationService.searchOrganizations.mockResolvedValue(organizations);

            const result = await controller.searchOrganizations('test');

            expect(mockOrganizationService.searchOrganizations).toHaveBeenCalledWith('test');
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: mockOrganization.id,
                name: mockOrganization.name,
                description: mockOrganization.description,
                createdAt: mockOrganization.createdAt,
                updatedAt: mockOrganization.updatedAt,
            });
        });

        it('should return empty array for short search term', async () => {
            const result = await controller.searchOrganizations('a');

            expect(mockOrganizationService.searchOrganizations).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });

        it('should return empty array for empty search term', async () => {
            const result = await controller.searchOrganizations('');

            expect(mockOrganizationService.searchOrganizations).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });
    });

    describe('getOrganizationCount', () => {
        it('should return organization count', async () => {
            mockOrganizationService.getOrganizationCount.mockResolvedValue(5);

            const result = await controller.getOrganizationCount();

            expect(mockOrganizationService.getOrganizationCount).toHaveBeenCalled();
            expect(result).toEqual({ count: 5 });
        });
    });

    describe('getCurrentOrganization', () => {
        it('should return current organization', async () => {
            mockOrganizationService.getOrganizationById.mockResolvedValue(mockOrganization);

            const result = await controller.getCurrentOrganization(mockScope);

            expect(mockOrganizationService.getOrganizationById).toHaveBeenCalledWith('org-456');
            expect(result).toEqual({
                id: mockOrganization.id,
                name: mockOrganization.name,
                description: mockOrganization.description,
                createdAt: mockOrganization.createdAt,
                updatedAt: mockOrganization.updatedAt,
            });
        });

        it('should throw error when organization not found', async () => {
            mockOrganizationService.getOrganizationById.mockResolvedValue(null);

            await expect(controller.getCurrentOrganization(mockScope)).rejects.toThrow(
                'Organization not found'
            );
        });
    });

    describe('getCurrentOrganizationWithStats', () => {
        it('should return current organization with statistics', async () => {
            const organizationWithStats = {
                id: 'org-456',
                name: 'Test Organization',
                description: 'Test Description',
                createdAt: new Date(),
                updatedAt: new Date(),
                statistics: {
                    totalUsers: 5,
                    totalBranches: 3,
                    totalEmployees: 25,
                    totalDevices: 10,
                },
            };

            mockOrganizationService.getOrganizationWithStats.mockResolvedValue(
                organizationWithStats
            );

            const result = await controller.getCurrentOrganizationWithStats(mockScope);

            expect(mockOrganizationService.getOrganizationWithStats).toHaveBeenCalledWith(
                'org-456'
            );
            expect(result).toEqual(organizationWithStats);
        });
    });

    describe('getOrganizationById', () => {
        it('should return organization by id', async () => {
            mockOrganizationService.getOrganizationById.mockResolvedValue(mockOrganization);

            const result = await controller.getOrganizationById('org-123');

            expect(mockOrganizationService.getOrganizationById).toHaveBeenCalledWith('org-123');
            expect(result).toEqual({
                id: mockOrganization.id,
                name: mockOrganization.name,
                description: mockOrganization.description,
                createdAt: mockOrganization.createdAt,
                updatedAt: mockOrganization.updatedAt,
            });
        });

        it('should throw error when organization not found', async () => {
            mockOrganizationService.getOrganizationById.mockResolvedValue(null);

            await expect(controller.getOrganizationById('nonexistent')).rejects.toThrow(
                'Organization not found'
            );
        });
    });

    describe('getOrganizationWithStats', () => {
        it('should return organization with statistics', async () => {
            const organizationWithStats = {
                id: 'org-123',
                name: 'Test Organization',
                description: 'Test Description',
                createdAt: new Date(),
                updatedAt: new Date(),
                statistics: {
                    totalUsers: 5,
                    totalBranches: 3,
                    totalEmployees: 25,
                    totalDevices: 10,
                },
            };

            mockOrganizationService.getOrganizationWithStats.mockResolvedValue(
                organizationWithStats
            );

            const result = await controller.getOrganizationWithStats('org-123');

            expect(mockOrganizationService.getOrganizationWithStats).toHaveBeenCalledWith(
                'org-123'
            );
            expect(result).toEqual(organizationWithStats);
        });
    });

    describe('updateCurrentOrganization', () => {
        it('should update current organization', async () => {
            const updateOrganizationDto: UpdateOrganizationDto = {
                name: 'Updated Organization',
                description: 'Updated Description',
            };

            const updatedOrganization = { ...mockOrganization, ...updateOrganizationDto };
            mockOrganizationService.updateOrganization.mockResolvedValue(updatedOrganization);

            const result = await controller.updateCurrentOrganization(
                updateOrganizationDto,
                mockUser,
                mockScope
            );

            expect(mockOrganizationService.updateOrganization).toHaveBeenCalledWith(
                'org-456',
                updateOrganizationDto,
                'user-123'
            );
            expect(result).toEqual({
                id: updatedOrganization.id,
                name: updatedOrganization.name,
                description: updatedOrganization.description,
                createdAt: updatedOrganization.createdAt,
                updatedAt: updatedOrganization.updatedAt,
            });
        });
    });

    describe('updateOrganization', () => {
        it('should update organization by id', async () => {
            const updateOrganizationDto: UpdateOrganizationDto = {
                name: 'Updated Organization',
                description: 'Updated Description',
            };

            const updatedOrganization = { ...mockOrganization, ...updateOrganizationDto };
            mockOrganizationService.updateOrganization.mockResolvedValue(updatedOrganization);

            const result = await controller.updateOrganization(
                'org-123',
                updateOrganizationDto,
                mockUser
            );

            expect(mockOrganizationService.updateOrganization).toHaveBeenCalledWith(
                'org-123',
                updateOrganizationDto,
                'user-123'
            );
            expect(result).toEqual({
                id: updatedOrganization.id,
                name: updatedOrganization.name,
                description: updatedOrganization.description,
                createdAt: updatedOrganization.createdAt,
                updatedAt: updatedOrganization.updatedAt,
            });
        });
    });

    describe('deleteOrganization', () => {
        it('should delete organization', async () => {
            mockOrganizationService.deleteOrganization.mockResolvedValue(undefined);

            await controller.deleteOrganization('org-123', mockUser);

            expect(mockOrganizationService.deleteOrganization).toHaveBeenCalledWith(
                'org-123',
                'user-123'
            );
        });
    });
});
