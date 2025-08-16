import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserContext } from '@/shared/interfaces';
import { RequestWithCorrelation } from '@/shared/middleware/correlation-id.middleware';
import { Role } from '@/shared/enums';
import { LoginResponseDto, LogoutDto, RefreshTokenDto } from '@/shared/dto';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { MockLoggerProvider, mockLoggerService } from '@/testing/mocks/logger.mock';

describe('AuthController', () => {
    let controller: AuthController;

    const mockAuthService = {
        login: jest.fn(),
        refreshToken: jest.fn(),
        logout: jest.fn(),
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
        roles: [Role.ORG_ADMIN],
        permissions: [PERMISSIONS.EMPLOYEE.CREATE],
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
                MockLoggerProvider,
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        const loginDto = {
            email: 'test@example.com',
            password: 'TestPassword123!',
        };

        const mockLoginResponse: LoginResponseDto = {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            user: {
                id: 'user-123',
                email: 'test@example.com',
                fullName: 'Test User',
                organizationId: 'org-456',
                roles: [Role.ORG_ADMIN],
            },
        };

        it('should login successfully', async () => {
            mockAuthService.login.mockResolvedValue(mockLoginResponse);

            const result = await controller.login(loginDto);

            expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
            expect(result).toEqual(mockLoginResponse);
        });

        it('should handle login failure', async () => {
            const loginError = new UnauthorizedException('Invalid credentials');
            mockAuthService.login.mockRejectedValue(loginError);

            await expect(controller.login(loginDto)).rejects.toThrow(
                UnauthorizedException
            );
        });
    });

    describe('refreshToken', () => {
        const refreshTokenDto: RefreshTokenDto = {
            refreshToken: 'valid-refresh-token',
        };

        const mockRefreshResponse = {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
        };

        it('should refresh token successfully', async () => {
            mockAuthService.refreshToken.mockResolvedValue(mockRefreshResponse);

            const result = await controller.refreshToken(refreshTokenDto);

            expect(mockAuthService.refreshToken).toHaveBeenCalledWith(refreshTokenDto);
            expect(result).toEqual(mockRefreshResponse);
        });

        it('should handle refresh token failure', async () => {
            const refreshError = new UnauthorizedException('Invalid refresh token');
            mockAuthService.refreshToken.mockRejectedValue(refreshError);

            await expect(controller.refreshToken(refreshTokenDto)).rejects.toThrow(
                UnauthorizedException
            );
        });
    });

    describe('logout', () => {
        const logoutDto: LogoutDto = {
            refreshToken: 'refresh-token-to-logout',
        };

        it('should logout successfully', async () => {
            mockAuthService.logout.mockResolvedValue(undefined);

            await controller.logout(logoutDto, mockUser);

            expect(mockAuthService.logout).toHaveBeenCalledWith(
                logoutDto.refreshToken,
                mockUser.sub
            );
        });

        it('should handle logout failure', async () => {
            const logoutError = new Error('Logout failed');
            mockAuthService.logout.mockRejectedValue(logoutError);

            await expect(controller.logout(logoutDto, mockUser)).rejects.toThrow(
                Error
            );
        });
    });

    describe('validateToken', () => {
        it('should validate token successfully', async () => {
            const result = await controller.validateToken(mockUser);

            expect(result).toEqual({
                valid: true,
                user: {
                    id: 'user-123',
                    email: 'test@example.com',
                    organizationId: 'org-456',
                    roles: [Role.ORG_ADMIN],
                    permissions: [PERMISSIONS.EMPLOYEE.CREATE],
                },
            });
        });
    });
});
