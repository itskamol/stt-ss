import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationRepository } from './organization.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../../shared/dto';
import { DatabaseUtil } from '../../shared/utils';

// Mock the utility functions
jest.mock('../../shared/utils/database.util');

describe('OrganizationService', () => {
    let service: OrganizationService;
    let organizationRepository: OrganizationRepository;
    let logger: LoggerService;

    const mockOrganizationRepository = {
        create: jest.fn(),
        findById: jest.fn(),
        findByName: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        findWithStats: jest.fn(),
    };

    const mockLogger = {
        logUserAction: jest.fn(),
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
            providers: [
                OrganizationService,
                {
                    provide: OrganizationRepository,
                    useValue: mockOrganizationRepository,
                },
                {
                    provide: LoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        service = module.get<OrganizationService>(OrganizationService);
        organizationRepository = module.get<OrganizationRepository>(OrganizationRepository);
        logger = module.get<LoggerService>(LoggerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createOrganization', () => {
        const createOrganizationDto: CreateOrganizationDto = {
            name: 'New Organization',
            description: 'New Description',
        };

        it('should create organization successfully', async () => {
            mockOrganizationRepository.create.mockResolvedValue(mockOrganization);

            const result = await service.createOrganization(
                createOrganizationDto,
                'user-123',
                'correlation-456'
            );

            expect(mockOrganizationRepository.create).toHaveBeenCalledWith(createOrganizationDto);
            expect(mockLogger.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'ORGANIZATION_CREATED',
                {
                    organizationId: 'org-123',
                    organizationName: 'Test Organization',
                },
                'org-123',
                'correlation-456'
            );
            expect(result).toEqual(mockOrganization);
        });

        it('should handle unique constraint violation', async () => {
            const uniqueError = new Error('Unique constraint violation');
            (DatabaseUtil.isUniqueConstraintError as jest.Mock).mockReturnValue(true);
            (DatabaseUtil.getUniqueConstraintFields as jest.Mock).mockReturnValue(['name']);
            mockOrganizationRepository.create.mockRejectedValue(uniqueError);

            await expect(
                service.createOrganization(createOrganizationDto, 'user-123')
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('getAllOrganizations', () => {
        it('should return all organizations', async () => {
            const organizations = [mockOrganization];
            mockOrganizationRepository.findMany.mockResolvedValue(organizations);

            const result = await service.getAllOrganizations();

            expect(mockOrganizationRepository.findMany).toHaveBeenCalled();
            expect(result).toEqual(organizations);
        });
    });

    describe('getOrganizationById', () => {
        it('should return organization by id', async () => {
            mockOrganizationRepository.findById.mockResolvedValue(mockOrganization);

            const result = await service.getOrganizationById('org-123');

            expect(mockOrganizationRepository.findById).toHaveBeenCalledWith('org-123');
            expect(result).toEqual(mockOrganization);
        });

        it('should return null when organization not found', async () => {
            mockOrganizationRepository.findById.mockResolvedValue(null);

            const result = await service.getOrganizationById('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('updateOrganization', () => {
        const updateOrganizationDto: UpdateOrganizationDto = {
            name: 'Updated Organization',
            description: 'Updated Description',
        };

        it('should update organization successfully', async () => {
            const updatedOrganization = { ...mockOrganization, ...updateOrganizationDto };
            mockOrganizationRepository.findById.mockResolvedValue(mockOrganization);
            mockOrganizationRepository.update.mockResolvedValue(updatedOrganization);

            const result = await service.updateOrganization(
                'org-123',
                updateOrganizationDto,
                'user-123',
                'correlation-456'
            );

            expect(mockOrganizationRepository.findById).toHaveBeenCalledWith('org-123');
            expect(mockOrganizationRepository.update).toHaveBeenCalledWith(
                'org-123',
                updateOrganizationDto
            );
            expect(mockLogger.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'ORGANIZATION_UPDATED',
                {
                    organizationId: 'org-123',
                    changes: updateOrganizationDto,
                    oldName: 'Test Organization',
                    newName: 'Updated Organization',
                },
                'org-123',
                'correlation-456'
            );
            expect(result).toEqual(updatedOrganization);
        });

        it('should throw NotFoundException when organization not found', async () => {
            mockOrganizationRepository.findById.mockResolvedValue(null);

            await expect(
                service.updateOrganization('nonexistent', updateOrganizationDto, 'user-123')
            ).rejects.toThrow(NotFoundException);
            expect(mockOrganizationRepository.update).not.toHaveBeenCalled();
        });

        it('should handle unique constraint violation', async () => {
            const uniqueError = new Error('Unique constraint violation');
            mockOrganizationRepository.findById.mockResolvedValue(mockOrganization);
            (DatabaseUtil.isUniqueConstraintError as jest.Mock).mockReturnValue(true);
            (DatabaseUtil.getUniqueConstraintFields as jest.Mock).mockReturnValue(['name']);
            mockOrganizationRepository.update.mockRejectedValue(uniqueError);

            await expect(
                service.updateOrganization('org-123', updateOrganizationDto, 'user-123')
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('deleteOrganization', () => {
        it('should delete organization successfully', async () => {
            mockOrganizationRepository.findById.mockResolvedValue(mockOrganization);
            mockOrganizationRepository.delete.mockResolvedValue(undefined);

            await service.deleteOrganization('org-123', 'user-123', 'correlation-456');

            expect(mockOrganizationRepository.findById).toHaveBeenCalledWith('org-123');
            expect(mockOrganizationRepository.delete).toHaveBeenCalledWith('org-123');
            expect(mockLogger.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'ORGANIZATION_DELETED',
                {
                    organizationId: 'org-123',
                    organizationName: 'Test Organization',
                },
                'org-123',
                'correlation-456'
            );
        });

        it('should throw NotFoundException when organization not found', async () => {
            mockOrganizationRepository.findById.mockResolvedValue(null);

            await expect(service.deleteOrganization('nonexistent', 'user-123')).rejects.toThrow(
                NotFoundException
            );
            expect(mockOrganizationRepository.delete).not.toHaveBeenCalled();
        });
    });

    describe('getOrganizationWithStats', () => {
        it('should return organization with statistics', async () => {
            const organizationWithStats = {
                ...mockOrganization,
                _count: {
                    users: 5,
                    branches: 3,
                    employees: 25,
                    devices: 10,
                },
            };

            mockOrganizationRepository.findWithStats.mockResolvedValue(organizationWithStats);

            const result = await service.getOrganizationWithStats('org-123');

            expect(mockOrganizationRepository.findWithStats).toHaveBeenCalledWith('org-123');
            expect(result).toEqual({
                id: 'org-123',
                name: 'Test Organization',
                description: 'Test Description',
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
                statistics: {
                    totalUsers: 5,
                    totalBranches: 3,
                    totalEmployees: 25,
                    totalDevices: 10,
                },
            });
        });

        it('should throw NotFoundException when organization not found', async () => {
            mockOrganizationRepository.findWithStats.mockResolvedValue(null);

            await expect(service.getOrganizationWithStats('nonexistent')).rejects.toThrow(
                NotFoundException
            );
        });
    });

    describe('searchOrganizations', () => {
        it('should search organizations by name', async () => {
            const organizations = [mockOrganization];
            mockOrganizationRepository.findMany.mockResolvedValue(organizations);

            const result = await service.searchOrganizations('test');

            expect(mockOrganizationRepository.findMany).toHaveBeenCalledWith({
                name: {
                    contains: 'test',
                    mode: 'insensitive',
                },
            });
            expect(result).toEqual(organizations);
        });
    });

    describe('getOrganizationCount', () => {
        it('should return organization count', async () => {
            mockOrganizationRepository.count.mockResolvedValue(5);

            const result = await service.getOrganizationCount();

            expect(mockOrganizationRepository.count).toHaveBeenCalled();
            expect(result).toBe(5);
        });
    });
});
