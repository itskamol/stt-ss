import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { AuditLogRepository } from './audit-log.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { DataScope } from '../interfaces';

describe('AuditLogService', () => {
    let service: AuditLogService;
    let auditLogRepository: jest.Mocked<AuditLogRepository>;
    let loggerService: jest.Mocked<LoggerService>;

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
    };

    beforeEach(async () => {
        const mockAuditLogRepository = {
            create: jest.fn(),
            findById: jest.fn(),
            findMany: jest.fn(),
            getAuditLogStats: jest.fn(),
            deleteOldLogs: jest.fn(),
        };

        const mockLoggerService = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditLogService,
                {
                    provide: AuditLogRepository,
                    useValue: mockAuditLogRepository,
                },
                {
                    provide: LoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        service = module.get<AuditLogService>(AuditLogService);
        auditLogRepository = module.get(AuditLogRepository);
        loggerService = module.get(LoggerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createAuditLog', () => {
        it('should create an audit log successfully', async () => {
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
                status: 'SUCCESS' as const,
                duration: 150,
                timestamp: new Date(),
            };

            auditLogRepository.create.mockResolvedValue(mockAuditLog as any);

            const result = await service.createAuditLog(createData);

            expect(auditLogRepository.create).toHaveBeenCalledWith(createData);
            expect(loggerService.debug).toHaveBeenCalledWith(
                'Audit log created',
                expect.any(Object)
            );
            expect(result).toEqual(mockAuditLog);
        });

        it('should handle errors gracefully', async () => {
            const createData = {
                action: 'CREATE',
                resource: 'employee',
                userId: 'user-123',
                organizationId: 'org-123',
                method: 'POST',
                url: '/api/v1/employees',
                status: 'SUCCESS' as const,
                duration: 150,
                timestamp: new Date(),
            };

            const error = new Error('Database error');
            auditLogRepository.create.mockRejectedValue(error);

            // Should not throw error
            await service.createAuditLog(createData);

            expect(loggerService.error).toHaveBeenCalledWith(
                'Failed to create audit log',
                error.message,
                expect.any(Object)
            );
        });
    });

    describe('getAuditLogs', () => {
        it('should return audit logs with filters', async () => {
            const mockResult = {
                data: [mockAuditLog],
                total: 1,
                page: 1,
                limit: 50,
                totalPages: 1,
            };

            auditLogRepository.findMany.mockResolvedValue(mockResult as any);

            const filters = {
                userId: 'user-123',
                resource: 'employee',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
            };

            const result = await service.getAuditLogs(filters, mockDataScope);

            expect(auditLogRepository.findMany).toHaveBeenCalledWith(filters, mockDataScope, {
                page: 1,
                limit: 50,
            });
            expect(result).toEqual(mockResult);
        });
    });

    describe('getAuditLogById', () => {
        it('should return audit log by ID', async () => {
            auditLogRepository.findById.mockResolvedValue(mockAuditLog as any);

            const result = await service.getAuditLogById('audit-123', mockDataScope);

            expect(auditLogRepository.findById).toHaveBeenCalledWith('audit-123', mockDataScope);
            expect(result).toEqual(mockAuditLog);
        });
    });

    describe('getAuditLogStats', () => {
        it('should return audit log statistics', async () => {
            const mockStats = {
                totalLogs: 100,
                logsByAction: [{ action: 'CREATE', count: 30 }],
                logsByResource: [{ resource: 'employee', count: 40 }],
                logsByStatus: [{ status: 'SUCCESS', count: 90 }],
                logsByUser: [{ userId: 'user-123', user: { id: 'user-123', email: 'test@example.com', fullName: 'Test User' }, count: 50 }],
            };

            auditLogRepository.getAuditLogStats.mockResolvedValue(mockStats);

            const result = await service.getAuditLogStats({}, mockDataScope);

            expect(auditLogRepository.getAuditLogStats).toHaveBeenCalledWith({}, mockDataScope);
            expect(result).toEqual(mockStats);
        });
    });

    describe('getUserActivitySummary', () => {
        it('should return user activity summary', async () => {
            const mockLogs = {
                data: [
                    {
                        ...mockAuditLog,
                        action: 'CREATE',
                        resource: 'employee',
                        status: 'SUCCESS',
                        timestamp: new Date('2024-01-15T10:00:00Z'),
                    },
                    {
                        ...mockAuditLog,
                        id: 'audit-124',
                        action: 'UPDATE',
                        resource: 'employee',
                        status: 'SUCCESS',
                        timestamp: new Date('2024-01-15T11:00:00Z'),
                    },
                    {
                        ...mockAuditLog,
                        id: 'audit-125',
                        action: 'CREATE',
                        resource: 'employee',
                        status: 'FAILED',
                        timestamp: new Date('2024-01-15T12:00:00Z'),
                    },
                ],
                total: 3,
            };

            auditLogRepository.findMany.mockResolvedValue(mockLogs as any);

            const result = await service.getUserActivitySummary(
                'user-123',
                new Date('2024-01-01'),
                new Date('2024-01-31'),
                mockDataScope
            );

            expect(result.userId).toBe('user-123');
            expect(result.totalActivities).toBe(3);
            expect(result.activities).toHaveLength(2); // CREATE:employee and UPDATE:employee

            const createActivity = result.activities.find(a => a.action === 'CREATE');
            expect(createActivity?.count).toBe(2);
            expect(createActivity?.successCount).toBe(1);
            expect(createActivity?.failureCount).toBe(1);
        });
    });

    describe('getResourceHistory', () => {
        it('should return resource history', async () => {
            const mockResult = {
                data: [mockAuditLog],
                total: 1,
                page: 1,
                limit: 50,
                totalPages: 1,
            };

            auditLogRepository.findMany.mockResolvedValue(mockResult as any);

            const result = await service.getResourceHistory('employee', 'emp-123', mockDataScope);

            expect(auditLogRepository.findMany).toHaveBeenCalledWith(
                {
                    resource: 'employee',
                    resourceId: 'emp-123',
                },
                mockDataScope,
                { page: 1, limit: 50 }
            );
            expect(result).toEqual(mockResult);
        });
    });

    describe('getSecurityEvents', () => {
        it('should return security events', async () => {
            const mockLogs = {
                data: [
                    {
                        ...mockAuditLog,
                        action: 'LOGIN_FAILED',
                        status: 'FAILED',
                    },
                    {
                        ...mockAuditLog,
                        id: 'audit-124',
                        action: 'UNAUTHORIZED_ACCESS',
                        status: 'FAILED',
                    },
                    {
                        ...mockAuditLog,
                        id: 'audit-125',
                        action: 'CREATE',
                        status: 'SUCCESS',
                    },
                ],
                total: 3,
            };

            auditLogRepository.findMany.mockResolvedValue(mockLogs as any);

            const result = await service.getSecurityEvents({}, mockDataScope);

            expect(result.data).toHaveLength(2); // Only security-related events
            expect(result.data[0].action).toBe('LOGIN_FAILED');
            expect(result.data[1].action).toBe('UNAUTHORIZED_ACCESS');
        });
    });

    describe('cleanupOldAuditLogs', () => {
        it('should cleanup old audit logs', async () => {
            auditLogRepository.deleteOldLogs.mockResolvedValue(50);

            const result = await service.cleanupOldAuditLogs(90, 'org-123');

            expect(auditLogRepository.deleteOldLogs).toHaveBeenCalledWith(
                expect.any(Date),
                'org-123'
            );
            expect(result).toBe(50);
        });
    });

    describe('exportAuditLogs', () => {
        it('should export audit logs in CSV format', async () => {
            const mockLogs = {
                data: [mockAuditLog],
                total: 1,
            };

            auditLogRepository.findMany.mockResolvedValue(mockLogs as any);

            const result = await service.exportAuditLogs({}, mockDataScope, 'CSV');

            expect(result.format).toBe('CSV');
            expect(typeof result.data).toBe('string');
            expect(result.data).toContain('Timestamp,Action,Resource');
            expect(result.metadata.totalRecords).toBe(1);
        });

        it('should export audit logs in JSON format', async () => {
            const mockLogs = {
                data: [mockAuditLog],
                total: 1,
            };

            auditLogRepository.findMany.mockResolvedValue(mockLogs as any);

            const result = await service.exportAuditLogs({}, mockDataScope, 'JSON');

            expect(result.format).toBe('JSON');
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data).toHaveLength(1);
            expect(result.metadata.totalRecords).toBe(1);
        });
    });
});
