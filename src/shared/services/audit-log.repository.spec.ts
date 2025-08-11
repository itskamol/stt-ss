import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogRepository } from './audit-log.repository';
import { PrismaService } from '../../core/database/prisma.service';
import { DataScope } from '../interfaces';

describe('AuditLogRepository', () => {
    let repository: AuditLogRepository;
    let prismaService: any;

    const mockDataScope: DataScope = {
        organizationId: 'org-123',
        branchIds: ['branch-123'],
    };

    const mockAuditLog = {
        id: 'audit-123',
        action: 'CREATE',
        resource: 'employee',
        resourceId: 'emp-123',
        userId: 'user-123',
        organizationId: 'org-123',
        method: 'POST',
        url: '/api/v1/employees',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        status: 'SUCCESS',
        duration: 150,
        timestamp: new Date('2024-01-15T10:00:00Z'),
        createdAt: new Date(),
        user: {
            id: 'user-123',
            email: 'test@example.com',
            fullName: 'Test User',
        },
    };

    beforeEach(async () => {
        const mockPrismaService = {
            auditLog: {
                create: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn(),
                groupBy: jest.fn(),
                deleteMany: jest.fn(),
            },
            user: {
                findMany: jest.fn(),
            },
        } as any

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditLogRepository,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        repository = module.get<AuditLogRepository>(AuditLogRepository);
        prismaService = module.get(PrismaService);
    });

    it('should be defined', () => {
        expect(repository).toBeDefined();
    });

    describe('create', () => {
        it('should create an audit log', async () => {
            const createData = {
                action: 'CREATE',
                resource: 'employee',
                resourceId: 'emp-123',
                userId: 'user-123',
                organizationId: 'org-123',
                method: 'POST',
                url: '/api/v1/employees',
                userAgent: 'Mozilla/5.0',
                ipAddress: '192.168.1.1',
                status: 'SUCCESS',
                duration: 150,
                timestamp: new Date(),
            };

            prismaService.auditLog.create.mockResolvedValue(mockAuditLog as any);

            const result = await repository.create(createData);

            expect(prismaService.auditLog.create).toHaveBeenCalledWith({
                data: createData,
            });
            expect(result).toEqual(mockAuditLog);
        });
    });

    describe('findById', () => {
        it('should find audit log by ID', async () => {
            prismaService.auditLog.findFirst.mockResolvedValue(mockAuditLog as any);

            const result = await repository.findById('audit-123', mockDataScope);

            expect(prismaService.auditLog.findFirst).toHaveBeenCalledWith({
                where: {
                    id: 'audit-123',
                    organizationId: mockDataScope.organizationId,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            fullName: true,
                        },
                    },
                },
            });
            expect(result).toEqual(mockAuditLog);
        });
    });

    describe('findMany', () => {
        it('should find audit logs with filters and pagination', async () => {
            const mockResult = [mockAuditLog];
            const filters = {
                userId: 'user-123',
                resource: 'employee',
                action: 'CREATE',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
            };

            prismaService.auditLog.findMany.mockResolvedValue(mockResult as any);
            prismaService.auditLog.count.mockResolvedValue(1);

            const result = await repository.findMany(filters, mockDataScope, {
                page: 1,
                limit: 50,
            });

            expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
                where: {
                    organizationId: mockDataScope.organizationId,
                    userId: filters.userId,
                    resource: filters.resource,
                    action: { contains: filters.action, mode: 'insensitive' },
                    timestamp: {
                        gte: filters.startDate,
                        lte: filters.endDate,
                    },
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            fullName: true,
                        },
                    },
                },
                orderBy: { timestamp: 'desc' },
                skip: 0,
                take: 50,
            });

            expect(result.data).toEqual(mockResult);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(50);
        });

        it('should handle empty filters', async () => {
            prismaService.auditLog.findMany.mockResolvedValue([]);
            prismaService.auditLog.count.mockResolvedValue(0);

            // const result = await repository.findMany({}, mockDataScope);

            expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
                where: {
                    organizationId: mockDataScope.organizationId,
                },
                include: expect.any(Object),
                orderBy: { timestamp: 'desc' },
                skip: 0,
                take: 50,
            });
        });
    });

    describe('getAuditLogStats', () => {
        it('should return audit log statistics', async () => {
            const mockUsers = [
                { id: 'user-123', email: 'test@example.com', fullName: 'Test User' },
            ];

            prismaService.auditLog.count.mockResolvedValue(100);
            prismaService.auditLog.groupBy
                .mockResolvedValueOnce([
                    { action: 'CREATE', _count: { id: 30 } },
                    { action: 'UPDATE', _count: { id: 25 } },
                ] as any)
                .mockResolvedValueOnce([
                    { resource: 'employee', _count: { id: 40 } },
                    { resource: 'device', _count: { id: 20 } },
                ] as any)
                .mockResolvedValueOnce([
                    { status: 'SUCCESS', _count: { id: 90 } },
                    { status: 'FAILED', _count: { id: 10 } },
                ] as any)
                .mockResolvedValueOnce([{ userId: 'user-123', _count: { id: 50 } }] as any);

            prismaService.user.findMany.mockResolvedValue(mockUsers as any);

            const result = await repository.getAuditLogStats({}, mockDataScope);

            expect(result.totalLogs).toBe(100);
            expect(result.logsByAction).toHaveLength(2);
            expect(result.logsByResource).toHaveLength(2);
            expect(result.logsByStatus).toHaveLength(2);
            expect(result.logsByUser).toHaveLength(1);
            expect(result.logsByUser[0].user).toEqual(mockUsers[0]);
        });
    });

    describe('getAuditLogsByDateRange', () => {
        it('should return audit logs grouped by date', async () => {
            const mockLogs = [
                { timestamp: new Date('2024-01-15T09:00:00Z') },
                { timestamp: new Date('2024-01-15T17:00:00Z') },
                { timestamp: new Date('2024-01-16T09:00:00Z') },
            ];

            prismaService.auditLog.findMany.mockResolvedValue(mockLogs as any);

            const result = await repository.getAuditLogsByDateRange(
                new Date('2024-01-01'),
                new Date('2024-01-31'),
                mockDataScope
            );

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ date: '2024-01-15', count: 2 });
            expect(result[1]).toEqual({ date: '2024-01-16', count: 1 });
        });
    });

    describe('deleteOldLogs', () => {
        it('should delete old audit logs', async () => {
            prismaService.auditLog.deleteMany.mockResolvedValue({ count: 50 });

            const cutoffDate = new Date('2024-01-01');
            const result = await repository.deleteOldLogs(cutoffDate, 'org-123');

            expect(prismaService.auditLog.deleteMany).toHaveBeenCalledWith({
                where: {
                    timestamp: {
                        lt: cutoffDate,
                    },
                    organizationId: 'org-123',
                },
            });
            expect(result).toBe(50);
        });

        it('should delete old logs without organization filter', async () => {
            prismaService.auditLog.deleteMany.mockResolvedValue({ count: 100 });

            const cutoffDate = new Date('2024-01-01');
            const result = await repository.deleteOldLogs(cutoffDate);

            expect(prismaService.auditLog.deleteMany).toHaveBeenCalledWith({
                where: {
                    timestamp: {
                        lt: cutoffDate,
                    },
                },
            });
            expect(result).toBe(100);
        });
    });

    describe('getFailedOperations', () => {
        it('should return failed operations', async () => {
            const mockFailedLogs = [
                {
                    ...mockAuditLog,
                    status: 'FAILED',
                    errorMessage: 'Validation failed',
                },
            ];

            prismaService.auditLog.findMany.mockResolvedValue(mockFailedLogs as any);

            const result = await repository.getFailedOperations(
                new Date('2024-01-01'),
                new Date('2024-01-31'),
                mockDataScope,
                50
            );

            expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
                where: {
                    status: 'FAILED',
                    timestamp: {
                        gte: expect.any(Date),
                        lte: expect.any(Date),
                    },
                    organizationId: mockDataScope.organizationId,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            fullName: true,
                        },
                    },
                },
                orderBy: { timestamp: 'desc' },
                take: 50,
            });
            expect(result).toEqual(mockFailedLogs);
        });
    });

    describe('getUserLoginHistory', () => {
        it('should return user login history', async () => {
            const mockLoginLogs = [
                {
                    ...mockAuditLog,
                    action: 'LOGIN',
                    status: 'SUCCESS',
                },
                {
                    ...mockAuditLog,
                    id: 'audit-124',
                    action: 'LOGOUT',
                    status: 'SUCCESS',
                },
            ];

            prismaService.auditLog.findMany.mockResolvedValue(mockLoginLogs as any);

            const result = await repository.getUserLoginHistory(
                'user-123',
                new Date('2024-01-01'),
                new Date('2024-01-31'),
                mockDataScope
            );

            expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
                where: {
                    userId: 'user-123',
                    action: {
                        in: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED'],
                    },
                    timestamp: {
                        gte: expect.any(Date),
                        lte: expect.any(Date),
                    },
                    organizationId: mockDataScope.organizationId,
                },
                orderBy: { timestamp: 'desc' },
            });
            expect(result).toEqual(mockLoginLogs);
        });
    });

    describe('getResourceAccessHistory', () => {
        it('should return resource access history', async () => {
            const mockResourceLogs = [mockAuditLog];

            (prismaService.auditLog.findMany as jest.Mock).mockResolvedValue(
                mockResourceLogs as any
            );

            const result = await repository.getResourceAccessHistory(
                'employee',
                'emp-123',
                mockDataScope,
                25
            );

            expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
                where: {
                    resource: 'employee',
                    resourceId: 'emp-123',
                    organizationId: mockDataScope.organizationId,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            fullName: true,
                        },
                    },
                },
                orderBy: { timestamp: 'desc' },
                take: 25,
            });
            expect(result).toEqual(mockResourceLogs);
        });
    });
});
