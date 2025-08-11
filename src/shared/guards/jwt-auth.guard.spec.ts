import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoggerService } from '../../core/logger/logger.service';

describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;
    let reflector: Reflector;
    let logger: LoggerService;

    const mockReflector = {
        getAllAndOverride: jest.fn(),
    };

    const mockLogger = {
        logSecurityEvent: jest.fn(),
        debug: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JwtAuthGuard,
                {
                    provide: Reflector,
                    useValue: mockReflector,
                },
                {
                    provide: LoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        guard = module.get<JwtAuthGuard>(JwtAuthGuard);
        reflector = module.get<Reflector>(Reflector);
        logger = module.get<LoggerService>(LoggerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('canActivate', () => {
        const mockContext = {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({
                    url: '/test',
                    method: 'GET',
                    correlationId: 'test-correlation-id',
                }),
            }),
        } as unknown as ExecutionContext;

        it('should allow access to public routes', () => {
            mockReflector.getAllAndOverride.mockReturnValue(true);

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
            expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
                mockContext.getHandler(),
                mockContext.getClass(),
            ]);
        });

        it('should call super.canActivate for protected routes', () => {
            mockReflector.getAllAndOverride.mockReturnValue(false);

            // Mock the parent class method
            const superCanActivateSpy = jest.spyOn(
                Object.getPrototypeOf(Object.getPrototypeOf(guard)),
                'canActivate'
            );
            superCanActivateSpy.mockReturnValue(true);

            const result = guard.canActivate(mockContext);

            expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
            superCanActivateSpy.mockRestore();
        });
    });

    describe('handleRequest', () => {
        const mockContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({
                    url: '/test',
                    method: 'GET',
                    correlationId: 'test-correlation-id',
                    headers: { 'user-agent': 'test-agent' },
                    ip: '127.0.0.1',
                }),
            }),
        } as unknown as ExecutionContext;

        const mockUser = {
            sub: 'user-123',
            email: 'test@example.com',
            organizationId: 'org-456',
            roles: ['ORG_ADMIN'],
        };

        it('should return user on successful authentication', () => {
            const result = guard.handleRequest(null, mockUser, null, mockContext);

            expect(result).toBe(mockUser);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'JWT authentication successful',
                expect.objectContaining({
                    userId: 'user-123',
                    organizationId: 'org-456',
                    roles: ['ORG_ADMIN'],
                    module: 'jwt-auth-guard',
                })
            );
        });

        it('should throw UnauthorizedException when user is null', () => {
            expect(() => guard.handleRequest(null, null, null, mockContext)).toThrow(
                UnauthorizedException
            );
            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'JWT_AUTH_FAILED',
                expect.objectContaining({
                    error: 'Authentication failed',
                    url: '/test',
                    method: 'GET',
                }),
                undefined,
                undefined,
                'test-correlation-id'
            );
        });

        it('should throw error when authentication error occurs', () => {
            const authError = new Error('Token expired');

            expect(() => guard.handleRequest(authError, null, null, mockContext)).toThrow(
                authError
            );
            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'JWT_AUTH_FAILED',
                expect.objectContaining({
                    error: 'Token expired',
                }),
                undefined,
                undefined,
                'test-correlation-id'
            );
        });

        it('should use info message when no error but no user', () => {
            const info = { message: 'No auth token' };

            expect(() => guard.handleRequest(null, null, info, mockContext)).toThrow(
                UnauthorizedException
            );
            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'JWT_AUTH_FAILED',
                expect.objectContaining({
                    error: 'No auth token',
                }),
                undefined,
                undefined,
                'test-correlation-id'
            );
        });
    });
});
