import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LoggerService } from '../../core/logger/logger.service';
import { UserContext } from '../interfaces/data-scope.interface';
import { RequestWithCorrelation } from '../middleware/correlation-id.middleware';

export interface RequestWithUser extends RequestWithCorrelation {
    user: UserContext;
}

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly logger: LoggerService
    ) {}

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

        // If no permissions are required, allow access
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        // Get required roles from decorator (alternative to permissions)
        const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
            context.getHandler(),
            context.getClass(),
        ]);

        // Check role-based access
        if (requiredRoles && requiredRoles.length > 0) {
            const hasRole = requiredRoles.some(role => user.roles.includes(role));
            if (!hasRole) {
                this.logger.logSecurityEvent(
                    'ROLE_ACCESS_DENIED',
                    {
                        userId: user.sub,
                        userRoles: user.roles,
                        requiredRoles,
                        url: request.url,
                        method: request.method,
                    },
                    user.sub,
                    user.organizationId,
                    request.correlationId
                );
                throw new ForbiddenException('Insufficient role privileges');
            }
        }

        // Check permission-based access
        if (requiredPermissions && requiredPermissions.length > 0) {
            const hasAllPermissions = requiredPermissions.every(permission =>
                user.permissions.includes(permission)
            );

            if (!hasAllPermissions) {
                const missingPermissions = requiredPermissions.filter(
                    permission => !user.permissions.includes(permission)
                );

                this.logger.logSecurityEvent(
                    'PERMISSION_ACCESS_DENIED',
                    {
                        userId: user.sub,
                        userPermissions: user.permissions,
                        requiredPermissions,
                        missingPermissions,
                        url: request.url,
                        method: request.method,
                    },
                    user.sub,
                    user.organizationId,
                    request.correlationId
                );

                throw new ForbiddenException('Insufficient permissions');
            }
        }

        this.logger.debug('Role/permission check passed', {
            userId: user.sub,
            userRoles: user.roles,
            userPermissions: user.permissions,
            requiredRoles,
            requiredPermissions,
            url: request.url,
            method: request.method,
            correlationId: request.correlationId,
            module: 'roles-guard',
        });

        return true;
    }
}
