import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService, LoginDto } from './auth.service';
import { UserRepository } from '../user/user.repository';
import { JwtService as CustomJwtService } from './jwt.service';
import { LoggerService } from '../../core/logger/logger.service';
import { PasswordUtil } from '../../shared/utils/password.util';
import { Role } from '../../shared/enums';

// Mock PasswordUtil
jest.mock('../../shared/utils/password.util');

describe('AuthService', () => {
    let service: AuthService;
    let userRepository: UserRepository;
    let jwtService: CustomJwtService;
    let logger: LoggerService;

    const mockUserRepository = {
        findByEmail: jest.fn(),
        findById: jest.fn(),
        findUserWithOrganizations: jest.fn(),
    };

    const mockJwtService = {
        generateTokenPair: jest.fn(),
        verifyRefreshToken: jest.fn(),
    };

    const mockLogger = {
        logSecurityEvent: jest.fn(),
        logUserAction: jest.fn(),
        error: jest.fn(),
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
                    provide: LoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        userRepository = module.get<UserRepository>(UserRepository);
        jwtService = module.get<CustomJwtService>(CustomJwtService);
        logger = module.get<LoggerService>(LoggerService);
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

            const result = await service.login(loginDto, 'correlation-123');

            expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
            expect(PasswordUtil.compare).toHaveBeenCalledWith(
                'TestPassword123!',
                'hashed-password'
            );
            expect(mockJwtService.generateTokenPair).toHaveBeenCalledWith(
                expect.objectContaining({
                    sub: 'user-123',
                    email: 'test@example.com',
                    organizationId: 'org-456',
                    roles: ['ORG_ADMIN'],
                })
            );
            expect(result).toEqual({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                user: {
                    id: 'user-123',
                    email: 'test@example.com',
                    fullName: 'Test User',
                    organizationId: 'org-456',
                    roles: ['ORG_ADMIN'],
                },
            });
            expect(mockLogger.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'LOGIN_SUCCESS',
                expect.any(Object),
                'org-456',
                'correlation-123'
            );
        });

        it('should throw UnauthorizedException for non-existent user', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(null);

            await expect(service.login(loginDto, 'correlation-123')).rejects.toThrow(
                UnauthorizedException
            );
            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'LOGIN_FAILED_USER_NOT_FOUND',
                { email: 'test@example.com' },
                undefined,
                undefined,
                'correlation-123'
            );
        });

        it('should throw UnauthorizedException for inactive user', async () => {
            const inactiveUser = { ...mockUser, isActive: false };
            mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

            await expect(service.login(loginDto, 'correlation-123')).rejects.toThrow(
                UnauthorizedException
            );
            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'LOGIN_FAILED_USER_INACTIVE',
                { email: 'test@example.com', userId: 'user-123' },
                'user-123',
                undefined,
                'correlation-123'
            );
        });

        it('should throw UnauthorizedException for invalid password', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(mockUser);
            (PasswordUtil.compare as jest.Mock).mockResolvedValue(false);

            await expect(service.login(loginDto, 'correlation-123')).rejects.toThrow(
                UnauthorizedException
            );
            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'LOGIN_FAILED_INVALID_PASSWORD',
                { email: 'test@example.com', userId: 'user-123' },
                'user-123',
                undefined,
                'correlation-123'
            );
        });

        it('should handle branch manager with managed branches', async () => {
            const branchManagerUser = {
                ...mockUser,
                organizationLinks: [
                    {
                        id: 'org-user-123',
                        organizationId: 'org-456',
                        role: Role.BRANCH_MANAGER,
                        managedBranches: [{ branchId: 'branch-1' }, { branchId: 'branch-2' }],
                    },
                ],
            };

            mockUserRepository.findByEmail.mockResolvedValue(mockUser);
            mockUserRepository.findUserWithOrganizations.mockResolvedValue(branchManagerUser);
            (PasswordUtil.compare as jest.Mock).mockResolvedValue(true);
            mockJwtService.generateTokenPair.mockReturnValue({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });

            const result = await service.login(loginDto, 'correlation-123');

            expect(mockJwtService.generateTokenPair).toHaveBeenCalledWith(
                expect.objectContaining({
                    branchIds: ['branch-1', 'branch-2'],
                    roles: ['BRANCH_MANAGER'],
                })
            );
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
            mockUserRepository.findById.mockResolvedValue(mockUser);
            mockUserRepository.findUserWithOrganizations.mockResolvedValue(
                mockUserWithOrganizations
            );
            mockJwtService.generateTokenPair.mockReturnValue({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
            });

            const result = await service.refreshToken(refreshTokenDto, 'correlation-123');

            expect(mockJwtService.verifyRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
            expect(mockJwtService.generateTokenPair).toHaveBeenCalledWith(
                expect.objectContaining({
                    sub: 'user-123',
                    email: 'test@example.com',
                }),
                2 // tokenVersion + 1
            );
            expect(result).toEqual({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
            });
        });

        it('should throw UnauthorizedException for invalid refresh token', async () => {
            mockJwtService.verifyRefreshToken.mockImplementation(() => {
                throw new Error('Invalid token');
            });

            await expect(service.refreshToken(refreshTokenDto, 'correlation-123')).rejects.toThrow(
                UnauthorizedException
            );
            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'REFRESH_TOKEN_FAILED',
                { error: 'Invalid token' },
                undefined,
                undefined,
                'correlation-123'
            );
        });

        it('should throw UnauthorizedException for inactive user', async () => {
            const inactiveUser = { ...mockUser, isActive: false };
            mockJwtService.verifyRefreshToken.mockReturnValue(mockRefreshPayload);
            mockUserRepository.findById.mockResolvedValue(inactiveUser);

            await expect(service.refreshToken(refreshTokenDto, 'correlation-123')).rejects.toThrow(
                UnauthorizedException
            );
            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'REFRESH_TOKEN_FAILED_USER_INVALID',
                { userId: 'user-123' },
                'user-123',
                undefined,
                'correlation-123'
            );
        });
    });

    describe('getPermissionsForRole', () => {
        it('should return correct permissions for SUPER_ADMIN', () => {
            // Access private method through service instance
            const permissions = (service as any).getPermissionsForRole(Role.SUPER_ADMIN);

            expect(permissions).toContain('organization:create');
            expect(permissions).toContain('organization:read:all');
            expect(permissions).toContain('audit:read:system');
        });

        it('should return correct permissions for ORG_ADMIN', () => {
            const permissions = (service as any).getPermissionsForRole(Role.ORG_ADMIN);

            expect(permissions).toContain('organization:read:self');
            expect(permissions).toContain('employee:create');
            expect(permissions).toContain('report:generate:org');
            expect(permissions).not.toContain('organization:create');
        });

        it('should return correct permissions for BRANCH_MANAGER', () => {
            const permissions = (service as any).getPermissionsForRole(Role.BRANCH_MANAGER);

            expect(permissions).toContain('employee:create');
            expect(permissions).toContain('guest:approve');
            expect(permissions).not.toContain('organization:read:self');
            expect(permissions).not.toContain('report:generate:org');
        });

        it('should return correct permissions for EMPLOYEE', () => {
            const permissions = (service as any).getPermissionsForRole(Role.EMPLOYEE);

            expect(permissions).toEqual(['employee:read:self']);
        });
    });
});
