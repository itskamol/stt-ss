import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { JwtService as CustomJwtService, JwtPayload } from './jwt.service';
import { ConfigService } from '../../core/config/config.service';
import { LoggerService } from '../../core/logger/logger.service';

describe('CustomJwtService', () => {
    let service: CustomJwtService;
    let jwtService: JwtService;
    let configService: ConfigService;
    let logger: LoggerService;

    const mockJwtService = {
        sign: jest.fn(),
        verify: jest.fn(),
        decode: jest.fn(),
    };

    const mockConfigService = {
        jwtSecret: 'test-jwt-secret',
        jwtExpirationTime: '15m',
        refreshTokenSecret: 'test-refresh-secret',
        refreshTokenExpirationTime: '7d',
    };

    const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CustomJwtService,
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: LoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        service = module.get<CustomJwtService>(CustomJwtService);
        jwtService = module.get<JwtService>(JwtService);
        configService = module.get<ConfigService>(ConfigService);
        logger = module.get<LoggerService>(LoggerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('generateAccessToken', () => {
        it('should generate access token with correct payload', () => {
            const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
                sub: 'user-123',
                email: 'test@example.com',
                organizationId: 'org-456',
                branchIds: ['branch-1'],
                roles: ['ORG_ADMIN'],
                permissions: ['employee:create'],
            };

            const expectedToken = 'generated-access-token';
            mockJwtService.sign.mockReturnValue(expectedToken);

            const result = service.generateAccessToken(payload);

            expect(mockJwtService.sign).toHaveBeenCalledWith(payload, {
                secret: 'test-jwt-secret',
                expiresIn: '15m',
            });
            expect(result).toBe(expectedToken);
            expect(mockLogger.log).toHaveBeenCalledWith(
                'Access token generated',
                expect.objectContaining({
                    userId: 'user-123',
                    organizationId: 'org-456',
                    roles: ['ORG_ADMIN'],
                    module: 'jwt',
                })
            );
        });

        it('should handle token generation error', () => {
            const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
                sub: 'user-123',
                email: 'test@example.com',
                roles: [],
                permissions: [],
            };

            const error = new Error('Token generation failed');
            mockJwtService.sign.mockImplementation(() => {
                throw error;
            });

            expect(() => service.generateAccessToken(payload)).toThrow(error);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to generate access token',
                'Token generation failed',
                expect.objectContaining({
                    userId: 'user-123',
                    module: 'jwt',
                })
            );
        });
    });

    describe('generateRefreshToken', () => {
        it('should generate refresh token', () => {
            const userId = 'user-123';
            const tokenVersion = 1;
            const expectedToken = 'generated-refresh-token';

            mockJwtService.sign.mockReturnValue(expectedToken);

            const result = service.generateRefreshToken(userId, tokenVersion);

            expect(mockJwtService.sign).toHaveBeenCalledWith(
                {
                    sub: userId,
                    tokenVersion,
                },
                {
                    secret: 'test-refresh-secret',
                    expiresIn: '7d',
                }
            );
            expect(result).toBe(expectedToken);
            expect(mockLogger.log).toHaveBeenCalledWith(
                'Refresh token generated',
                expect.objectContaining({
                    userId,
                    tokenVersion,
                    module: 'jwt',
                })
            );
        });
    });

    describe('verifyAccessToken', () => {
        it('should verify and return access token payload', () => {
            const token = 'valid-access-token';
            const expectedPayload: JwtPayload = {
                sub: 'user-123',
                email: 'test@example.com',
                organizationId: 'org-456',
                roles: ['ORG_ADMIN'],
                permissions: ['employee:create'],
                iat: 1234567890,
                exp: 1234567890,
            };

            mockJwtService.verify.mockReturnValue(expectedPayload);

            const result = service.verifyAccessToken(token);

            expect(mockJwtService.verify).toHaveBeenCalledWith(token, {
                secret: 'test-jwt-secret',
            });
            expect(result).toEqual(expectedPayload);
        });

        it('should handle token verification error', () => {
            const token = 'invalid-token';
            const error = new Error('Token verification failed');

            mockJwtService.verify.mockImplementation(() => {
                throw error;
            });

            expect(() => service.verifyAccessToken(token)).toThrow(error);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Access token verification failed',
                expect.objectContaining({
                    error: 'Token verification failed',
                    module: 'jwt',
                })
            );
        });
    });

    describe('generateTokenPair', () => {
        it('should generate both access and refresh tokens', () => {
            const userPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
                sub: 'user-123',
                email: 'test@example.com',
                roles: ['ORG_ADMIN'],
                permissions: ['employee:create'],
            };

            mockJwtService.sign
                .mockReturnValueOnce('access-token')
                .mockReturnValueOnce('refresh-token');

            const result = service.generateTokenPair(userPayload, 1);

            expect(result).toEqual({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });
            expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
        });
    });

    describe('extractUserContext', () => {
        it('should extract user context from JWT payload', () => {
            const payload: JwtPayload = {
                sub: 'user-123',
                email: 'test@example.com',
                organizationId: 'org-456',
                branchIds: ['branch-1'],
                roles: ['ORG_ADMIN'],
                permissions: ['employee:create'],
                iat: 1234567890,
                exp: 1234567890,
            };

            const result = service.extractUserContext(payload);

            expect(result).toEqual({
                sub: 'user-123',
                email: 'test@example.com',
                organizationId: 'org-456',
                branchIds: ['branch-1'],
                roles: ['ORG_ADMIN'],
                permissions: ['employee:create'],
            });
        });
    });
});
