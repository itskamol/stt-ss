import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums';
import { UserContext } from '../interfaces';
import { PERMISSIONS } from '../constants/permissions.constants';

describe('RolesGuard', () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    const mockContext: ExecutionContext = {
        switchToHttp: () => ({
            getRequest: () => ({
                user: {
                    sub: 'user-123',
                    roles: [Role.ORG_ADMIN],
                    permissions: ['employee:create', 'employee:read:all'],
                } as UserContext,
            }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
    } as any;

    beforeEach(() => {
        reflector = new Reflector();
        guard = new RolesGuard(reflector);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('canActivate', () => {
        it('should allow access when no roles or permissions are required', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should allow access for public routes', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true); // isPublic

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should allow access when user has required role', () => {
            jest.spyOn(reflector, 'getAllAndOverride')
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(null) // permissions
                .mockReturnValueOnce([Role.ORG_ADMIN, Role.SUPER_ADMIN]); // roles

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should deny access when user lacks required role', () => {
            jest.spyOn(reflector, 'getAllAndOverride')
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(null) // permissions
                .mockReturnValueOnce([Role.SUPER_ADMIN]); // roles

            expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
        });

        it('should allow access when user has all required permissions', () => {
            jest.spyOn(reflector, 'getAllAndOverride')
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(['employee:create']); // permissions

            const result = guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should deny access when user lacks some required permissions', () => {
            jest.spyOn(reflector, 'getAllAndOverride')
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(['employee:create', 'employee:delete']); // permissions

            expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
        });

        it('should deny access when user has role but lacks permissions', () => {
            const mockUserWithRole = {
                ...mockContext.switchToHttp().getRequest(),
                user: {
                    ...mockContext.switchToHttp().getRequest().user,
                    permissions: ['employee:read:all'], // Lacks 'employee:create'
                },
            };

            const mockContextWithRole = {
                ...mockContext,
                switchToHttp: () => ({ getRequest: () => mockUserWithRole }),
            } as any;

            jest.spyOn(reflector, 'getAllAndOverride')
                .mockReturnValueOnce(false) // isPublic
                .mockReturnValueOnce(['employee:create']) // permissions
                .mockReturnValueOnce([Role.ORG_ADMIN]); // roles (user has this)

            expect(() => guard.canActivate(mockContextWithRole)).toThrow(ForbiddenException);
        });
    });
});
