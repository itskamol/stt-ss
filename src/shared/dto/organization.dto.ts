import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
    @ApiProperty({
        description: 'The name of the organization.',
        example: 'Acme Corporation',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty({
        description: 'A brief description of the organization.',
        example: 'A leading manufacturer of widgets.',
        maxLength: 500,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;
}

export class UpdateOrganizationDto {
    @ApiProperty({
        description: 'The new name of the organization.',
        example: 'Acme Inc.',
        maxLength: 100,
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name?: string;

    @ApiProperty({
        description: 'A new description for the organization.',
        example: 'The premier provider of innovative solutions.',
        maxLength: 500,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;
}

export class OrganizationResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the organization.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The name of the organization.',
        example: 'Acme Corporation',
    })
    name: string;

    @ApiProperty({
        description: 'A brief description of the organization.',
        example: 'A leading manufacturer of widgets.',
        required: false,
    })
    description?: string;

    @ApiProperty({
        description: 'The date and time when the organization was created.',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time when the organization was last updated.',
        example: '2023-08-14T10:00:00.000Z',
    })
    updatedAt: Date;
}

export class OrganizationCountResponseDto {
    @ApiProperty({
        description: 'The total number of organizations.',
        example: 10,
    })
    count: number;
}

export class OrganizationStatsResponseDto {
    @ApiProperty({
        description: 'The number of branches in the organization.',
        example: 5,
    })
    branchCount: number;

    @ApiProperty({
        description: 'The number of employees in the organization.',
        example: 100,
    })
    employeeCount: number;

    @ApiProperty({
        description: 'The number of devices in the organization.',
        example: 20,
    })
    deviceCount: number;
}
