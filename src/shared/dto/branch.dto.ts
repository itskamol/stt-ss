import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBranchDto {
    @ApiProperty({
        description: 'The name of the branch.',
        example: 'Main Branch',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty({
        description: 'The physical address of the branch.',
        example: '123 Main St, Anytown, USA',
        maxLength: 500,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;
}

export class UpdateBranchDto {
    @ApiProperty({
        description: 'The new name for the branch.',
        example: 'Downtown Branch',
        maxLength: 100,
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name?: string;

    @ApiProperty({
        description: 'The new physical address for the branch.',
        example: '456 Oak Ave, Anytown, USA',
        maxLength: 500,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;
}

export class BranchResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the branch.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The ID of the organization this branch belongs to.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    organizationId: string;

    @ApiProperty({
        description: 'The name of the branch.',
        example: 'Main Branch',
    })
    name: string;

    @ApiProperty({
        description: 'The physical address of the branch.',
        example: '123 Main St, Anytown, USA',
        required: false,
    })
    address?: string;

    @ApiProperty({
        description: 'The date and time when the branch was created.',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time when the branch was last updated.',
        example: '2023-08-14T10:00:00.000Z',
    })
    updatedAt: Date;
}

export class AssignBranchManagerDto {
    @ApiProperty({
        description: 'The ID of the user to be assigned as the branch manager.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    @IsNotEmpty()
    managerId: string;

    @ApiProperty({
        description: 'The ID of the branch to which the manager will be assigned.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    @IsNotEmpty()
    branchId: string;
}

export class AssignBranchManagerBodyDto {
    @ApiProperty({
        description: 'ID of the user to be assigned as manager.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    @IsNotEmpty()
    managerId: string;
}

export class BranchCountResponseDto {
    @ApiProperty({
        description: 'The total number of branches.',
        example: 10,
    })
    count: number;
}

export class BranchStatsResponseDto extends BranchResponseDto {
    @ApiProperty({
        description: 'The number of employees in the branch.',
        example: 50,
    })
    employeeCount: number;

    @ApiProperty({
        description: 'The number of devices in the branch.',
        example: 10,
    })
    deviceCount: number;
}

export class ManagedBranchResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the managed branch assignment.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The ID of the manager.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    managerId: string;

    @ApiProperty({
        description: 'The ID of the branch.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    branchId: string;

    @ApiProperty({
        description: 'The date and time when the manager was assigned.',
        example: '2023-08-14T10:00:00.000Z',
    })
    assignedAt: Date;
}

class BranchManagerUserDto {
    @ApiProperty({
        description: 'The ID of the manager.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The email of the manager.',
        example: 'manager@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'The full name of the manager.',
        example: 'John Doe',
    })
    fullName: string;

    @ApiProperty({
        description: 'The role of the manager.',
        example: 'BRANCH_MANAGER',
    })
    role: string;
}

export class BranchManagerResponseDto extends ManagedBranchResponseDto {
    @ApiProperty({
        description: 'The manager details.',
        type: BranchManagerUserDto,
    })
    manager: BranchManagerUserDto;
}
