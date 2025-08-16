import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserContext } from '../interfaces/data-scope.interface';
import { RequestWithCorrelation } from '../middleware/correlation-id.middleware';

export interface RequestWithUser extends RequestWithCorrelation {
    user: UserContext;
}

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const user = request.user;

        // Skip if no user (public routes or unauthenticated)
        if (!user) {
            return true;
        }

        // Check if route is marked as public
        const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        // Get required permissions from decorator
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
            context.getHandler(),
            context.getClass(),
        ]);

        // Get required roles from decorator (alternative to permissions)
        const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
            context.getHandler(),
            context.getClass(),
        ]);

        // If no permissions or roles are required, allow access.
        if (
            (!requiredPermissions || requiredPermissions.length === 0) &&
            (!requiredRoles || requiredRoles.length === 0)
        ) {
            return true;
        }

        // Check role-based access
        if (requiredRoles && requiredRoles.length > 0) {
            const hasRole = requiredRoles.some(role => user.roles.includes(role));
            if (!hasRole) {
                throw new ForbiddenException('Insufficient role privileges');
            }
        }

        // Check permission-based access
        if (requiredPermissions && requiredPermissions.length > 0) {
            const hasAllPermissions = requiredPermissions.every(permission =>
                user.permissions?.includes(permission)
            );

            if (!hasAllPermissions) {
                throw new ForbiddenException('Insufficient permissions');
            }
        }

        return true;
    }
}
