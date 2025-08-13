import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoggerService } from '@/core/logger';
import { Public, User } from '@/shared/decorators';
import { UserContext } from '@/shared/interfaces';
import { RequestWithCorrelation } from '@/shared/middleware/correlation-id.middleware';
import {
    LoginRequestDto,
    LoginResponse,
    LoginResponseDto,
    LogoutRequestDto,
    RefreshTokenRequestDto,
} from '@/shared/dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly logger: LoggerService
    ) {}

    @Post('login')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Log in a user' })
    @ApiBody({ type: LoginRequestDto })
    @ApiResponse({ status: 200, description: 'Login successful', type: LoginResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
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
            this.logger.logUserAction(undefined, 'LOGIN_ATTEMPT_FAILED', {
                email: loginDto.email,
                error: error.message,
                responseTime,
                userAgent: request.headers['user-agent'],
                ip: request.ip,
                correlationId: request.correlationId,
            });
            throw error;
        }
    }

    @Post('refresh')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refresh an access token' })
    @ApiBody({ type: RefreshTokenRequestDto })
    @ApiResponse({
        status: 200,
        description: 'Token refreshed successfully',
        schema: {
            properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
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
            this.logger.logUserAction(undefined, 'TOKEN_REFRESH_FAILED', {
                error: error.message,
                responseTime,
                userAgent: request.headers['user-agent'],
                ip: request.ip,
                correlationId: request.correlationId,
            });
            throw error;
        }
    }

    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Log out a user' })
    @ApiBody({ type: LogoutRequestDto })
    @ApiResponse({ status: 204, description: 'Logout successful' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async logout(
        @Body() logoutDto: LogoutRequestDto,
        @User() user: UserContext,
        @Req() request: RequestWithCorrelation
    ): Promise<void> {
        try {
            await this.authService.logout(logoutDto.refreshToken, request.correlationId);

            this.logger.logUserAction(user.sub, 'LOGOUT_SUCCESS', {
                organizationId: user.organizationId,
                correlationId: request.correlationId,
            });
        } catch (error) {
            this.logger.logUserAction(user.sub, 'LOGOUT_FAILED', {
                userId: user.sub,
                error: error.message,
                userAgent: request.headers['user-agent'],
                ip: request.ip,
                organizationId: user.organizationId,
                correlationId: request.correlationId,
            });
            throw error;
        }
    }

    @Post('validate')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Validate the current access token' })
    @ApiResponse({
        status: 200,
        description: 'Token is valid',
        schema: {
            properties: {
                valid: { type: 'boolean' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        organizationId: { type: 'string' },
                        roles: { type: 'array', items: { type: 'string' } },
                        permissions: { type: 'array', items: { type: 'string' } },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
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
