import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @IsString()
    @IsNotEmpty()
    branchId: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    parentId?: string;
}

export class UpdateDepartmentDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    parentId?: string;
}

export class DepartmentResponseDto {
    id: string;
    branchId: string;
    name: string;
    parentId?: string;
    createdAt: Date;
    updatedAt: Date;
    children?: DepartmentResponseDto[];
    parent?: DepartmentResponseDto;
}
