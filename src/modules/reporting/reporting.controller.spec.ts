import { Test, TestingModule } from '@nestjs/testing';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { CreateReportDto } from '../../shared/dto';
import { DataScope, UserContext } from '../../shared/interfaces';

describe('ReportingController', () => {
    let controller: ReportingController;
    let reportingService: jest.Mocked<ReportingService>;

    const mockUserContext: UserContext = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        roles: ['ADMIN'],
        permissions: ['report:create', 'report:read:all', 'report:download'],
    };

    const mockDataScope: DataScope = {
        organizationId: 'org-123',
        branchIds: ['branch-123'],
    };

    const mockReport = {
        id: 'report-123',
        name: 'Daily Attendance Report',
        type: 'DAILY_ATTENDANCE',
        format: 'CSV',
        status: 'PENDING',
        parameters: { date: '2024-01-15' },
        organizationId: 'org-123',
        createdByUserId: 'user-123',
        fileUrl: null,
        filePath: null,
        fileSize: null,
        recordCount: null,
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const mockReportingService = {
            generateReport: jest.fn(),
            getReports: jest.fn(),
            getReportById: jest.fn(),
            getReportDownloadUrl: jest.fn(),
            regenerateReport: jest.fn(),
            getAvailableReportTypes: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ReportingController],
            providers: [
                {
                    provide: ReportingService,
                    useValue: mockReportingService,
                },
            ],
        }).compile();

        controller = module.get<ReportingController>(ReportingController);
        reportingService = module.get(ReportingService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('generateReport', () => {
        it('should generate a report successfully', async () => {
            const createDto: CreateReportDto = {
                name: 'Daily Attendance Report',
                type: 'DAILY_ATTENDANCE',
                format: 'CSV',
                parameters: { date: '2024-01-15' },
            };

            reportingService.generateReport.mockResolvedValue(mockReport as any);

            const result = await controller.generateReport(
                createDto,
                mockUserContext,
                mockDataScope
            );

            expect(reportingService.generateReport).toHaveBeenCalledWith(
                createDto,
                mockDataScope,
                mockUserContext.sub
            );
            expect(result).toEqual({
                id: mockReport.id,
                name: mockReport.name,
                type: mockReport.type,
                status: mockReport.status,
                parameters: mockReport.parameters,
                organizationId: mockReport.organizationId,
                createdByUserId: mockReport.createdByUserId,
                fileUrl: mockReport.fileUrl,
                filePath: mockReport.filePath,
                fileSize: mockReport.fileSize,
                recordCount: mockReport.recordCount,
                startedAt: mockReport.startedAt,
                completedAt: mockReport.completedAt,
                errorMessage: mockReport.errorMessage,
                createdAt: mockReport.createdAt,
                updatedAt: mockReport.updatedAt,
            });
        });
    });

    describe('getReports', () => {
        it('should return paginated reports', async () => {
            const mockResult = {
                data: [mockReport],
                total: 1,
                page: 1,
                limit: 20,
                totalPages: 1,
            };

            reportingService.getReports.mockResolvedValue(mockResult as any);

            const result = await controller.getReports(
                mockDataScope,
                { type: 'DAILY_ATTENDANCE' },
                { page: 1, limit: 20 }
            );

            expect(reportingService.getReports).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'DAILY_ATTENDANCE',
                }),
                mockDataScope,
                { page: 1, limit: 20 }
            );
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('getReportTypes', () => {
        it('should return available report types', async () => {
            const mockTypes = [
                {
                    type: 'DAILY_ATTENDANCE',
                    name: 'Daily Attendance Report',
                    description: 'Detailed attendance report for a specific date',
                    parameters: [
                        {
                            name: 'date',
                            type: 'date',
                            required: true,
                            description: 'Date for the report (YYYY-MM-DD)',
                        },
                    ],
                },
            ];

            reportingService.getAvailableReportTypes.mockResolvedValue(mockTypes);

            const result = await controller.getReportTypes();

            expect(reportingService.getAvailableReportTypes).toHaveBeenCalled();
            expect(result).toEqual(mockTypes);
        });
    });

    describe('getReportById', () => {
        it('should return report by ID', async () => {
            reportingService.getReportById.mockResolvedValue(mockReport as any);

            const result = await controller.getReportById('report-123', mockDataScope);

            expect(reportingService.getReportById).toHaveBeenCalledWith(
                'report-123',
                mockDataScope
            );
            expect(result.id).toBe('report-123');
        });

        it('should throw error when report not found', async () => {
            reportingService.getReportById.mockResolvedValue(null);

            await expect(controller.getReportById('report-123', mockDataScope)).rejects.toThrow(
                'Report not found'
            );
        });
    });

    describe('downloadReport', () => {
        it('should return download URL for completed report', async () => {
            const mockDownload = {
                downloadUrl: 'https://example.com/download/report-123',
                expiresAt: new Date(Date.now() + 3600 * 1000),
            };

            reportingService.getReportDownloadUrl.mockResolvedValue(mockDownload);

            const result = await controller.downloadReport('report-123', mockDataScope);

            expect(reportingService.getReportDownloadUrl).toHaveBeenCalledWith(
                'report-123',
                mockDataScope
            );
            expect(result).toEqual(mockDownload);
        });
    });

    describe('regenerateReport', () => {
        it('should regenerate an existing report', async () => {
            const updatedReport = {
                ...mockReport,
                status: 'PENDING',
                startedAt: new Date(),
            };

            reportingService.regenerateReport.mockResolvedValue(updatedReport as any);

            const result = await controller.regenerateReport(
                'report-123',
                mockUserContext,
                mockDataScope
            );

            expect(reportingService.regenerateReport).toHaveBeenCalledWith(
                'report-123',
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.status).toBe('PENDING');
        });
    });

    describe('generateDailyAttendanceReport', () => {
        it('should generate daily attendance report', async () => {
            reportingService.generateReport.mockResolvedValue(mockReport as any);

            const params = {
                date: '2024-01-15',
                branchId: 'branch-123',
                format: 'CSV' as const,
                includeDetails: true,
            };

            const result = await controller.generateDailyAttendanceReport(
                params,
                mockUserContext,
                mockDataScope
            );

            expect(reportingService.generateReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Daily Attendance Report - 2024-01-15',
                    type: 'DAILY_ATTENDANCE',
                    format: 'CSV',
                    parameters: {
                        date: '2024-01-15',
                        branchId: 'branch-123',
                        includeDetails: true,
                    },
                }),
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.type).toBe('DAILY_ATTENDANCE');
        });
    });

    describe('generateMonthlyAttendanceReport', () => {
        it('should generate monthly attendance report', async () => {
            reportingService.generateReport.mockResolvedValue(mockReport as any);

            const params = {
                year: 2024,
                month: 1,
                branchId: 'branch-123',
                format: 'CSV' as const,
                includeSummary: true,
            };

            const result = await controller.generateMonthlyAttendanceReport(
                params,
                mockUserContext,
                mockDataScope
            );

            expect(reportingService.generateReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Monthly Attendance Report - 2024-01',
                    type: 'MONTHLY_ATTENDANCE',
                    format: 'CSV',
                    parameters: {
                        year: 2024,
                        month: 1,
                        branchId: 'branch-123',
                        includeSummary: true,
                    },
                }),
                mockDataScope,
                mockUserContext.sub
            );
            expect(result.type).toBe('DAILY_ATTENDANCE'); // Mock returns this type
        });
    });

    describe('generateEmployeeListReport', () => {
        it('should generate employee list report', async () => {
            reportingService.generateReport.mockResolvedValue(mockReport as any);

            const params = {
                branchId: 'branch-123',
                departmentId: 'dept-123',
                isActive: true,
                format: 'CSV' as const,
                includeContactInfo: false,
            };

            const result = await controller.generateEmployeeListReport(
                params,
                mockUserContext,
                mockDataScope
            );

            expect(reportingService.generateReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Employee List Report',
                    type: 'EMPLOYEE_LIST',
                    format: 'CSV',
                    parameters: {
                        branchId: 'branch-123',
                        departmentId: 'dept-123',
                        isActive: true,
                        includeContactInfo: false,
                    },
                }),
                mockDataScope,
                mockUserContext.sub
            );
        });
    });

    describe('generateSecurityAuditReport', () => {
        it('should generate security audit report', async () => {
            reportingService.generateReport.mockResolvedValue(mockReport as any);

            const params = {
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                severity: 'HIGH' as const,
                format: 'CSV' as const,
                includeDetails: true,
            };

            const result = await controller.generateSecurityAuditReport(
                params,
                mockUserContext,
                mockDataScope
            );

            expect(reportingService.generateReport).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Security Audit Report - 2024-01-01 to 2024-01-31',
                    type: 'SECURITY_AUDIT',
                    format: 'CSV',
                    parameters: {
                        startDate: '2024-01-01',
                        endDate: '2024-01-31',
                        severity: 'HIGH',
                        includeDetails: true,
                    },
                }),
                mockDataScope,
                mockUserContext.sub
            );
        });
    });
});
