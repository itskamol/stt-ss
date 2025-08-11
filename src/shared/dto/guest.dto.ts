import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGuestVisitDto {
    @IsString()
    @IsNotEmpty()
    guestName: string;

    @IsOptional()
    @IsString()
    guestContact?: string;

    @IsOptional()
    @IsString()
    responsibleEmployeeId?: string;

    @IsString()
    @IsNotEmpty()
    branchId: string;

    @IsDateString()
    scheduledEntryTime: string;

    @IsDateString()
    scheduledExitTime: string;
}

export class UpdateGuestVisitDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    guestName?: string;

    @IsOptional()
    @IsString()
    guestContact?: string;

    @IsOptional()
    @IsString()
    responsibleEmployeeId?: string;

    @IsOptional()
    @IsDateString()
    scheduledEntryTime?: string;

    @IsOptional()
    @IsDateString()
    scheduledExitTime?: string;
}

export class ApproveGuestVisitDto {
    @IsString()
    @IsNotEmpty()
    accessCredentialType: 'QR_CODE' | 'TEMP_CARD' | 'FACE';

    @IsOptional()
    @IsString()
    notes?: string;
}

export class GuestVisitResponseDto {
    id: string;
    organizationId: string;
    branchId: string;
    guestName: string;
    guestContact?: string;
    responsibleEmployeeId?: string;
    scheduledEntryTime: Date;
    scheduledExitTime: Date;
    status: string;
    accessCredentialType: string;
    accessCredentialHash?: string;
    accessCredentials?: string; // Only returned when approving
    createdByUserId: string;
    createdAt: Date;
    updatedAt: Date;
}

export class GuestVisitStatsDto {
    totalVisits: number;
    visitsByStatus: Array<{
        status: string;
        count: number;
    }>;
    visitsByBranch: Array<{
        branchId: string;
        branchName: string;
        count: number;
    }>;
}

export class GuestVisitFiltersDto {
    @IsOptional()
    @IsString()
    status?: string;

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

export class RejectGuestVisitDto {
    @IsString()
    @IsNotEmpty()
    reason: string;

    @IsOptional()
    @IsString()
    notes?: string;
}
