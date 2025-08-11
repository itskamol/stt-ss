import { Inject, Injectable } from '@nestjs/common';
import { ReportRepository } from './report.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { QueueProducer } from '../../core/queue/queue.producer';
import { IStorageAdapter } from '../../shared/adapters/storage.adapter';
import { CreateReportDto } from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';

export interface ReportFilters {
    type?: string;
    status?: string;
    createdByUserId?: string;
    startDate?: Date;
    endDate?: Date;
}

@Injectable()
export class ReportingService {
    constructor(
        private readonly reportRepository: ReportRepository,
        private readonly logger: LoggerService,
        private readonly queueProducer: QueueProducer,
        @Inject('IStorageAdapter') private readonly storageAdapter: IStorageAdapter
    ) {}

    async generateReport(createReportDto: CreateReportDto, scope: DataScope, userId: string) {
        try {
            // Create report record
            const report = await this.reportRepository.create({
                name: createReportDto.name,
                type: createReportDto.type,
                format: createReportDto.format || 'CSV',
                parameters: createReportDto.parameters || {},
                organizationId: scope.organizationId,
                createdByUserId: userId,
                status: 'PENDING',
                startedAt: new Date(),
            });

            // Queue report generation job
            await this.queueProducer.generateReport({
                reportId: report.id,
                type: createReportDto.type,
                format: createReportDto.format || 'CSV',
                parameters: createReportDto.parameters || {},
                organizationId: scope.organizationId,
                userId,
            });

            this.logger.log('Report generation queued', {
                reportId: report.id,
                type: createReportDto.type,
                organizationId: scope.organizationId,
                userId,
            });

            return report;
        } catch (error) {
            this.logger.error('Failed to queue report generation', error.message, {
                type: createReportDto.type,
                organizationId: scope.organizationId,
                userId,
            });
            throw error;
        }
    }

    async getReports(
        filters: ReportFilters,
        scope: DataScope,
        pagination: {
            page: number;
            limit: number;
        } = { page: 1, limit: 20 }
    ) {
        return this.reportRepository.findMany(filters, scope, pagination);
    }

    async getReportById(id: string, scope: DataScope) {
        return this.reportRepository.findById(id, scope);
    }

    async getReportDownloadUrl(id: string, scope: DataScope) {
        const report = await this.reportRepository.findById(id, scope);

        if (!report) {
            throw new Error('Report not found');
        }

        if (report.status !== 'COMPLETED') {
            throw new Error('Report is not ready for download');
        }

        if (!report.filePath) {
            throw new Error('Report file not found');
        }

        // Generate presigned URL for download
        const downloadUrl = await this.storageAdapter.generatePresignedDownloadUrl(
            report.filePath,
            { expiresIn: 3600 } // 1 hour expiry
        );

        return {
            downloadUrl,
            expiresAt: new Date(Date.now() + 3600 * 1000),
        };
    }

    async regenerateReport(id: string, scope: DataScope, userId: string) {
        const existingReport = await this.reportRepository.findById(id, scope);

        if (!existingReport) {
            throw new Error('Report not found');
        }

        // Update existing report to regenerating status
        const report = await this.reportRepository.update(id, {
            status: 'PENDING',
            startedAt: new Date(),
            completedAt: null,
            errorMessage: null,
            fileUrl: null,
            filePath: null,
            fileSize: null,
            recordCount: null,
        });

        // Queue report generation job
        await this.queueProducer.generateReport({
            reportId: report.id,
            type: report.type,
            format: report.format,
            parameters: report.parameters,
            organizationId: scope.organizationId,
            userId,
        });

        this.logger.log('Report regeneration queued', {
            reportId: report.id,
            type: report.type,
            organizationId: scope.organizationId,
            userId,
        });

        return report;
    }

    async updateReportStatus(
        reportId: string,
        status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
        updates: {
            completedAt?: Date;
            errorMessage?: string;
            fileUrl?: string;
            filePath?: string;
            fileSize?: number;
            recordCount?: number;
        } = {}
    ) {
        try {
            const report = await this.reportRepository.update(reportId, {
                status,
                ...updates,
            });

            this.logger.log('Report status updated', {
                reportId,
                status,
                fileSize: updates.fileSize,
                recordCount: updates.recordCount,
            });

            return report;
        } catch (error) {
            this.logger.error('Failed to update report status', error.message, {
                reportId,
                status,
            });
            throw error;
        }
    }

    async getAvailableReportTypes() {
        return [
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
                    {
                        name: 'branchId',
                        type: 'string',
                        required: false,
                        description: 'Filter by specific branch',
                    },
                    {
                        name: 'includeDetails',
                        type: 'boolean',
                        required: false,
                        description: 'Include detailed check-in/check-out times',
                    },
                ],
            },
            {
                type: 'WEEKLY_ATTENDANCE',
                name: 'Weekly Attendance Report',
                description: 'Weekly attendance summary with daily breakdowns',
                parameters: [
                    {
                        name: 'startDate',
                        type: 'date',
                        required: true,
                        description: 'Start date of the week (YYYY-MM-DD)',
                    },
                    {
                        name: 'branchId',
                        type: 'string',
                        required: false,
                        description: 'Filter by specific branch',
                    },
                    {
                        name: 'includeSummary',
                        type: 'boolean',
                        required: false,
                        description: 'Include weekly summary statistics',
                    },
                ],
            },
            {
                type: 'MONTHLY_ATTENDANCE',
                name: 'Monthly Attendance Report',
                description: 'Comprehensive monthly attendance report',
                parameters: [
                    {
                        name: 'year',
                        type: 'number',
                        required: true,
                        description: 'Year for the report',
                    },
                    {
                        name: 'month',
                        type: 'number',
                        required: true,
                        description: 'Month for the report (1-12)',
                    },
                    {
                        name: 'branchId',
                        type: 'string',
                        required: false,
                        description: 'Filter by specific branch',
                    },
                    {
                        name: 'includeSummary',
                        type: 'boolean',
                        required: false,
                        description: 'Include monthly summary statistics',
                    },
                ],
            },
            {
                type: 'EMPLOYEE_LIST',
                name: 'Employee List Report',
                description: 'Complete list of employees with details',
                parameters: [
                    {
                        name: 'branchId',
                        type: 'string',
                        required: false,
                        description: 'Filter by specific branch',
                    },
                    {
                        name: 'departmentId',
                        type: 'string',
                        required: false,
                        description: 'Filter by specific department',
                    },
                    {
                        name: 'isActive',
                        type: 'boolean',
                        required: false,
                        description: 'Filter by active status',
                    },
                    {
                        name: 'includeContactInfo',
                        type: 'boolean',
                        required: false,
                        description: 'Include contact information',
                    },
                ],
            },
            {
                type: 'DEVICE_STATUS',
                name: 'Device Status Report',
                description: 'Status and health report for all devices',
                parameters: [
                    {
                        name: 'branchId',
                        type: 'string',
                        required: false,
                        description: 'Filter by specific branch',
                    },
                    {
                        name: 'deviceType',
                        type: 'string',
                        required: false,
                        description: 'Filter by device type',
                    },
                    {
                        name: 'includeOffline',
                        type: 'boolean',
                        required: false,
                        description: 'Include offline devices',
                    },
                ],
            },
            {
                type: 'GUEST_VISITS',
                name: 'Guest Visits Report',
                description: 'Report of guest visits and approvals',
                parameters: [
                    {
                        name: 'startDate',
                        type: 'date',
                        required: true,
                        description: 'Start date for the report',
                    },
                    {
                        name: 'endDate',
                        type: 'date',
                        required: true,
                        description: 'End date for the report',
                    },
                    {
                        name: 'branchId',
                        type: 'string',
                        required: false,
                        description: 'Filter by specific branch',
                    },
                    {
                        name: 'status',
                        type: 'string',
                        required: false,
                        description: 'Filter by visit status',
                    },
                ],
            },
            {
                type: 'SECURITY_AUDIT',
                name: 'Security Audit Report',
                description: 'Security events and audit trail report',
                parameters: [
                    {
                        name: 'startDate',
                        type: 'date',
                        required: true,
                        description: 'Start date for the audit period',
                    },
                    {
                        name: 'endDate',
                        type: 'date',
                        required: true,
                        description: 'End date for the audit period',
                    },
                    {
                        name: 'severity',
                        type: 'string',
                        required: false,
                        description: 'Filter by severity level',
                    },
                    {
                        name: 'includeDetails',
                        type: 'boolean',
                        required: false,
                        description: 'Include detailed event information',
                    },
                ],
            },
            {
                type: 'CUSTOM_QUERY',
                name: 'Custom Query Report',
                description: 'Custom report based on user-defined parameters',
                parameters: [
                    {
                        name: 'query',
                        type: 'object',
                        required: true,
                        description: 'Custom query parameters',
                    },
                    {
                        name: 'columns',
                        type: 'array',
                        required: false,
                        description: 'Columns to include in the report',
                    },
                ],
            },
        ];
    }

    async getReportStats(scope: DataScope) {
        return this.reportRepository.getReportStats(scope);
    }

    async deleteReport(id: string, scope: DataScope) {
        const report = await this.reportRepository.findById(id, scope);

        if (!report) {
            throw new Error('Report not found');
        }

        // Delete file from storage if exists
        if (report.filePath) {
            try {
                await this.storageAdapter.deleteFile(report.filePath);
            } catch (error) {
                this.logger.warn('Failed to delete report file from storage', {
                    reportId: id,
                    filePath: report.filePath,
                    error: error.message,
                });
            }
        }

        // Delete report record
        await this.reportRepository.delete(id);

        this.logger.log('Report deleted', {
            reportId: id,
            organizationId: scope.organizationId,
        });
    }

    async cleanupOldReports(olderThanDays: number, organizationId?: string): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const oldReports = await this.reportRepository.findOldReports(cutoffDate, organizationId);

        let deletedCount = 0;

        for (const report of oldReports) {
            try {
                // Delete file from storage
                if (report.filePath) {
                    await this.storageAdapter.deleteFile(report.filePath);
                }

                // Delete report record
                await this.reportRepository.delete(report.id);
                deletedCount++;
            } catch (error) {
                this.logger.error('Failed to delete old report', error.message, {
                    reportId: report.id,
                    filePath: report.filePath,
                });
            }
        }

        this.logger.log('Old reports cleanup completed', {
            deletedCount,
            olderThanDays,
            organizationId,
        });

        return deletedCount;
    }
}
