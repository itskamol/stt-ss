import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRepository } from '../user/user.repository';
import { CustomJwtService } from './jwt.service';
import { CacheService } from '@/core/cache/cache.service';
import { LoginDto } from '@/shared/dto';
import { Role } from '@/shared/enums';
import { PasswordUtil } from '@/shared/utils/password.util';
import { MockLoggerProvider } from '@/testing/mocks/logger.mock';

// Mock PasswordUtil
jest.mock('@/shared/utils/password.util');

describe('AuthService', () => {
    let service: AuthService;
    let mockCacheService: jest.Mocked<CacheService>;

    const mockUserRepository = {
        findByEmail: jest.fn(),
        findById: jest.fn(),
        findUserWithOrganizations: jest.fn(),
    };

    const mockJwtService = {
        generateTokenPair: jest.fn(),
        verifyRefreshToken: jest.fn(),
    };

    const mockCacheServiceInstance = {
        isRefreshTokenDenied: jest.fn(),
        denyRefreshToken: jest.fn(),
        set: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
        getCachedData: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UserRepository,
                    useValue: mockUserRepository,
                },
                {
                    provide: CustomJwtService,
                    useValue: mockJwtService,
                },
                {
                    provide: CacheService,
                    useValue: mockCacheServiceInstance,
                },
                MockLoggerProvider,
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        mockCacheService = module.get(CacheService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        const loginDto: LoginDto = {
            email: 'test@example.com',
            password: 'TestPassword123!',
        };

        const mockUser = {
            id: 'user-123',
            email: 'test@example.com',
            passwordHash: 'hashed-password',
            fullName: 'Test User',
            isActive: true,
        };

        const mockUserWithOrganizations = {
            ...mockUser,
            organizationLinks: [
                {
                    id: 'org-user-123',
                    organizationId: 'org-456',
                    role: Role.ORG_ADMIN,
                    managedBranches: [],
                },
            ],
        };

        it('should successfully login with valid credentials', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(mockUser);
            mockUserRepository.findUserWithOrganizations.mockResolvedValue(
                mockUserWithOrganizations
            );
            (PasswordUtil.compare as jest.Mock).mockResolvedValue(true);
            mockJwtService.generateTokenPair.mockReturnValue({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });

            const result = await service.login(loginDto);

            expect(result.accessToken).toBe('access-token');
        });

        it('should throw UnauthorizedException for non-existent user', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(null);

            await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException for inactive user', async () => {
            const inactiveUser = { ...mockUser, isActive: false };
            mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

            await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException for invalid password', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(mockUser);
            (PasswordUtil.compare as jest.Mock).mockResolvedValue(false);

            await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('refreshToken', () => {
        const refreshTokenDto = {
            refreshToken: 'valid-refresh-token',
        };

        const mockRefreshPayload = {
            sub: 'user-123',
            tokenVersion: 1,
        };

        const mockUser = {
            id: 'user-123',
            email: 'test@example.com',
            isActive: true,
        };

        const mockUserWithOrganizations = {
            ...mockUser,
            organizationLinks: [
                {
                    organizationId: 'org-456',
                    role: Role.ORG_ADMIN,
                    managedBranches: [],
                },
            ],
        };

        it('should successfully refresh token', async () => {
            mockJwtService.verifyRefreshToken.mockReturnValue(mockRefreshPayload);
            mockCacheService.isRefreshTokenDenied.mockResolvedValue(false); // Happy path
            mockUserRepository.findById.mockResolvedValue(mockUser);
            mockUserRepository.findUserWithOrganizations.mockResolvedValue(
                mockUserWithOrganizations
            );
            mockJwtService.generateTokenPair.mockReturnValue({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
            });

            const result = await service.refreshToken(refreshTokenDto);

            expect(result).toEqual({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
            });
        });

        it('should throw UnauthorizedException for invalid refresh token', async () => {
            mockJwtService.verifyRefreshToken.mockImplementation(() => {
                throw new UnauthorizedException('Invalid token');
            });

            await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(
                UnauthorizedException
            );
        });

        it('should throw UnauthorizedException for inactive user', async () => {
            const inactiveUser = { ...mockUser, isActive: false };
            mockJwtService.verifyRefreshToken.mockReturnValue(mockRefreshPayload);
            mockCacheService.isRefreshTokenDenied.mockResolvedValue(false);
            mockUserRepository.findById.mockResolvedValue(inactiveUser);

            await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(
                'Invalid refresh token'
            );
        });
    });
});
