import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
    @ApiProperty({
        description: 'The name of the department.',
        example: 'Human Resources',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty({
        description: 'The ID of the branch this department belongs to.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    @IsNotEmpty()
    branchId: string;

    @ApiProperty({
        description: 'The ID of the parent department, if this is a sub-department.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    parentId?: string;
}

export class UpdateDepartmentDto {
    @ApiProperty({
        description: 'The new name for the department.',
        example: 'HR & Administration',
        maxLength: 100,
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name?: string;

    @ApiProperty({
        description: 'The new parent department ID.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    parentId?: string;
}

export class DepartmentResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the department.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The ID of the branch this department belongs to.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    branchId: string;

    @ApiProperty({
        description: 'The name of the department.',
        example: 'Human Resources',
    })
    name: string;

    @ApiProperty({
        description: 'The ID of the parent department, if applicable.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    parentId?: string;

    @ApiProperty({
        description: 'The date and time when the department was created.',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time when the department was last updated.',
        example: '2023-08-14T10:00:00.000Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'A list of child departments.',
        type: () => [DepartmentResponseDto],
        required: false,
    })
    children?: DepartmentResponseDto[];

    @ApiProperty({
        description: 'The parent department.',
        type: () => DepartmentResponseDto,
        required: false,
    })
    parent?: DepartmentResponseDto;
}

export class DepartmentCountResponseDto {
    @ApiProperty({
        description: 'The total number of departments.',
        example: 25,
    })
    count: number;
}

export class DepartmentStatsResponseDto extends DepartmentResponseDto {
    @ApiProperty({
        description: 'The number of employees in the department.',
        example: 15,
    })
    employeeCount: number;
}
