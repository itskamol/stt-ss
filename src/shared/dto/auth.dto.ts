import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        description: 'The email address of the user.',
        example: 'john.doe@example.com',
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        description: 'The password for the user account.',
        example: 'Password123!',
    })
    @IsString()
    @IsNotEmpty()
    password: string;
}

export class RefreshTokenDto {
    @ApiProperty({
        description: 'The refresh token used to obtain a new access token.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}

export class LogoutDto {
    @ApiProperty({
        description: 'The refresh token to be invalidated.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}

class UserLoginResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the user.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The email address of the user.',
        example: 'john.doe@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'The full name of the user.',
        example: 'John Doe',
        required: false,
    })
    fullName?: string;

    @ApiProperty({
        description: 'The ID of the organization the user belongs to.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    organizationId?: string;

    @ApiProperty({
        description: 'The roles assigned to the user.',
        example: ['ORG_ADMIN'],
        type: [String],
    })
    roles: string[];
}

export class LoginResponseDto {
    @ApiProperty({
        description: 'The JWT access token.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    accessToken: string;

    @ApiProperty({
        description: 'The refresh token.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    refreshToken: string;

    @ApiProperty({
        description: 'The authenticated user details.',
        type: UserLoginResponseDto,
    })
    user: UserLoginResponseDto;
}

export class RefreshTokenResponseDto {
    @ApiProperty({
        description: 'The new JWT access token.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    accessToken: string;

    @ApiProperty({
        description: 'The new refresh token.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    refreshToken: string;
}

class ValidateTokenUserResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the user.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The email address of the user.',
        example: 'john.doe@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'The ID of the organization the user belongs to.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    organizationId?: string;

    @ApiProperty({
        description: 'The roles assigned to the user.',
        example: ['ORG_ADMIN'],
        type: [String],
    })
    roles: string[];

    @ApiProperty({
        description: 'The permissions assigned to the user.',
        example: ['USER.CREATE'],
        type: [String],
    })
    permissions: string[];
}

export class ValidateTokenResponseDto {
    @ApiProperty({
        description: 'Indicates if the token is valid.',
        example: true,
    })
    valid: boolean;

    @ApiProperty({
        description: 'The user details associated with the token.',
        type: ValidateTokenUserResponseDto,
    })
    user: ValidateTokenUserResponseDto;
}
