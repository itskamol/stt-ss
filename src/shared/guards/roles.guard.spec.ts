import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithUser, RolesGuard } from './roles.guard';
import { LoggerService } from '../../core/logger/logger.service';
import { UserContext } from '../interfaces/data-scope.interface';

describe('RolesGuard', () => {
    let guard: RolesGuard;

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
                RolesGuard,
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

        guard = module.get<RolesGuard>(RolesGuard);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('canActivate', () => {
        const mockUser: UserContext = {
            sub: 'user-123',
            email: 'test@example.com',
            organizationId: 'org-456',
            branchIds: ['branch-1'],
            roles: ['ORG_ADMIN'],
            permissions: ['employee:create', 'employee:read:all'],
        };

        const createMockContext = (user?: UserContext): ExecutionContext => {
            const mockRequest: Partial<RequestWithUser> = {
                user,
                url: '/test',
                method: 'GET',
                correlationId: 'test-correlation-id',
            };

            return {
                getHandler: jest.fn(),
                getClass: jest.fn(),
                switchToHttp: jest.fn().mockReturnValue({
                    getRequest: jest.fn().mockReturnValue(mockRequest),
                }),
            } as unknown as ExecutionContext;
        };

        it('should allow access when no user (unauthenticated)', () => {
            const mockContext = createMockContext();

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should allow access to public routes', () => {
            const mockContext = createMockContext(mockUser);
            mockReflector.getAllAndOverride.mockReturnValue(true);

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should allow access when no permissions or roles are required', () => {
            const mockContext = createMockContext(mockUser);
            mockReflector.getAllAndOverride
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce([]) // permissions
                .mockReturnValueOnce([]); // roles

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should allow access when user has required role', () => {
            const mockContext = createMockContext(mockUser);
            mockReflector.getAllAndOverride
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(null) // permissions
                .mockReturnValueOnce(['ORG_ADMIN', 'SUPER_ADMIN']); // roles

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Role/permission check passed',
                expect.objectContaining({
                    userId: 'user-123',
                    userRoles: ['ORG_ADMIN'],
                    requiredRoles: ['ORG_ADMIN', 'SUPER_ADMIN'],
                    module: 'roles-guard',
                })
            );
        });

        it('should deny access when user lacks required role', () => {
            const mockContext = createMockContext(mockUser);
            mockReflector.getAllAndOverride
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(null) // permissions
                .mockReturnValueOnce(['SUPER_ADMIN']); // roles

            expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'ROLE_ACCESS_DENIED',
                expect.objectContaining({
                    userId: 'user-123',
                    userRoles: ['ORG_ADMIN'],
                    requiredRoles: ['SUPER_ADMIN'],
                }),
                'user-123',
                'org-456',
                'test-correlation-id'
            );
        });

        it('should allow access when user has all required permissions', () => {
            const mockContext = createMockContext(mockUser);
            mockReflector.getAllAndOverride
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(['employee:create']) // permissions
                .mockReturnValueOnce(null); // roles

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Role/permission check passed',
                expect.objectContaining({
                    userId: 'user-123',
                    userPermissions: ['employee:create', 'employee:read:all'],
                    requiredPermissions: ['employee:create'],
                    module: 'roles-guard',
                })
            );
        });

        it('should allow access when user has all multiple required permissions', () => {
            const mockContext = createMockContext(mockUser);
            mockReflector.getAllAndOverride
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(['employee:create', 'employee:read:all']) // permissions
                .mockReturnValueOnce(null); // roles

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should deny access when user lacks some required permissions', () => {
            const mockContext = createMockContext(mockUser);
            mockReflector.getAllAndOverride
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(['employee:create', 'employee:delete']) // permissions
                .mockReturnValueOnce(null); // roles

            expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'PERMISSION_ACCESS_DENIED',
                expect.objectContaining({
                    userId: 'user-123',
                    userPermissions: ['employee:create', 'employee:read:all'],
                    requiredPermissions: ['employee:create', 'employee:delete'],
                    missingPermissions: ['employee:delete'],
                }),
                'user-123',
                'org-456',
                'test-correlation-id'
            );
        });

        it('should check both roles and permissions when both are specified', () => {
            const mockContext = createMockContext(mockUser);
            mockReflector.getAllAndOverride
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(['employee:create']) // permissions
                .mockReturnValueOnce(['ORG_ADMIN']); // roles

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should deny access when user has role but lacks permissions', () => {
            const mockContext = createMockContext(mockUser);
            mockReflector.getAllAndOverride
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(['employee:delete']) // permissions (user doesn't have this)
                .mockReturnValueOnce(['ORG_ADMIN']); // roles (user has this)

            expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
        });
    });
});
