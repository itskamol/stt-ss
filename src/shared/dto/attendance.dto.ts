import { ApiProperty } from '@nestjs/swagger';
import { AttendanceEventType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateAttendanceDto {
    @ApiProperty({
        description: 'The ID of the employee.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    @IsNotEmpty()
    employeeId: string;

    @ApiProperty({
        description: 'The ID of the device that captured the event.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    deviceId?: string;

    @ApiProperty({
        description: 'The type of attendance event.',
        enum: AttendanceEventType,
        example: AttendanceEventType.CHECK_IN,
    })
    @IsString()
    @IsEnum(AttendanceEventType)
    @IsNotEmpty()
    eventType: keyof typeof AttendanceEventType;

    @ApiProperty({
        description: 'The timestamp of the attendance event.',
        example: '2023-08-14T09:00:00.000Z',
    })
    @IsDateString()
    timestamp: Date;

    @ApiProperty({
        description: 'The ID of the organization.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    @IsNotEmpty()
    organizationId: string;

    @ApiProperty({
        description: 'The ID of the branch.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    @IsNotEmpty()
    branchId: string;

    @ApiProperty({
        description: 'Additional metadata for the event.',
        example: { source: 'manual' },
        required: false,
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}

class EmployeeForAttendanceResponseDto {
    @ApiProperty({
        description: "The employee's ID.",
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: "The employee's first name.",
        example: 'John',
    })
    firstName: string;

    @ApiProperty({
        description: "The employee's last name.",
        example: 'Doe',
    })
    lastName: string;

    @ApiProperty({
        description: "The employee's code.",
        example: 'EMP123',
    })
    employeeCode: string;
}

class DeviceForAttendanceResponseDto {
    @ApiProperty({
        description: 'The ID of the device.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The name of the device.',
        example: 'Main Entrance',
    })
    name: string;

    @ApiProperty({
        description: 'The type of the device.',
        example: 'ACCESS_CONTROL',
    })
    type: string;
}

export class AttendanceResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the attendance record.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The ID of the organization.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    organizationId: string;

    @ApiProperty({
        description: 'The ID of the branch.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    branchId: string;

    @ApiProperty({
        description: 'The ID of the employee.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    employeeId?: string;

    @ApiProperty({
        description: 'The ID of the guest.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    guestId?: string;

    @ApiProperty({
        description: 'The ID of the device.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    deviceId?: string;

    @ApiProperty({
        description: 'The type of attendance event.',
        example: 'CHECK_IN',
    })
    eventType: string;

    @ApiProperty({
        description: 'The timestamp of the event.',
        example: '2023-08-14T09:00:00.000Z',
    })
    timestamp: Date;

    @ApiProperty({
        description: 'Additional metadata.',
        example: { source: 'manual' },
        required: false,
    })
    meta?: any;

    @ApiProperty({
        description: 'The date and time the record was created.',
        example: '2023-08-14T09:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The employee associated with the record.',
        type: EmployeeForAttendanceResponseDto,
        required: false,
    })
    employee?: EmployeeForAttendanceResponseDto;

    @ApiProperty({
        description: 'The device associated with the record.',
        type: DeviceForAttendanceResponseDto,
        required: false,
    })
    device?: DeviceForAttendanceResponseDto;
}

class DailySummaryDto {
    @ApiProperty({
        description: 'The date for the summary.',
        example: '2023-08-14',
    })
    date: string;

    @ApiProperty({
        description: 'The check-in time for the day.',
        example: '2023-08-14T09:00:00.000Z',
        required: false,
    })
    checkIn?: Date;

    @ApiProperty({
        description: 'The check-out time for the day.',
        example: '2023-08-14T17:00:00.000Z',
        required: false,
    })
    checkOut?: Date;

    @ApiProperty({
        description: 'The total hours worked.',
        example: 8,
    })
    totalHours: number;

    @ApiProperty({
        description: 'The attendance status for the day.',
        enum: ['present', 'partial', 'absent'],
        example: 'present',
    })
    status: 'present' | 'partial' | 'absent';
}

export class AttendanceSummaryDto {
    @ApiProperty({
        description: 'The ID of the employee.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    employeeId: string;

    @ApiProperty({
        description: 'The start date of the summary period.',
        example: '2023-08-01T00:00:00.000Z',
    })
    startDate: Date;

    @ApiProperty({
        description: 'The end date of the summary period.',
        example: '2023-08-31T23:59:59.999Z',
    })
    endDate: Date;

    @ApiProperty({
        description: 'The total hours worked during the period.',
        example: 160,
    })
    totalHours: number;

    @ApiProperty({
        description: 'The number of present days.',
        example: 20,
    })
    presentDays: number;

    @ApiProperty({
        description: 'The number of partial days.',
        example: 1,
    })
    partialDays: number;

    @ApiProperty({
        description: 'The number of absent days.',
        example: 1,
    })
    absentDays: number;

    @ApiProperty({
        description: 'A summary for each day in the period.',
        type: [DailySummaryDto],
    })
    dailySummary: DailySummaryDto[];
}

class EventsByTypeDto {
    @ApiProperty({
        description: 'The type of event.',
        example: 'CHECK_IN',
    })
    eventType: string;

    @ApiProperty({
        description: 'The number of events of this type.',
        example: 22,
    })
    count: number;
}

class RecordsByEmployeeDto {
    @ApiProperty({
        description: 'The ID of the employee.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    employeeId?: string;

    @ApiProperty({
        description: 'The name of the employee.',
        example: 'John Doe',
    })
    employeeName: string;

    @ApiProperty({
        description: 'The number of records for this employee.',
        example: 44,
    })
    count: number;
}

export class AttendanceStatsDto {
    @ApiProperty({
        description: 'The total number of attendance records.',
        example: 1234,
    })
    totalRecords: number;

    @ApiProperty({
        description: 'A breakdown of events by type.',
        type: [EventsByTypeDto],
    })
    eventsByType: EventsByTypeDto[];

    @ApiProperty({
        description: 'A breakdown of records by employee.',
        type: [RecordsByEmployeeDto],
    })
    recordsByEmployee: RecordsByEmployeeDto[];
}

export class AttendanceFiltersDto {
    @ApiProperty({
        description: 'Filter by employee ID.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    employeeId?: string;

    @ApiProperty({
        description: 'Filter by branch ID.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    branchId?: string;

    @ApiProperty({
        description: 'The start date for the filter range.',
        example: '2023-08-01',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiProperty({
        description: 'The end date for the filter range.',
        example: '2023-08-31',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;
}
