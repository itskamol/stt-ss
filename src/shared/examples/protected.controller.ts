import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DataScopeGuard, JwtAuthGuard, RolesGuard } from '../guards';
import { NoScoping, Permissions, Public, Roles, Scope, User } from '../decorators';
import { DataScope, UserContext } from '../interfaces/data-scope.interface';

/**
 * Example controller demonstrating the use of guards and decorators
 * This is for documentation and testing purposes
 */
@Controller('example')
@UseGuards(JwtAuthGuard, DataScopeGuard, RolesGuard)
export class ProtectedController {
    @Get('public')
    @Public()
    getPublicData() {
        return { message: 'This is public data, no authentication required' };
    }

    @Get('authenticated')
    getAuthenticatedData(@User() user: UserContext) {
        return {
            message: 'This requires authentication but no specific permissions',
            user: {
                id: user.sub,
                email: user.email,
                organizationId: user.organizationId,
            },
        };
    }

    @Get('organization-scoped')
    @Permissions('employee:read:all')
    getOrganizationData(@User() user: UserContext, @Scope() scope: DataScope) {
        return {
            message: 'This data is scoped to your organization',
            organizationId: scope.organizationId,
            branchIds: scope.branchIds,
            userRoles: user.roles,
        };
    }

    @Get('admin-only')
    @Roles('ORG_ADMIN', 'SUPER_ADMIN')
    getAdminData(@User('roles') userRoles: string[]) {
        return {
            message: 'This is admin-only data',
            userRoles,
        };
    }

    @Get('super-admin-only')
    @NoScoping()
    @Roles('SUPER_ADMIN')
    getSuperAdminData(@User() user: UserContext) {
        return {
            message: 'This is super admin data with no organization scoping',
            userId: user.sub,
        };
    }

    @Post('create-employee')
    @Permissions('employee:create')
    createEmployee(@User() user: UserContext, @Scope() scope: DataScope) {
        return {
            message: 'Employee creation endpoint',
            createdBy: user.sub,
            organizationId: scope.organizationId,
            allowedBranches: scope.branchIds,
        };
    }

    @Get('branch-manager-only')
    @Permissions('employee:read:all', 'branch:update:managed')
    getBranchManagerData(@User() user: UserContext, @Scope() scope: DataScope) {
        return {
            message: 'This requires multiple permissions typically held by branch managers',
            managedBranches: scope.branchIds,
            userPermissions: user.permissions,
        };
    }

    @Get('user-info')
    getUserInfo(
        @User('sub') userId: string,
        @User('email') email: string,
        @User('organizationId') orgId: string,
        @Scope('organizationId') scopeOrgId: string
    ) {
        return {
            userId,
            email,
            organizationId: orgId,
            scopeOrganizationId: scopeOrgId,
        };
    }
}
