import { Inject, Injectable } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggerService } from '../../logger/logger.service';
import { BaseJobProcessor } from './base.processor';
import { ReportGenerationData } from '../queue.producer';
import { ReportingService } from '../../../modules/reporting/reporting.service';
import { AttendanceService } from '../../../modules/attendance/attendance.service';
import { EmployeeService } from '../../../modules/employee/employee.service';
import { DeviceService } from '../../../modules/device/device.service';
import { GuestService } from '../../../modules/guest/guest.service';
import { AuditLogService } from '../../../shared/services/audit-log.service';
import { IStorageAdapter } from '../../../shared/adapters/storage.adapter';
import { INotificationAdapter } from '../../../shared/adapters/notification.adapter';
import { DataScope } from '../../../shared/interfaces';

@Injectable()
@Processor('exports')
export class ReportGenerationProcessor extends BaseJobProcessor<ReportGenerationData> {
    constructor(
        protected readonly logger: LoggerService,
        private readonly reportingService: ReportingService,
        private readonly attendanceService: AttendanceService,
        private readonly employeeService: EmployeeService,
        private readonly deviceService: DeviceService,
        private readonly guestService: GuestService,
        private readonly auditLogService: AuditLogService,
        @Inject('IStorageAdapter') private readonly storageAdapter: IStorageAdapter,
        @Inject('INotificationAdapter') private readonly notificationAdapter: INotificationAdapter
    ) {
        super(logger);
    }

    async process(job: Job<ReportGenerationData>): Promise<any> {
        switch (job.name) {
            case 'generate-report':
                return this.generateReport(job);
            default:
                throw new Error(`Unknown job type: ${job.name}`);
        }
    }

    protected async execute(job: Job<ReportGenerationData>): Promise<any> {
        const { data } = job;
        const startTime = Date.now();

        await this.updateProgress(job, 5, 'Starting report generation');

        try {
            // Update report status to processing
            await this.reportingService.updateReportStatus(data.reportId, 'PROCESSING');

            await this.updateProgress(job, 10, 'Generating report data');

            // Generate report based on type
            let reportData: any;
            let fileName: string;
            let recordCount = 0;

            const scope: DataScope = {
                organizationId: data.organizationId,
                branchIds: [], // Will be populated based on user permissions
            };

            switch (data.type) {
                case 'DAILY_ATTENDANCE':
                    ({ reportData, fileName, recordCount } =
                        await this.generateDailyAttendanceReport(data, scope, job));
                    break;
                case 'WEEKLY_ATTENDANCE':
                    ({ reportData, fileName, recordCount } =
                        await this.generateWeeklyAttendanceReport(data, scope, job));
                    break;
                case 'MONTHLY_ATTENDANCE':
                    ({ reportData, fileName, recordCount } =
                        await this.generateMonthlyAttendanceReport(data, scope, job));
                    break;
                case 'EMPLOYEE_LIST':
                    ({ reportData, fileName, recordCount } = await this.generateEmployeeListReport(
                        data,
                        scope,
                        job
                    ));
                    break;
                case 'DEVICE_STATUS':
                    ({ reportData, fileName, recordCount } = await this.generateDeviceStatusReport(
                        data,
                        scope,
                        job
                    ));
                    break;
                case 'GUEST_VISITS':
                    ({ reportData, fileName, recordCount } = await this.generateGuestVisitsReport(
                        data,
                        scope,
                        job
                    ));
                    break;
                case 'SECURITY_AUDIT':
                    ({ reportData, fileName, recordCount } = await this.generateSecurityAuditReport(
                        data,
                        scope,
                        job
                    ));
                    break;
                default:
                    throw new Error(`Unsupported report type: ${data.type}`);
            }

            await this.updateProgress(job, 70, 'Uploading report file');

            // Upload file to storage
            const filePath = `reports/${data.organizationId}/${data.reportId}/${fileName}`;
            const uploadResult = await this.storageAdapter.uploadFile(
                filePath,
                Buffer.from(reportData),
                this.getContentType(data.format)
            );

            await this.updateProgress(job, 85, 'Finalizing report');

            // Generate presigned URL for download
            const fileUrl = await this.storageAdapter.generatePresignedDownloadUrl(filePath, {
                expiresIn: 7 * 24 * 60 * 60, // 7 days
            });

            // Update report with completion details
            await this.reportingService.updateReportStatus(data.reportId, 'COMPLETED', {
                completedAt: new Date(),
                fileUrl,
                filePath,
                fileSize: Buffer.byteLength(reportData),
                recordCount,
            });

            await this.updateProgress(job, 95, 'Sending notification');

            // Send completion notification
            await this.sendCompletionNotification(data, fileName, recordCount);

            await this.updateProgress(job, 100, 'Report generation complete');

            const processingTime = Date.now() - startTime;
            return {
                reportId: data.reportId,
                fileName,
                fileSize: Buffer.byteLength(reportData),
                recordCount,
                processingTime,
                fileUrl,
            };
        } catch (error) {
            // Update report status to failed
            await this.reportingService.updateReportStatus(data.reportId, 'FAILED', {
                completedAt: new Date(),
                errorMessage: error.message,
            });

            // Send failure notification
            await this.sendFailureNotification(data, error.message);

            throw error;
        }
    }

    private async generateReport(job: Job<ReportGenerationData>) {
        return this.execute(job);
    }

    private async generateDailyAttendanceReport(
        data: ReportGenerationData,
        scope: DataScope,
        job: Job
    ) {
        const { date, branchId, includeDetails } = data.parameters;
        const reportDate = new Date(date);

        await this.updateProgress(job, 20, 'Fetching attendance data');

        const attendanceReport = await this.attendanceService.getDailyAttendanceReport(
            reportDate,
            branchId,
            scope
        );

        await this.updateProgress(job, 50, 'Formatting report data');

        let reportData: string;
        let fileName: string;

        if (data.format === 'CSV') {
            reportData = this.formatDailyAttendanceCSV(attendanceReport, includeDetails);
            fileName = `daily-attendance-${date}.csv`;
        } else {
            throw new Error(`Format ${data.format} not supported for daily attendance reports`);
        }

        return {
            reportData,
            fileName,
            recordCount: attendanceReport.employeeDetails.length,
        };
    }

    private async generateWeeklyAttendanceReport(
        data: ReportGenerationData,
        scope: DataScope,
        job: Job
    ) {
        const { startDate, branchId, includeSummary } = data.parameters;
        const weekStartDate = new Date(startDate);

        await this.updateProgress(job, 20, 'Fetching weekly attendance data');

        const weeklyReport = await this.attendanceService.getWeeklyAttendanceReport(
            weekStartDate,
            branchId,
            scope
        );

        await this.updateProgress(job, 50, 'Formatting report data');

        let reportData: string;
        let fileName: string;

        if (data.format === 'CSV') {
            reportData = this.formatWeeklyAttendanceCSV(weeklyReport, includeSummary);
            fileName = `weekly-attendance-${startDate}.csv`;
        } else {
            throw new Error(`Format ${data.format} not supported for weekly attendance reports`);
        }

        const totalRecords = weeklyReport.dailyReports.reduce(
            (sum, daily) => sum + daily.employeeDetails.length,
            0
        );

        return {
            reportData,
            fileName,
            recordCount: totalRecords,
        };
    }

    private async generateMonthlyAttendanceReport(
        data: ReportGenerationData,
        scope: DataScope,
        job: Job
    ) {
        const { year, month, branchId, includeSummary } = data.parameters;

        await this.updateProgress(job, 20, 'Fetching monthly attendance data');

        const monthlyReport = await this.attendanceService.getMonthlyAttendanceReport(
            year,
            month,
            branchId,
            scope
        );

        await this.updateProgress(job, 50, 'Formatting report data');

        let reportData: string;
        let fileName: string;

        if (data.format === 'CSV') {
            reportData = this.formatMonthlyAttendanceCSV(monthlyReport, includeSummary);
            fileName = `monthly-attendance-${year}-${month.toString().padStart(2, '0')}.csv`;
        } else {
            throw new Error(`Format ${data.format} not supported for monthly attendance reports`);
        }

        return {
            reportData,
            fileName,
            recordCount: monthlyReport.employeeReports.length,
        };
    }

    private async generateEmployeeListReport(
        data: ReportGenerationData,
        scope: DataScope,
        job: Job
    ) {
        const { branchId, departmentId, isActive, includeContactInfo } = data.parameters;

        await this.updateProgress(job, 20, 'Fetching employee data');

        const employees = await this.employeeService.getEmployees(scope);

        // Apply filters
        let filteredEmployees = employees;
        if (branchId) {
            filteredEmployees = filteredEmployees.filter(emp => emp.branchId === branchId);
        }
        if (departmentId) {
            filteredEmployees = filteredEmployees.filter(emp => emp.departmentId === departmentId);
        }
        if (isActive !== undefined) {
            filteredEmployees = filteredEmployees.filter(emp => emp.isActive === isActive);
        }

        await this.updateProgress(job, 50, 'Formatting report data');

        let reportData: string;
        let fileName: string;

        if (data.format === 'CSV') {
            reportData = this.formatEmployeeListCSV(filteredEmployees, includeContactInfo);
            fileName = 'employee-list.csv';
        } else {
            throw new Error(`Format ${data.format} not supported for employee list reports`);
        }

        return {
            reportData,
            fileName,
            recordCount: filteredEmployees.length,
        };
    }

    private async generateDeviceStatusReport(
        data: ReportGenerationData,
        scope: DataScope,
        job: Job
    ) {
        const { branchId, deviceType, includeOffline } = data.parameters;

        await this.updateProgress(job, 20, 'Fetching device data');

        const devices = await this.deviceService.getDevices(scope);

        // Apply filters
        let filteredDevices = devices;
        if (branchId) {
            filteredDevices = filteredDevices.filter(device => device.branchId === branchId);
        }
        if (deviceType) {
            filteredDevices = filteredDevices.filter(device => device.type === deviceType);
        }
        if (!includeOffline) {
            filteredDevices = filteredDevices.filter(device => device.status === 'ONLINE');
        }

        await this.updateProgress(job, 50, 'Formatting report data');

        let reportData: string;
        let fileName: string;

        if (data.format === 'CSV') {
            reportData = this.formatDeviceStatusCSV(filteredDevices);
            fileName = 'device-status.csv';
        } else {
            throw new Error(`Format ${data.format} not supported for device status reports`);
        }

        return {
            reportData,
            fileName,
            recordCount: filteredDevices.length,
        };
    }

    private async generateGuestVisitsReport(
        data: ReportGenerationData,
        scope: DataScope,
        job: Job
    ) {
        const { startDate, endDate, branchId, status } = data.parameters;

        await this.updateProgress(job, 20, 'Fetching guest visit data');

        const filters = {
            branchId,
            status,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
        };

        const guestVisits = await this.guestService.getGuestVisits(filters, scope);

        await this.updateProgress(job, 50, 'Formatting report data');

        let reportData: string;
        let fileName: string;

        if (data.format === 'CSV') {
            reportData = this.formatGuestVisitsCSV(guestVisits);
            fileName = `guest-visits-${startDate}-to-${endDate}.csv`;
        } else {
            throw new Error(`Format ${data.format} not supported for guest visits reports`);
        }

        return {
            reportData,
            fileName,
            recordCount: guestVisits.length,
        };
    }

    private async generateSecurityAuditReport(
        data: ReportGenerationData,
        scope: DataScope,
        job: Job
    ) {
        const { startDate, endDate, severity, includeDetails } = data.parameters;

        await this.updateProgress(job, 20, 'Fetching security audit data');

        const filters = {
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            severity,
        };

        const securityEvents = await this.auditLogService.getSecurityEvents(filters, scope, {
            page: 1,
            limit: 10000,
        });

        await this.updateProgress(job, 50, 'Formatting report data');

        let reportData: string;
        let fileName: string;

        if (data.format === 'CSV') {
            reportData = this.formatSecurityAuditCSV(securityEvents.data, includeDetails);
            fileName = `security-audit-${startDate}-to-${endDate}.csv`;
        } else {
            throw new Error(`Format ${data.format} not supported for security audit reports`);
        }

        return {
            reportData,
            fileName,
            recordCount: securityEvents.data.length,
        };
    }

    private formatDailyAttendanceCSV(report: any, includeDetails: boolean): string {
        const headers = [
            'Employee Code',
            'Employee Name',
            'Status',
            'Total Hours',
            'First Check In',
            'Last Check Out',
        ];

        if (includeDetails) {
            headers.push('All Check Ins', 'All Check Outs');
        }

        const rows = report.employeeDetails.map((employee: any) => {
            const row = [
                employee.employee.employeeCode,
                `${employee.employee.firstName} ${employee.employee.lastName}`,
                employee.status,
                employee.totalHours.toString(),
                employee.firstCheckIn ? employee.firstCheckIn.toISOString() : '',
                employee.lastCheckOut ? employee.lastCheckOut.toISOString() : '',
            ];

            if (includeDetails) {
                row.push(
                    employee.checkIns.map((time: Date) => time.toISOString()).join('; '),
                    employee.checkOuts.map((time: Date) => time.toISOString()).join('; ')
                );
            }

            return row;
        });

        return [
            headers.join(','),
            ...rows.map(row => row.map(field => `\"${field}\"`).join(',')),
        ].join('\n');
    }

    private formatWeeklyAttendanceCSV(report: any, includeSummary: boolean): string {
        let csvContent = '';

        if (includeSummary) {
            csvContent += `Weekly Summary\n`;
            csvContent += `Start Date,${report.startDate.toISOString().split('T')[0]}\n`;
            csvContent += `End Date,${report.endDate.toISOString().split('T')[0]}\n`;
            csvContent += `Total Hours,${report.totalHours}\n`;
            csvContent += `Average Daily Hours,${report.averageDailyHours}\n`;
            csvContent += `Total Employees,${report.totalEmployees}\n\n`;
        }

        csvContent += 'Date,Total Employees,Present,Partial,Absent,Total Hours\n';

        report.dailyReports.forEach((daily: any) => {
            csvContent += `${[
                daily.date.toISOString().split('T')[0],
                daily.totalEmployees,
                daily.presentEmployees,
                daily.partialEmployees,
                daily.absentEmployees,
                daily.totalHours,
            ].join(',')}\n`;
        });

        return csvContent;
    }

    private formatMonthlyAttendanceCSV(report: any, includeSummary: boolean): string {
        let csvContent = '';

        if (includeSummary) {
            csvContent += `Monthly Summary\n`;
            csvContent += `Year,${report.year}\n`;
            csvContent += `Month,${report.month}\n`;
            csvContent += `Total Hours,${report.totalHours}\n`;
            csvContent += `Average Hours Per Employee,${report.averageHoursPerEmployee}\n`;
            csvContent += `Total Employees,${report.totalEmployees}\n\n`;
        }

        csvContent += 'Employee Code,Employee Name,Total Hours,Days Worked,Average Hours Per Day\n';

        report.employeeReports.forEach((employee: any) => {
            csvContent += `${[
                employee.employee.employeeCode,
                `${employee.employee.firstName} ${employee.employee.lastName}`,
                employee.totalHours,
                employee.daysWorked,
                employee.averageHoursPerDay,
            ]
                .map((field: any) => `\"${field}\"`)
                .join(',')}\n`;
        });

        return csvContent;
    }

    private formatEmployeeListCSV(employees: any[], includeContactInfo: boolean): string {
        const headers = [
            'Employee Code',
            'First Name',
            'Last Name',
            'Branch ID',
            'Department ID',
            'Status',
            'Created At',
        ];

        if (includeContactInfo) {
            headers.push('Email', 'Phone');
        }

        const rows = employees.map(employee => {
            const row = [
                employee.employeeCode,
                employee.firstName,
                employee.lastName,
                employee.branchId,
                employee.departmentId || '',
                employee.isActive ? 'Active' : 'Inactive',
                employee.createdAt.toISOString(),
            ];

            if (includeContactInfo) {
                row.push(employee.email || '', employee.phone || '');
            }

            return row;
        });

        return [
            headers.join(','),
            ...rows.map(row => row.map(field => `\"${field}\"`).join(',')),
        ].join('\n');
    }

    private formatDeviceStatusCSV(devices: any[]): string {
        const headers = [
            'Device Name',
            'Device Type',
            'Status',
            'Branch ID',
            'IP Address',
            'Last Seen',
            'Created At',
        ];

        const rows = devices.map(device => [
            device.name,
            device.type,
            device.status,
            device.branchId,
            device.ipAddress || '',
            device.lastSeen ? device.lastSeen.toISOString() : '',
            device.createdAt.toISOString(),
        ]);

        return [
            headers.join(','),
            ...rows.map(row => row.map(field => `\"${field}\"`).join(',')),
        ].join('\n');
    }

    private formatGuestVisitsCSV(guestVisits: any[]): string {
        const headers = [
            'Guest Name',
            'Guest Email',
            'Visit Date',
            'Status',
            'Branch ID',
            'Approved By',
            'Created At',
        ];

        const rows = guestVisits.map(visit => [
            visit.guestName,
            visit.guestEmail,
            visit.visitDate.toISOString(),
            visit.status,
            visit.branchId,
            visit.approvedBy || '',
            visit.createdAt.toISOString(),
        ]);

        return [
            headers.join(','),
            ...rows.map(row => row.map(field => `\"${field}\"`).join(',')),
        ].join('\n');
    }

    private formatSecurityAuditCSV(auditLogs: any[], includeDetails: boolean): string {
        const headers = [
            'Timestamp',
            'Action',
            'Resource',
            'User Email',
            'IP Address',
            'Status',
            'Error Message',
        ];

        if (includeDetails) {
            headers.push('User Agent', 'URL', 'Method');
        }

        const rows = auditLogs.map(log => {
            const row = [
                log.timestamp.toISOString(),
                log.action,
                log.resource,
                log.user?.email || '',
                log.ipAddress || '',
                log.status,
                log.errorMessage || '',
            ];

            if (includeDetails) {
                row.push(log.userAgent || '', log.url || '', log.method || '');
            }

            return row;
        });

        return [
            headers.join(','),
            ...rows.map(row => row.map(field => `\"${field}\"`).join(',')),
        ].join('\n');
    }

    private getContentType(format: string): string {
        switch (format) {
            case 'CSV':
                return 'text/csv';
            case 'PDF':
                return 'application/pdf';
            case 'EXCEL':
                return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            case 'JSON':
                return 'application/json';
            default:
                return 'application/octet-stream';
        }
    }

    private async sendCompletionNotification(
        data: ReportGenerationData,
        fileName: string,
        recordCount: number
    ) {
        try {
            // This would typically get the user's email from the database
            // For now, we'll just log the notification
            this.logger.log('Report completion notification', {
                reportId: data.reportId,
                fileName,
                recordCount,
                userId: data.userId,
            });

            // In a real implementation, you would:
            // 1. Get user email from database
            // 2. Send email notification with download link
            // await this.notificationAdapter.sendEmail({
            // to: userEmail,
            // subject: 'Report Ready for Download',
            // html: `Your report \"${fileName}\" is ready for download...`,
            // });
        } catch (error) {
            this.logger.error('Failed to send completion notification', error.message, {
                reportId: data.reportId,
            });
        }
    }

    private async sendFailureNotification(data: ReportGenerationData, errorMessage: string) {
        try {
            this.logger.log('Report failure notification', {
                reportId: data.reportId,
                errorMessage,
                userId: data.userId,
            });

            // In a real implementation, you would send an email notification
        } catch (error) {
            this.logger.error('Failed to send failure notification', error.message, {
                reportId: data.reportId,
            });
        }
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job, result: any) {
        this.logger.log('Report generation completed', {
            jobId: job.id,
            reportId: result.reportId,
            fileName: result.fileName,
            fileSize: result.fileSize,
            recordCount: result.recordCount,
            processingTime: result.processingTime,
        });
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, error: Error) {
        this.logger.error('Report generation failed', error.message, {
            jobId: job.id,
            reportId: job.data.reportId,
            reportType: job.data.type,
            attemptsMade: job.attemptsMade,
            attemptsTotal: job.opts.attempts,
        });
    }

    @OnWorkerEvent('stalled')
    onStalled(jobId: string) {
        this.logger.warn('Report generation stalled', { jobId });
    }
}
