import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBranchDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;
}

export class UpdateBranchDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;
}

export class BranchResponseDto {
    id: string;
    organizationId: string;
    name: string;
    address?: string;
    createdAt: Date;
    updatedAt: Date;
}

export class AssignBranchManagerDto {
    @IsString()
    @IsNotEmpty()
    managerId: string;

    @IsString()
    @IsNotEmpty()
    branchId: string;
}
