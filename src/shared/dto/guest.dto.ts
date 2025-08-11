import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGuestVisitDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    guestName: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    guestContact?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    responsibleEmployeeId?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    branchId: string;

    @ApiProperty()
    @IsDateString()
    scheduledEntryTime: string;

    @ApiProperty()
    @IsDateString()
    scheduledExitTime: string;
}

export class UpdateGuestVisitDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    guestName?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    guestContact?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    responsibleEmployeeId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    scheduledEntryTime?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    scheduledExitTime?: string;
}

export class ApproveGuestVisitDto {
    @ApiProperty({ enum: ['QR_CODE', 'TEMP_CARD', 'FACE'] })
    @IsString()
    @IsNotEmpty()
    accessCredentialType: 'QR_CODE' | 'TEMP_CARD' | 'FACE';

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;
}

export class GuestVisitResponseDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    organizationId: string;
    @ApiProperty()
    branchId: string;
    @ApiProperty()
    guestName: string;
    @ApiProperty({ required: false })
    guestContact?: string;
    @ApiProperty({ required: false })
    responsibleEmployeeId?: string;
    @ApiProperty()
    scheduledEntryTime: Date;
    @ApiProperty()
    scheduledExitTime: Date;
    @ApiProperty()
    status: string;
    @ApiProperty()
    accessCredentialType: string;
    @ApiProperty({ required: false })
    accessCredentialHash?: string;
    @ApiProperty({ required: false, description: 'Only returned when approving' })
    accessCredentials?: string;
    @ApiProperty()
    createdByUserId: string;
    @ApiProperty()
    createdAt: Date;
    @ApiProperty()
    updatedAt: Date;
}

class VisitsByStatusDto {
    @ApiProperty()
    status: string;
    @ApiProperty()
    count: number;
}

class VisitsByBranchDto {
    @ApiProperty()
    branchId: string;
    @ApiProperty()
    branchName: string;
    @ApiProperty()
    count: number;
}

export class GuestVisitStatsDto {
    @ApiProperty()
    totalVisits: number;
    @ApiProperty({ type: [VisitsByStatusDto] })
    visitsByStatus: VisitsByStatusDto[];
    @ApiProperty({ type: [VisitsByBranchDto] })
    visitsByBranch: VisitsByBranchDto[];
}

export class GuestVisitFiltersDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    status?: string;

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

export class RejectGuestVisitDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    reason: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;
}
