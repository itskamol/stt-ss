import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { AuthService, LoginDto, LoginResponse, RefreshTokenDto } from './auth.service';
import { LoggerService } from '../../core/logger/logger.service';
import { Public, User } from '../../shared/decorators';
import { UserContext } from '../../shared/interfaces';
import { RequestWithCorrelation } from '../../shared/middleware/correlation-id.middleware';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class LoginRequestDto implements LoginDto {
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}

export class RefreshTokenRequestDto implements RefreshTokenDto {
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}

export class LogoutRequestDto {
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly logger: LoggerService
    ) {}

    @Post('login')
    @Public()
    @HttpCode(HttpStatus.OK)
    async login(
        @Body() loginDto: LoginRequestDto,
        @Req() request: RequestWithCorrelation
    ): Promise<LoginResponse> {
        const startTime = Date.now();

        try {
            const result = await this.authService.login(loginDto, request.correlationId);

            const responseTime = Date.now() - startTime;
            this.logger.log('Login successful', {
                email: loginDto.email,
                userId: result.user.id,
                organizationId: result.user.organizationId,
                roles: result.user.roles,
                responseTime,
                correlationId: request.correlationId,
                module: 'auth-controller',
            });

            return result;
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.logger.logSecurityEvent(
                'LOGIN_ATTEMPT_FAILED',
                {
                    email: loginDto.email,
                    error: error.message,
                    responseTime,
                    userAgent: request.headers['user-agent'],
                    ip: request.ip,
                },
                undefined,
                undefined,
                request.correlationId
            );
            throw error;
        }
    }

    @Post('refresh')
    @Public()
    @HttpCode(HttpStatus.OK)
    async refreshToken(
        @Body() refreshTokenDto: RefreshTokenRequestDto,
        @Req() request: RequestWithCorrelation
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const startTime = Date.now();

        try {
            const result = await this.authService.refreshToken(
                refreshTokenDto,
                request.correlationId
            );

            const responseTime = Date.now() - startTime;
            this.logger.log('Token refresh successful', {
                responseTime,
                correlationId: request.correlationId,
                module: 'auth-controller',
            });

            return result;
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.logger.logSecurityEvent(
                'TOKEN_REFRESH_FAILED',
                {
                    error: error.message,
                    responseTime,
                    userAgent: request.headers['user-agent'],
                    ip: request.ip,
                },
                undefined,
                undefined,
                request.correlationId
            );
            throw error;
        }
    }

    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    async logout(
        @Body() logoutDto: LogoutRequestDto,
        @User() user: UserContext,
        @Req() request: RequestWithCorrelation
    ): Promise<void> {
        try {
            await this.authService.logout(logoutDto.refreshToken, request.correlationId);

            this.logger.logUserAction(
                user.sub,
                'LOGOUT_SUCCESS',
                {},
                user.organizationId,
                request.correlationId
            );
        } catch (error) {
            this.logger.logSecurityEvent(
                'LOGOUT_FAILED',
                {
                    userId: user.sub,
                    error: error.message,
                    userAgent: request.headers['user-agent'],
                    ip: request.ip,
                },
                user.sub,
                user.organizationId,
                request.correlationId
            );
            throw error;
        }
    }

    @Post('validate')
    @HttpCode(HttpStatus.OK)
    async validateToken(
        @User() user: UserContext,
        @Req() request: RequestWithCorrelation
    ): Promise<{
        valid: boolean;
        user: {
            id: string;
            email: string;
            organizationId?: string;
            roles: string[];
            permissions: string[];
        };
    }> {
        this.logger.debug('Token validation successful', {
            userId: user.sub,
            organizationId: user.organizationId,
            roles: user.roles,
            correlationId: request.correlationId,
            module: 'auth-controller',
        });

        return {
            valid: true,
            user: {
                id: user.sub,
                email: user.email,
                organizationId: user.organizationId,
                roles: user.roles,
                permissions: user.permissions,
            },
        };
    }
}
