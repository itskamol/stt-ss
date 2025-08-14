import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGuestVisitDto {
    @ApiProperty({
        description: 'The name of the guest.',
        example: 'Jane Smith',
    })
    @IsString()
    @IsNotEmpty()
    guestName: string;

    @ApiProperty({
        description: 'The contact information for the guest (e.g., phone number or email).',
        example: 'jane.smith@example.com',
        required: false,
    })
    @IsOptional()
    @IsString()
    guestContact?: string;

    @ApiProperty({
        description: 'The ID of the employee responsible for the guest.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    responsibleEmployeeId?: string;

    @ApiProperty({
        description: 'The ID of the branch for the visit.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    @IsNotEmpty()
    branchId: string;

    @ApiProperty({
        description: 'The scheduled entry time for the visit.',
        example: '2023-08-15T10:00:00.000Z',
    })
    @IsDateString()
    scheduledEntryTime: string;

    @ApiProperty({
        description: 'The scheduled exit time for the visit.',
        example: '2023-08-15T11:00:00.000Z',
    })
    @IsDateString()
    scheduledExitTime: string;
}

export class UpdateGuestVisitDto {
    @ApiProperty({
        description: 'The name of the guest.',
        example: 'Jane Smith',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    guestName?: string;

    @ApiProperty({
        description: 'The contact information for the guest.',
        example: 'jane.smith@example.com',
        required: false,
    })
    @IsOptional()
    @IsString()
    guestContact?: string;

    @ApiProperty({
        description: 'The ID of the employee responsible for the guest.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    responsibleEmployeeId?: string;

    @ApiProperty({
        description: 'The scheduled entry time for the visit.',
        example: '2023-08-15T10:00:00.000Z',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    scheduledEntryTime?: string;

    @ApiProperty({
        description: 'The scheduled exit time for the visit.',
        example: '2023-08-15T11:00:00.000Z',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    scheduledExitTime?: string;
}

export class ApproveGuestVisitDto {
    @ApiProperty({
        description: 'The type of access credential to be issued.',
        enum: ['QR_CODE', 'TEMP_CARD', 'FACE'],
        example: 'QR_CODE',
    })
    @IsString()
    @IsNotEmpty()
    accessCredentialType: 'QR_CODE' | 'TEMP_CARD' | 'FACE';

    @ApiProperty({
        description: 'Additional notes for the approval.',
        example: 'Approved by security manager.',
        required: false,
    })
    @IsOptional()
    @IsString()
    notes?: string;
}

export class GuestVisitResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the guest visit.',
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
        description: 'The name of the guest.',
        example: 'Jane Smith',
    })
    guestName: string;

    @ApiProperty({
        description: 'The contact information for the guest.',
        example: 'jane.smith@example.com',
        required: false,
    })
    guestContact?: string;

    @ApiProperty({
        description: 'The ID of the employee responsible for the guest.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    responsibleEmployeeId?: string;

    @ApiProperty({
        description: 'The scheduled entry time for the visit.',
        example: '2023-08-15T10:00:00.000Z',
    })
    scheduledEntryTime: Date;

    @ApiProperty({
        description: 'The scheduled exit time for the visit.',
        example: '2023-08-15T11:00:00.000Z',
    })
    scheduledExitTime: Date;

    @ApiProperty({
        description: 'The status of the guest visit.',
        example: 'APPROVED',
    })
    status: string;

    @ApiProperty({
        description: 'The type of access credential issued.',
        example: 'QR_CODE',
    })
    accessCredentialType: string;

    @ApiProperty({
        description: 'A hash of the access credential for verification.',
        example: 'a1b2c3d4e5f6...',
        required: false,
    })
    accessCredentialHash?: string;

    @ApiProperty({
        description: 'The raw access credential. Only returned when approving a visit.',
        example: 'data:image/png;base64,...',
        required: false,
    })
    accessCredentials?: string;

    @ApiProperty({
        description: 'The ID of the user who created the visit request.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    createdByUserId: string;

    @ApiProperty({
        description: 'The date and time the visit was created.',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time the visit was last updated.',
        example: '2023-08-14T10:05:00.000Z',
    })
    updatedAt: Date;
}

class VisitsByStatusDto {
    @ApiProperty({
        description: 'The status of the visits.',
        example: 'PENDING',
    })
    status: string;

    @ApiProperty({
        description: 'The number of visits with this status.',
        example: 10,
    })
    count: number;
}

class VisitsByBranchDto {
    @ApiProperty({
        description: 'The ID of the branch.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    branchId: string;

    @ApiProperty({
        description: 'The name of the branch.',
        example: 'Main Branch',
    })
    branchName: string;

    @ApiProperty({
        description: 'The number of visits to this branch.',
        example: 25,
    })
    count: number;
}

export class GuestVisitStatsDto {
    @ApiProperty({
        description: 'The total number of guest visits.',
        example: 100,
    })
    totalVisits: number;

    @ApiProperty({
        description: 'A breakdown of visits by status.',
        type: [VisitsByStatusDto],
    })
    visitsByStatus: VisitsByStatusDto[];

    @ApiProperty({
        description: 'A breakdown of visits by branch.',
        type: [VisitsByBranchDto],
    })
    visitsByBranch: VisitsByBranchDto[];
}

export class GuestVisitFiltersDto {
    @ApiProperty({
        description: 'Filter by visit status.',
        example: 'PENDING',
        required: false,
    })
    @IsOptional()
    @IsString()
    status?: string;

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

export class RejectGuestVisitDto {
    @ApiProperty({
        description: 'The reason for rejecting the visit.',
        example: 'Scheduling conflict.',
    })
    @IsString()
    @IsNotEmpty()
    reason: string;

    @ApiProperty({
        description: 'Additional notes for the rejection.',
        example: 'Please reschedule for next week.',
        required: false,
    })
    @IsOptional()
    @IsString()
    notes?: string;
}
