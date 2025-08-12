import { ReportFormat, ReportStatus, ReportType } from '@prisma/client';

export interface ReportFilters {
    type?: string;
    status?: string;
    createdByUserId?: string;
    startDate?: Date;
    endDate?: Date;
}

export interface CreateReportData {
    name: string;
    type: keyof typeof ReportType;
    format: keyof typeof ReportFormat;
    parameters: Record<string, any>;
    organizationId: string;
    createdByUserId: string;
    status: keyof typeof ReportStatus;
    startedAt: Date;
}

export interface UpdateReportData {
    status?: string;
    startedAt?: Date;
    completedAt?: Date;
    errorMessage?: string;
    fileUrl?: string;
    filePath?: string;
    fileSize?: number;
    recordCount?: number;
}
