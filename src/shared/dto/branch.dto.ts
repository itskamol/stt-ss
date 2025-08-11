import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBranchDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;
}

export class UpdateBranchDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;
}

export class BranchResponseDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    organizationId: string;
    @ApiProperty()
    name: string;
    @ApiProperty({ required: false })
    address?: string;
    @ApiProperty()
    createdAt: Date;
    @ApiProperty()
    updatedAt: Date;
}

export class AssignBranchManagerDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    managerId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    branchId: string;
}

export class AssignBranchManagerBodyDto {
    @ApiProperty({ description: 'ID of the user to be assigned as manager' })
    @IsString()
    @IsNotEmpty()
    managerId: string;
}
