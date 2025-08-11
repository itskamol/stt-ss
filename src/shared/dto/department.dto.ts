import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    branchId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    parentId?: string;
}

export class UpdateDepartmentDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    parentId?: string;
}

export class DepartmentResponseDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    branchId: string;
    @ApiProperty()
    name: string;
    @ApiProperty({ required: false })
    parentId?: string;
    @ApiProperty()
    createdAt: Date;
    @ApiProperty()
    updatedAt: Date;
    @ApiProperty({ type: () => [DepartmentResponseDto], required: false })
    children?: DepartmentResponseDto[];
    @ApiProperty({ type: () => DepartmentResponseDto, required: false })
    parent?: DepartmentResponseDto;
}
