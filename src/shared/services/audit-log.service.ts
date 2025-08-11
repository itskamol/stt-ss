import { Injectable } from '@nestjs/common';
import { AuditLogRepository } from './audit-log.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { DataScope } from '../interfaces';

export interface CreateAuditLogData {
    action: string;
    resource: string;
    resourceId?: string;
    userId?: string;
    organizationId?: string;
    method: string;
    url: string;
    userAgent?: string;
    ipAddress?: string;
    requestData?: any;
    responseData?: any;
    status: 'SUCCESS' | 'FAILED';
    duration: number;
    timestamp: Date;
    errorMessage?: string;
    errorStack?: string;
    oldValues?: any;
    newValues?: any;
}

@Injectable()
export class AuditLogService {
    constructor(
        private readonly auditLogRepository: AuditLogRepository,
        private readonly logger: LoggerService
    ) {}

    async createAuditLog(data: CreateAuditLogData) {
        try {
            const auditLog = await this.auditLogRepository.create({
                action: data.action,
                resource: data.resource,
                resourceId: data.resourceId,
                userId: data.userId,
                organizationId: data.organizationId,
                method: data.method,
                url: data.url,
                userAgent: data.userAgent,
                ipAddress: data.ipAddress,
                requestData: data.requestData,
                responseData: data.responseData,
                status: data.status,
                duration: data.duration,
                timestamp: data.timestamp,
                errorMessage: data.errorMessage,
                errorStack: data.errorStack,
                oldValues: data.oldValues,
                newValues: data.newValues,
            });

            this.logger.debug('Audit log created', {
                auditLogId: auditLog.id,
                action: data.action,
                resource: data.resource,
                userId: data.userId,
                organizationId: data.organizationId,
            });

            return auditLog;
        } catch (error) {
            this.logger.error('Failed to create audit log', error.message, {
                action: data.action,
                resource: data.resource,
                userId: data.userId,
                organizationId: data.organizationId,
            });
            // Don't throw error to avoid breaking the main operation
        }
    }

    async getAuditLogs(
        filters: {
            userId?: string;
            resource?: string;
            action?: string;
            resourceId?: string;
            startDate?: Date;
            endDate?: Date;
            status?: string;
        },
        scope: DataScope,
        pagination: {
            page: number;
            limit: number;
        } = { page: 1, limit: 50 }
    ) {
        return this.auditLogRepository.findMany(filters, scope, pagination);
    }

    async getAuditLogById(id: string, scope: DataScope) {
        return this.auditLogRepository.findById(id, scope);
    }

    async getAuditLogStats(
        filters: {
            startDate?: Date;
            endDate?: Date;
        },
        scope: DataScope
    ) {
        return this.auditLogRepository.getAuditLogStats(filters, scope);
    }

    async getUserActivitySummary(userId: string, startDate: Date, endDate: Date, scope: DataScope) {
        const auditLogs = await this.auditLogRepository.findMany(
            {
                userId,
                startDate,
                endDate,
            },
            scope,
            { page: 1, limit: 1000 } // Get more records for analysis
        );

        // Group by action and resource
        const activitySummary = new Map<
            string,
            {
                action: string;
                resource: string;
                count: number;
                lastActivity: Date;
                successCount: number;
                failureCount: number;
            }
        >();

        auditLogs.data.forEach(log => {
            const key = `${log.action}:${log.resource}`;

            if (!activitySummary.has(key)) {
                activitySummary.set(key, {
                    action: log.action,
                    resource: log.resource,
                    count: 0,
                    lastActivity: log.timestamp,
                    successCount: 0,
                    failureCount: 0,
                });
            }

            const summary = activitySummary.get(key)!;
            summary.count++;

            if (log.timestamp > summary.lastActivity) {
                summary.lastActivity = log.timestamp;
            }

            if (log.status === 'SUCCESS') {
                summary.successCount++;
            } else {
                summary.failureCount++;
            }
        });

        return {
            userId,
            startDate,
            endDate,
            totalActivities: auditLogs.total,
            activities: Array.from(activitySummary.values()).sort(
                (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()
            ),
        };
    }

    async getResourceHistory(
        resource: string,
        resourceId: string,
        scope: DataScope,
        pagination: {
            page: number;
            limit: number;
        } = { page: 1, limit: 50 }
    ) {
        return this.auditLogRepository.findMany(
            {
                resource,
                resourceId,
            },
            scope,
            pagination
        );
    }

    async getSecurityEvents(
        filters: {
            startDate?: Date;
            endDate?: Date;
            severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        },
        scope: DataScope,
        pagination: {
            page: number;
            limit: number;
        } = { page: 1, limit: 50 }
    ) {
        // Define security-related actions
        const securityActions = [
            'LOGIN',
            'LOGOUT',
            'LOGIN_FAILED',
            'PASSWORD_CHANGE',
            'PERMISSION_DENIED',
            'UNAUTHORIZED_ACCESS',
            'TOKEN_REFRESH',
            'ACCOUNT_LOCKED',
            'SUSPICIOUS_ACTIVITY',
        ];

        const auditLogs = await this.auditLogRepository.findMany(
            {
                startDate: filters.startDate,
                endDate: filters.endDate,
            },
            scope,
            { page: 1, limit: 10000 } // Get more records for filtering
        );

        // Filter for security events
        const securityEvents = auditLogs.data.filter(
            log =>
                securityActions.some(action => log.action.includes(action)) ||
                log.status === 'FAILED'
        );

        // Apply pagination to filtered results
        const startIndex = (pagination.page - 1) * pagination.limit;
        const endIndex = startIndex + pagination.limit;
        const paginatedEvents = securityEvents.slice(startIndex, endIndex);

        return {
            data: paginatedEvents,
            total: securityEvents.length,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: Math.ceil(securityEvents.length / pagination.limit),
        };
    }

    async cleanupOldAuditLogs(olderThanDays: number, organizationId?: string): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        return this.auditLogRepository.deleteOldLogs(cutoffDate, organizationId);
    }

    async exportAuditLogs(
        filters: {
            userId?: string;
            resource?: string;
            action?: string;
            startDate?: Date;
            endDate?: Date;
        },
        scope: DataScope,
        format: 'CSV' | 'JSON' = 'CSV'
    ) {
        const auditLogs = await this.auditLogRepository.findMany(
            filters,
            scope,
            { page: 1, limit: 10000 } // Export limit
        );

        if (format === 'JSON') {
            return {
                format: 'JSON',
                data: auditLogs.data,
                metadata: {
                    exportDate: new Date(),
                    totalRecords: auditLogs.total,
                    filters,
                },
            };
        }

        // Convert to CSV format
        const csvHeaders = [
            'Timestamp',
            'Action',
            'Resource',
            'Resource ID',
            'User ID',
            'Method',
            'URL',
            'Status',
            'Duration (ms)',
            'IP Address',
            'User Agent',
            'Error Message',
        ];

        const csvRows = auditLogs.data.map(log => [
            log.timestamp.toISOString(),
            log.action,
            log.resource,
            log.resourceId || '',
            log.userId || '',
            log.method,
            log.url,
            log.status,
            log.duration.toString(),
            log.ipAddress || '',
            log.userAgent || '',
            log.errorMessage || '',
        ]);

        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.map(field => `\"${field}\"`).join(',')),
        ].join('\\n');

        return {
            format: 'CSV',
            data: csvContent,
            metadata: {
                exportDate: new Date(),
                totalRecords: auditLogs.total,
                filters,
            },
        };
    }
}
