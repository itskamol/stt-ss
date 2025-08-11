import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LoggerService } from '../../core/logger/logger.service';
import { DataScope, UserContext } from '../interfaces/data-scope.interface';
import { RequestWithCorrelation } from '../middleware/correlation-id.middleware';

export interface RequestWithScope extends RequestWithCorrelation {
    user: UserContext;
    scope: DataScope;
}

@Injectable()
export class DataScopeGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly logger: LoggerService
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<RequestWithScope>();
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

        // Check if route requires no scoping (for super admin operations)
        const noScoping = this.reflector.getAllAndOverride<boolean>('noScoping', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (noScoping) {
            // Only SUPER_ADMIN can access no-scoping routes
            if (!user.roles.includes('SUPER_ADMIN')) {
                this.logger.logSecurityEvent(
                    'DATA_SCOPE_VIOLATION_NO_SCOPING',
                    {
                        userId: user.sub,
                        roles: user.roles,
                        url: request.url,
                        method: request.method,
                    },
                    user.sub,
                    user.organizationId,
                    request.correlationId
                );
                throw new ForbiddenException('Insufficient privileges for system-wide access');
            }
            return true;
        }

        // For all other routes, enforce organization-level scoping
        if (!user.organizationId) {
            this.logger.logSecurityEvent(
                'DATA_SCOPE_VIOLATION_NO_ORGANIZATION',
                {
                    userId: user.sub,
                    roles: user.roles,
                    url: request.url,
                    method: request.method,
                },
                user.sub,
                undefined,
                request.correlationId
            );
            throw new ForbiddenException('No organization context available');
        }

        // Create data scope object
        const scope: DataScope = {
            organizationId: user.organizationId,
            branchIds: user.branchIds,
        };

        // Attach scope to request for use in services
        request.scope = scope;

        this.logger.debug('Data scope applied', {
            userId: user.sub,
            organizationId: scope.organizationId,
            branchIds: scope.branchIds,
            url: request.url,
            method: request.method,
            correlationId: request.correlationId,
            module: 'data-scope-guard',
        });

        return true;
    }
}
