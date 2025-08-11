import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEmployeeDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    firstName: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    lastName: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    employeeCode: string;

    @IsString()
    @IsNotEmpty()
    branchId: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    departmentId?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateEmployeeDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    firstName?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    lastName?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    employeeCode?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    branchId?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    departmentId?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class EmployeeResponseDto {
    id: string;
    organizationId: string;
    branchId: string;
    departmentId?: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    email?: string;
    phone?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
