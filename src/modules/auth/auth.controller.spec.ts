import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import {
    AuthController,
    LoginRequestDto,
    LogoutRequestDto,
    RefreshTokenRequestDto,
} from './auth.controller';
import { AuthService, LoginResponse } from './auth.service';
import { LoggerService } from '../../core/logger/logger.service';
import { UserContext } from '../../shared/interfaces';
import { RequestWithCorrelation } from '../../shared/middleware/correlation-id.middleware';

describe('AuthController', () => {
    let controller: AuthController;
    let authService: AuthService;
    let logger: LoggerService;

    const mockAuthService = {
        login: jest.fn(),
        refreshToken: jest.fn(),
        logout: jest.fn(),
    };

    const mockLogger = {
        log: jest.fn(),
        logSecurityEvent: jest.fn(),
        logUserAction: jest.fn(),
        debug: jest.fn(),
    };

    const mockRequest: Partial<RequestWithCorrelation> = {
        correlationId: 'test-correlation-id',
        headers: {
            'user-agent': 'test-agent',
        },
        ip: '127.0.0.1',
    };

    const mockUser: UserContext = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-456',
        branchIds: [],
        roles: ['ORG_ADMIN'],
        permissions: ['employee:create'],
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
                {
                    provide: LoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
        authService = module.get<AuthService>(AuthService);
        logger = module.get<LoggerService>(LoggerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        const loginDto: LoginRequestDto = {
            email: 'test@example.com',
            password: 'TestPassword123!',
        };

        const mockLoginResponse: LoginResponse = {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            user: {
                id: 'user-123',
                email: 'test@example.com',
                fullName: 'Test User',
                organizationId: 'org-456',
                roles: ['ORG_ADMIN'],
            },
        };

        it('should login successfully', async () => {
            mockAuthService.login.mockResolvedValue(mockLoginResponse);

            const result = await controller.login(loginDto, mockRequest as RequestWithCorrelation);

            expect(mockAuthService.login).toHaveBeenCalledWith(loginDto, 'test-correlation-id');
            expect(mockLogger.log).toHaveBeenCalledWith(
                'Login successful',
                expect.objectContaining({
                    email: 'test@example.com',
                    userId: 'user-123',
                    organizationId: 'org-456',
                    roles: ['ORG_ADMIN'],
                    correlationId: 'test-correlation-id',
                    module: 'auth-controller',
                })
            );
            expect(result).toEqual(mockLoginResponse);
        });

        it('should handle login failure', async () => {
            const loginError = new UnauthorizedException('Invalid credentials');
            mockAuthService.login.mockRejectedValue(loginError);

            await expect(
                controller.login(loginDto, mockRequest as RequestWithCorrelation)
            ).rejects.toThrow(UnauthorizedException);

            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'LOGIN_ATTEMPT_FAILED',
                expect.objectContaining({
                    email: 'test@example.com',
                    error: 'Invalid credentials',
                    userAgent: 'test-agent',
                    ip: '127.0.0.1',
                }),
                undefined,
                undefined,
                'test-correlation-id'
            );
        });
    });

    describe('refreshToken', () => {
        const refreshTokenDto: RefreshTokenRequestDto = {
            refreshToken: 'valid-refresh-token',
        };

        const mockRefreshResponse = {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
        };

        it('should refresh token successfully', async () => {
            mockAuthService.refreshToken.mockResolvedValue(mockRefreshResponse);

            const result = await controller.refreshToken(
                refreshTokenDto,
                mockRequest as RequestWithCorrelation
            );

            expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
                refreshTokenDto,
                'test-correlation-id'
            );
            expect(mockLogger.log).toHaveBeenCalledWith(
                'Token refresh successful',
                expect.objectContaining({
                    correlationId: 'test-correlation-id',
                    module: 'auth-controller',
                })
            );
            expect(result).toEqual(mockRefreshResponse);
        });

        it('should handle refresh token failure', async () => {
            const refreshError = new UnauthorizedException('Invalid refresh token');
            mockAuthService.refreshToken.mockRejectedValue(refreshError);

            await expect(
                controller.refreshToken(refreshTokenDto, mockRequest as RequestWithCorrelation)
            ).rejects.toThrow(UnauthorizedException);

            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'TOKEN_REFRESH_FAILED',
                expect.objectContaining({
                    error: 'Invalid refresh token',
                    userAgent: 'test-agent',
                    ip: '127.0.0.1',
                }),
                undefined,
                undefined,
                'test-correlation-id'
            );
        });
    });

    describe('logout', () => {
        const logoutDto: LogoutRequestDto = {
            refreshToken: 'refresh-token-to-logout',
        };

        it('should logout successfully', async () => {
            mockAuthService.logout.mockResolvedValue(undefined);

            await controller.logout(logoutDto, mockUser, mockRequest as RequestWithCorrelation);

            expect(mockAuthService.logout).toHaveBeenCalledWith(
                'refresh-token-to-logout',
                'test-correlation-id'
            );
            expect(mockLogger.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'LOGOUT_SUCCESS',
                {},
                'org-456',
                'test-correlation-id'
            );
        });

        it('should handle logout failure', async () => {
            const logoutError = new Error('Logout failed');
            mockAuthService.logout.mockRejectedValue(logoutError);

            await expect(
                controller.logout(logoutDto, mockUser, mockRequest as RequestWithCorrelation)
            ).rejects.toThrow(Error);

            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'LOGOUT_FAILED',
                expect.objectContaining({
                    userId: 'user-123',
                    error: 'Logout failed',
                    userAgent: 'test-agent',
                    ip: '127.0.0.1',
                }),
                'user-123',
                'org-456',
                'test-correlation-id'
            );
        });
    });

    describe('validateToken', () => {
        it('should validate token successfully', async () => {
            const result = await controller.validateToken(
                mockUser,
                mockRequest as RequestWithCorrelation
            );

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Token validation successful',
                expect.objectContaining({
                    userId: 'user-123',
                    organizationId: 'org-456',
                    roles: ['ORG_ADMIN'],
                    correlationId: 'test-correlation-id',
                    module: 'auth-controller',
                })
            );

            expect(result).toEqual({
                valid: true,
                user: {
                    id: 'user-123',
                    email: 'test@example.com',
                    organizationId: 'org-456',
                    roles: ['ORG_ADMIN'],
                    permissions: ['employee:create'],
                },
            });
        });
    });
});
