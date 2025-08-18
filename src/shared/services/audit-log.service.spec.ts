import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { AuditLogRepository } from './audit-log.repository';
import { LoggerService } from '@/core/logger';
import { DataScope } from '../interfaces';
import { CreateAuditLogDto } from '../dto';

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
            const createData: CreateAuditLogDto = {
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
                oldValues: null,
                newValues: null,
                requestData: null,
                responseData: null,
                errorMessage: null,
                errorStack: null,
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
            const createData: CreateAuditLogDto = {
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

            const result = await service.getAuditLogs(filters, mockDataScope, {
                page: 1,
                limit: 50,
            });

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
                logsByUser: [
                    {
                        userId: 'user-123',
                        user: {
                            id: 'user-123',
                            email: 'test@example.com',
                            fullName: 'Test User',
                        },
                        count: 50,
                    },
                ],
            };

            auditLogRepository.getAuditLogStats.mockResolvedValue(mockStats);

            const result = await service.getAuditLogStats({}, mockDataScope);

            expect(auditLogRepository.getAuditLogStats).toHaveBeenCalledWith({}, mockDataScope);
            expect(result).toEqual(mockStats);
        });
    });

    // Other tests would go here...
});
