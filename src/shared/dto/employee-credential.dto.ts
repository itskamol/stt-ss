import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';
import { CredentialType } from '@prisma/client';

export class CreateEmployeeCredentialDto {
    @ApiProperty({
        description: 'The type of credential',
        enum: CredentialType,
        example: CredentialType.FACE,
    })
    @IsEnum(CredentialType)
    @IsNotEmpty()
    type: CredentialType;

    @ApiProperty({
        description: 'The credential value (base64 for face/fingerprint, card number, etc.)',
        example: 'base64_encoded_face_template_or_card_number',
    })
    @IsString()
    @IsNotEmpty()
    value: string;

    @ApiProperty({
        description: 'Additional metadata for the credential',
        example: { quality: 95, templateVersion: '1.0' },
        required: false,
    })
    @IsOptional()
    metadata?: any;

    @ApiProperty({
        description: 'Whether the credential is active',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateEmployeeCredentialDto {
    @ApiProperty({
        description: 'The credential value (base64 for face/fingerprint, card number, etc.)',
        example: 'base64_encoded_face_template_or_card_number',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    value?: string;

    @ApiProperty({
        description: 'Additional metadata for the credential',
        example: { quality: 95, templateVersion: '1.0' },
        required: false,
    })
    @IsOptional()
    metadata?: any;

    @ApiProperty({
        description: 'Whether the credential is active',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class EmployeeCredentialResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the credential',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The employee ID this credential belongs to',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    employeeId: string;

    @ApiProperty({
        description: 'The type of credential',
        enum: CredentialType,
        example: CredentialType.FACE,
    })
    type: CredentialType;

    @ApiProperty({
        description: 'The credential value (masked for security)',
        example: '****masked****',
    })
    value: string;

    @ApiProperty({
        description: 'Additional metadata for the credential',
        example: { quality: 95, templateVersion: '1.0' },
        required: false,
    })
    metadata?: any;

    @ApiProperty({
        description: 'Whether the credential is active',
        example: true,
    })
    isActive: boolean;

    @ApiProperty({
        description: 'The date and time when the credential was created',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time when the credential was last updated',
        example: '2023-08-14T10:00:00.000Z',
    })
    updatedAt: Date;
}

export class CreateFaceCredentialDto {
    @ApiProperty({
        description: 'Additional metadata for the face credential',
        example: { quality: 95, source: 'employee_photo' },
        required: false,
    })
    @IsOptional()
    metadata?: any;
}