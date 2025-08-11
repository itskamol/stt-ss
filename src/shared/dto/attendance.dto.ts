import { IsDateString, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateAttendanceDto {
    @IsString()
    @IsNotEmpty()
    employeeId: string;

    @IsOptional()
    @IsString()
    deviceId?: string;

    @IsString()
    @IsNotEmpty()
    eventType: string;

    @IsDateString()
    timestamp: Date;

    @IsString()
    @IsNotEmpty()
    organizationId: string;

    @IsString()
    @IsNotEmpty()
    branchId: string;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}

export class AttendanceResponseDto {
    id: string;
    organizationId: string;
    branchId: string;
    employeeId?: string;
    guestId?: string;
    deviceId?: string;
    eventType: string;
    timestamp: Date;
    meta?: any;
    createdAt: Date;
    employee?: {
        id: string;
        firstName: string;
        lastName: string;
        employeeCode: string;
    };
    device?: {
        id: string;
        name: string;
        type: string;
    };
}

export class AttendanceSummaryDto {
    employeeId: string;
    startDate: Date;
    endDate: Date;
    totalHours: number;
    presentDays: number;
    partialDays: number;
    absentDays: number;
    dailySummary: Array<{
        date: string;
        checkIn?: Date;
        checkOut?: Date;
        totalHours: number;
        status: 'present' | 'partial' | 'absent';
    }>;
}

export class AttendanceStatsDto {
    totalRecords: number;
    eventsByType: Array<{
        eventType: string;
        count: number;
    }>;
    recordsByEmployee: Array<{
        employeeId?: string;
        employeeName: string;
        count: number;
    }>;
}

export class AttendanceFiltersDto {
    @IsOptional()
    @IsString()
    employeeId?: string;

    @IsOptional()
    @IsString()
    branchId?: string;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}
