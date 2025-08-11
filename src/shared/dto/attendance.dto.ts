import { ApiProperty } from '@nestjs/swagger';
import { AttendanceEventType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateAttendanceDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    employeeId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    deviceId?: string;

    @ApiProperty()
    @IsString()
    @IsEnum(AttendanceEventType)
    @IsNotEmpty()
    eventType: string;

    @ApiProperty()
    @IsDateString()
    timestamp: Date;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    organizationId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    branchId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}

class EmployeeForAttendanceResponseDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    firstName: string;
    @ApiProperty()
    lastName: string;
    @ApiProperty()
    employeeCode: string;
}

class DeviceForAttendanceResponseDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    name: string;
    @ApiProperty()
    type: string;
}

export class AttendanceResponseDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    organizationId: string;
    @ApiProperty()
    branchId: string;
    @ApiProperty({ required: false })
    employeeId?: string;
    @ApiProperty({ required: false })
    guestId?: string;
    @ApiProperty({ required: false })
    deviceId?: string;
    @ApiProperty()
    eventType: string;
    @ApiProperty()
    timestamp: Date;
    @ApiProperty({ required: false })
    meta?: any;
    @ApiProperty()
    createdAt: Date;

    @ApiProperty({ type: EmployeeForAttendanceResponseDto, required: false })
    employee?: EmployeeForAttendanceResponseDto;

    @ApiProperty({ type: DeviceForAttendanceResponseDto, required: false })
    device?: DeviceForAttendanceResponseDto;
}

class DailySummaryDto {
    @ApiProperty()
    date: string;
    @ApiProperty({ required: false })
    checkIn?: Date;
    @ApiProperty({ required: false })
    checkOut?: Date;
    @ApiProperty()
    totalHours: number;
    @ApiProperty({ enum: ['present', 'partial', 'absent'] })
    status: 'present' | 'partial' | 'absent';
}

export class AttendanceSummaryDto {
    @ApiProperty()
    employeeId: string;
    @ApiProperty()
    startDate: Date;
    @ApiProperty()
    endDate: Date;
    @ApiProperty()
    totalHours: number;
    @ApiProperty()
    presentDays: number;
    @ApiProperty()
    partialDays: number;
    @ApiProperty()
    absentDays: number;
    @ApiProperty({ type: [DailySummaryDto] })
    dailySummary: DailySummaryDto[];
}

class EventsByTypeDto {
    @ApiProperty()
    eventType: string;
    @ApiProperty()
    count: number;
}

class RecordsByEmployeeDto {
    @ApiProperty({ required: false })
    employeeId?: string;
    @ApiProperty()
    employeeName: string;
    @ApiProperty()
    count: number;
}

export class AttendanceStatsDto {
    @ApiProperty()
    totalRecords: number;
    @ApiProperty({ type: [EventsByTypeDto] })
    eventsByType: EventsByTypeDto[];
    @ApiProperty({ type: [RecordsByEmployeeDto] })
    recordsByEmployee: RecordsByEmployeeDto[];
}

export class AttendanceFiltersDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    employeeId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    branchId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    endDate?: string;
}
