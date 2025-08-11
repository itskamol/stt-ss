import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationRepository } from './organization.repository';
import { PrismaService } from '../../core/database/prisma.service';

describe('OrganizationRepository', () => {
    let repository: OrganizationRepository;
    let prismaService: PrismaService;

    const mockPrismaService = {
        organization: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrganizationRepository,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        repository = module.get<OrganizationRepository>(OrganizationRepository);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a new organization', async () => {
            const createDto = {
                name: 'Test Organization',
                description: 'Test Description',
            };

            const expectedResult = {
                id: '123',
                ...createDto,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockPrismaService.organization.create.mockResolvedValue(expectedResult);

            const result = await repository.create(createDto);

            expect(mockPrismaService.organization.create).toHaveBeenCalledWith({
                data: createDto,
            });
            expect(result).toEqual(expectedResult);
        });
    });

    describe('findById', () => {
        it('should find organization by id', async () => {
            const organizationId = '123';
            const expectedResult = {
                id: organizationId,
                name: 'Test Organization',
                description: 'Test Description',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockPrismaService.organization.findUnique.mockResolvedValue(expectedResult);

            const result = await repository.findById(organizationId);

            expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({
                where: { id: organizationId },
            });
            expect(result).toEqual(expectedResult);
        });

        it('should return null if organization not found', async () => {
            const organizationId = '123';

            mockPrismaService.organization.findUnique.mockResolvedValue(null);

            const result = await repository.findById(organizationId);

            expect(result).toBeNull();
        });
    });

    describe('findByName', () => {
        it('should find organization by name', async () => {
            const organizationName = 'Test Organization';
            const expectedResult = {
                id: '123',
                name: organizationName,
                description: 'Test Description',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockPrismaService.organization.findUnique.mockResolvedValue(expectedResult);

            const result = await repository.findByName(organizationName);

            expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({
                where: { name: organizationName },
            });
            expect(result).toEqual(expectedResult);
        });
    });

    describe('update', () => {
        it('should update organization', async () => {
            const organizationId = '123';
            const updateDto = {
                name: 'Updated Organization',
                description: 'Updated Description',
            };

            const expectedResult = {
                id: organizationId,
                ...updateDto,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockPrismaService.organization.update.mockResolvedValue(expectedResult);

            const result = await repository.update(organizationId, updateDto);

            expect(mockPrismaService.organization.update).toHaveBeenCalledWith({
                where: { id: organizationId },
                data: updateDto,
            });
            expect(result).toEqual(expectedResult);
        });
    });

    describe('delete', () => {
        it('should delete organization', async () => {
            const organizationId = '123';

            mockPrismaService.organization.delete.mockResolvedValue({});

            await repository.delete(organizationId);

            expect(mockPrismaService.organization.delete).toHaveBeenCalledWith({
                where: { id: organizationId },
            });
        });
    });
});
