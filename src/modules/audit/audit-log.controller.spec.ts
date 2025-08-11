import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { AuditLogFiltersDto } from '../../shared/dto';
import { DataScope, UserContext } from '../../shared/interfaces';

describe('AuditLogController', () => {
    let controller: AuditLogController;
    let auditLogService: jest.Mocked<AuditLogService>;

    const mockUserContext: UserContext = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        roles: ['ADMIN'],
        permissions: ['audit:read:all', 'audit:export'],
    };

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
        user: {
            id: 'user-123',
            email: 'test@example.com',
            fullName: 'Test User',
        },
        createdAt: new Date(),
    };

    beforeEach(async () => {
        const mockAuditLogService = {
            getAuditLogs: jest.fn(),
            getAuditLogById: jest.fn(),
            getAuditLogStats: jest.fn(),
            getUserActivitySummary: jest.fn(),
            getResourceHistory: jest.fn(),
            getSecurityEvents: jest.fn(),
            exportAuditLogs: jest.fn(),
            cleanupOldAuditLogs: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuditLogController],
            providers: [
                {
                    provide: AuditLogService,
                    useValue: mockAuditLogService,
                },
            ],
        }).compile();

        controller = module.get<AuditLogController>(AuditLogController);
        auditLogService = module.get(AuditLogService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getAuditLogs', () => {
        it('should return paginated audit logs', async () => {
            const mockResult = {
                data: [mockAuditLog],
                total: 1,
                page: 1,
                limit: 50,
                totalPages: 1,
            };

            auditLogService.getAuditLogs.mockResolvedValue(mockResult as any);

            const result = await controller.getAuditLogs(
                mockDataScope,
                { userId: 'user-123' },
                { page: 1, limit: 50 }
            );

            expect(auditLogService.getAuditLogs).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-123',
                }),
                mockDataScope,
                { page: 1, limit: 50 }
            );
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('getAuditLogStats', () => {
        it('should return audit log statistics', async () => {
            const mockStats = {
                totalLogs: 100,
                logsByAction: [
                    { action: 'CREATE', count: 30 },
                    { action: 'UPDATE', count: 25 },
                ],
                logsByResource: [
                    { resource: 'employee', count: 40 },
                    { resource: 'device', count: 20 },
                ],
                logsByStatus: [
                    { status: 'SUCCESS', count: 90 },
                    { status: 'FAILED', count: 10 },
                ],
                logsByUser: [{ userId: 'user-123', user: mockAuditLog.user, count: 50 }],
            };

            auditLogService.getAuditLogStats.mockResolvedValue(mockStats);

            const result = await controller.getAuditLogStats(mockDataScope, {});

            expect(auditLogService.getAuditLogStats).toHaveBeenCalledWith({}, mockDataScope);
            expect(result.totalLogs).toBe(100);
            expect(result.logsByAction).toHaveLength(2);
        });
    });

    describe('getUserActivitySummary', () => {
        it('should return user activity summary', async () => {
            const mockSummary = {
                userId: 'user-123',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                totalActivities: 50,
                activities: [
                    {
                        action: 'CREATE',
                        resource: 'employee',
                        count: 10,
                        lastActivity: new Date(),
                        successCount: 9,
                        failureCount: 1,
                    },
                ],
            };

            auditLogService.getUserActivitySummary.mockResolvedValue(mockSummary);

            const result = await controller.getUserActivitySummary(
                'user-123',
                '2024-01-01',
                '2024-01-31',
                mockDataScope
            );

            expect(auditLogService.getUserActivitySummary).toHaveBeenCalledWith(
                'user-123',
                new Date('2024-01-01'),
                new Date('2024-01-31'),
                mockDataScope
            );
            expect(result.totalActivities).toBe(50);
        });

        it('should throw error when dates are missing', async () => {
            await expect(
                controller.getUserActivitySummary('user-123', '', '2024-01-31', mockDataScope)
            ).rejects.toThrow('Start date and end date are required');
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

            auditLogService.getResourceHistory.mockResolvedValue(mockResult as any);

            const result = await controller.getResourceHistory(
                'employee',
                'emp-123',
                mockDataScope,
                {
                    page: 1,
                    limit: 50,
                }
            );

            expect(auditLogService.getResourceHistory).toHaveBeenCalledWith(
                'employee',
                'emp-123',
                mockDataScope,
                { page: 1, limit: 50 }
            );
            expect(result.data).toHaveLength(1);
        });
    });

    describe('getSecurityEvents', () => {
        it('should return security events', async () => {
            const mockResult = {
                data: [mockAuditLog],
                total: 1,
                page: 1,
                limit: 50,
                totalPages: 1,
            };

            auditLogService.getSecurityEvents.mockResolvedValue(mockResult as any);

            const result = await controller.getSecurityEvents(
                mockDataScope,
                { severity: 'HIGH' },
                { page: 1, limit: 50 }
            );

            expect(auditLogService.getSecurityEvents).toHaveBeenCalledWith(
                expect.objectContaining({
                    severity: 'HIGH',
                }),
                mockDataScope,
                { page: 1, limit: 50 }
            );
            expect(result.data).toHaveLength(1);
        });
    });

    describe('getAuditLogById', () => {
        it('should return audit log by ID', async () => {
            auditLogService.getAuditLogById.mockResolvedValue(mockAuditLog as any);

            const result = await controller.getAuditLogById('audit-123', mockDataScope);

            expect(auditLogService.getAuditLogById).toHaveBeenCalledWith(
                'audit-123',
                mockDataScope
            );
            expect(result.id).toBe('audit-123');
        });

        it('should throw error when audit log not found', async () => {
            auditLogService.getAuditLogById.mockResolvedValue(null);

            await expect(controller.getAuditLogById('audit-123', mockDataScope)).rejects.toThrow(
                'Audit log not found'
            );
        });
    });

    describe('exportAuditLogs', () => {
        it('should export audit logs in CSV format', async () => {
            const mockExport = {
                format: 'CSV',
                data: 'timestamp,action,resource\\n2024-01-15,CREATE,employee',
                metadata: {
                    exportDate: new Date(),
                    totalRecords: 1,
                    filters: {},
                },
            };

            auditLogService.exportAuditLogs.mockResolvedValue(mockExport as any);

            const result = await controller.exportAuditLogs(
                {
                    filters: { userId: 'user-123' },
                    format: 'CSV',
                },
                mockDataScope
            );

            expect(auditLogService.exportAuditLogs).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-123',
                }),
                mockDataScope,
                'CSV'
            );
            expect(result.format).toBe('CSV');
        });

        it('should export audit logs in JSON format', async () => {
            const mockExport = {
                format: 'JSON',
                data: [mockAuditLog],
                metadata: {
                    exportDate: new Date(),
                    totalRecords: 1,
                    filters: {},
                },
            };

            auditLogService.exportAuditLogs.mockResolvedValue(mockExport as any);

            const result = await controller.exportAuditLogs(
                {
                    filters: { userId: 'user-123' },
                    format: 'JSON',
                },
                mockDataScope
            );

            expect(result.format).toBe('JSON');
            expect(Array.isArray(result.data)).toBe(true);
        });
    });

    describe('cleanupOldAuditLogs', () => {
        it('should cleanup old audit logs', async () => {
            auditLogService.cleanupOldAuditLogs.mockResolvedValue(50);

            const result = await controller.cleanupOldAuditLogs(
                { olderThanDays: 90 },
                mockUserContext,
                mockDataScope
            );

            expect(auditLogService.cleanupOldAuditLogs).toHaveBeenCalledWith(90, 'org-123');
            expect(result.deletedCount).toBe(50);
            expect(result.message).toContain('50 old audit log records');
        });
    });
});
