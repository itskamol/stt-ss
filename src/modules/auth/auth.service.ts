import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';
import { CustomJwtService, JwtPayload } from './jwt.service';
import { LoggerService } from '@/core/logger';
import { CacheService } from '@/core/cache/cache.service';
import { PasswordUtil } from '@/shared/utils/password.util';
import { Role } from '@/shared/enums';
import { LoginDto, LoginResponse, RefreshTokenDto } from '@/shared/dto';
import { User } from '@prisma/client';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';

@Injectable()
export class AuthService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly jwtService: CustomJwtService,
        private readonly logger: LoggerService,
        private readonly cacheService: CacheService
    ) {}

    /**
     * Authenticate user with email and password
     */
    async login(loginDto: LoginDto, correlationId?: string): Promise<LoginResponse> {
        const { email, password } = loginDto;

        try {
            // Find user by email
            const user = await this.userRepository.findByEmail(email);
            if (!user) {
                this.logger.logUserAction(undefined, 'LOGIN_FAILED_USER_NOT_FOUND', {
                    email,
                    correlationId,
                });
                throw new UnauthorizedException('Invalid credentials');
            }

            // Check if user is active
            if (!user.isActive) {
                this.logger.logUserAction(user.id, 'LOGIN_FAILED_USER_INACTIVE', {
                    email,
                    userId: user.id,
                    correlationId,
                });
                throw new UnauthorizedException('Account is inactive');
            }

            // Verify password
            const isPasswordValid = await PasswordUtil.compare(password, user.passwordHash);
            if (!isPasswordValid) {
                this.logger.logUserAction(user.id, 'LOGIN_FAILED_INVALID_PASSWORD', {
                    email,
                    userId: user.id,
                    correlationId,
                });
                throw new UnauthorizedException('Invalid credentials');
            }

            // Get user's organization context
            const userWithOrganizations = await this.userRepository.findUserWithOrganizations(
                user.id
            );

            // For now, use the first organization (in a real app, user might select organization)
            const primaryOrgLink = userWithOrganizations?.organizationLinks?.[0];

            let organizationId: string | undefined;
            let branchIds: string[] = [];
            let roles: string[] = [];
            let permissions: string[] = [];

            if (primaryOrgLink) {
                organizationId = primaryOrgLink.organizationId;
                roles = [primaryOrgLink.role];
                permissions = this.getPermissionsForRole(primaryOrgLink.role);

                // If user is a branch manager, get their managed branches
                if (primaryOrgLink.role === Role.BRANCH_MANAGER) {
                    branchIds = primaryOrgLink.managedBranches.map(mb => mb.branchId);
                }
            }

            // Generate JWT payload
            const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
                sub: user.id,
                email: user.email,
                organizationId,
                branchIds,
                roles,
                permissions,
            };

            // Generate tokens
            const tokens = this.jwtService.generateTokenPair(jwtPayload);

            this.logger.logUserAction(user.id, 'LOGIN_SUCCESS', {
                email,
                roles,
                organizationId,
                correlationId,
            });

            return {
                ...tokens,
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.fullName,
                    organizationId,
                    roles,
                },
            };
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }

            this.logger.error('Login failed with unexpected error', error.message, {
                email,
                correlationId,
                module: 'auth',
            });
            throw new UnauthorizedException('Authentication failed');
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(
        refreshTokenDto: RefreshTokenDto,
        correlationId?: string
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const { refreshToken } = refreshTokenDto;

        try {
            // Verify refresh token
            const payload = this.jwtService.verifyRefreshToken(refreshToken);

            // Check if refresh token is denied (logged out)
            const tokenId = `${payload.sub}:${payload.tokenVersion}`;
            const isDenied = await this.cacheService.isRefreshTokenDenied(tokenId);
            if (isDenied) {
                this.logger.logUserAction(payload.sub, 'REFRESH_TOKEN_DENIED', {
                    userId: payload.sub,
                    tokenVersion: payload.tokenVersion,
                    correlationId,
                });
                throw new UnauthorizedException('Refresh token has been revoked');
            }

            // Find user
            const user = await this.userRepository.findById(payload.sub);
            if (!user || !user.isActive) {
                this.logger.logUserAction(payload.sub, 'REFRESH_TOKEN_FAILED_USER_INVALID', {
                    userId: payload.sub,
                    correlationId,
                });
                throw new UnauthorizedException('Invalid refresh token');
            }

            // Get user's current organization context
            const userWithOrganizations = await this.userRepository.findUserWithOrganizations(
                user.id
            );
            const primaryOrgLink = userWithOrganizations?.organizationLinks?.[0];

            let organizationId: string | undefined;
            let branchIds: string[] = [];
            let roles: string[] = [];
            let permissions: string[] = [];

            if (primaryOrgLink) {
                organizationId = primaryOrgLink.organizationId;
                roles = [primaryOrgLink.role];
                permissions = this.getPermissionsForRole(primaryOrgLink.role);

                if (primaryOrgLink.role === Role.BRANCH_MANAGER) {
                    branchIds = primaryOrgLink.managedBranches.map(mb => mb.branchId);
                }
            }

            // Generate new JWT payload
            const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
                sub: user.id,
                email: user.email,
                organizationId,
                branchIds,
                roles,
                permissions,
            };

            // Generate new token pair (refresh token rotation)
            const newTokens = this.jwtService.generateTokenPair(
                jwtPayload,
                payload.tokenVersion + 1
            );

            this.logger.logUserAction(user.id, 'TOKEN_REFRESH_SUCCESS', {
                organizationId,
                correlationId,
            });

            return newTokens;
        } catch (error) {
            this.logger.logUserAction(undefined, 'REFRESH_TOKEN_FAILED', {
                error: error.message,
                correlationId,
            });
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    /**
     * Validate user by ID (used by JWT strategy)
     */
    async validateUser(userId: string): Promise<User | null> {
        const user = await this.userRepository.findById(userId);
        if (!user || !user.isActive) {
            return null;
        }
        return user;
    }

    /**
     * Logout user by adding refresh token to denylist
     */
    async logout(refreshToken: string, correlationId?: string): Promise<void> {
        try {
            // Verify and decode refresh token to get payload
            const payload = this.jwtService.verifyRefreshToken(refreshToken);

            // Add refresh token to denylist
            const tokenId = `${payload.sub}:${payload.tokenVersion}`;
            await this.cacheService.denyRefreshToken(tokenId, payload.exp || 0);

            this.logger.logUserAction(payload.sub, 'LOGOUT_TOKEN_DENIED', {
                tokenVersion: payload.tokenVersion,
                correlationId,
            });
        } catch (error) {
            // Even if token verification fails, we don't throw an error for logout
            // This prevents issues with already expired tokens
            this.logger.warn('Logout attempted with invalid refresh token', {
                error: error.message,
                correlationId,
                module: 'auth',
            });
        }
    }

    /**
     * Get permissions for a given role
     */
    private getPermissionsForRole(role: Role): string[] {
        const permissionMatrix: Record<Role, string[]> = {
            [Role.SUPER_ADMIN]: [
                // Organization permissions
                PERMISSIONS.ORGANIZATION.CREATE,
                PERMISSIONS.ORGANIZATION.READ_ALL,
                PERMISSIONS.ORGANIZATION.READ_SELF,
                PERMISSIONS.ORGANIZATION.UPDATE_SELF,
                // User management
                PERMISSIONS.USER.CREATE_ORG_ADMIN,
                PERMISSIONS.USER.MANAGE_ORG,
                // System admin permissions
                PERMISSIONS.ADMIN.QUEUE_READ,
                PERMISSIONS.ADMIN.QUEUE_MANAGE,
                PERMISSIONS.ADMIN.SYSTEM_MANAGE,
                // Audit permissions
                PERMISSIONS.AUDIT.READ_SYSTEM,
            ],
            [Role.ORG_ADMIN]: [
                // Organization permissions
                PERMISSIONS.ORGANIZATION.READ_SELF,
                PERMISSIONS.ORGANIZATION.UPDATE_SELF,
                // User management
                PERMISSIONS.USER.MANAGE_ORG,
                // Branch permissions
                PERMISSIONS.BRANCH.CREATE,
                PERMISSIONS.BRANCH.READ_ALL,
                PERMISSIONS.BRANCH.UPDATE_MANAGED,
                // Department permissions
                PERMISSIONS.DEPARTMENT.CREATE,
                PERMISSIONS.DEPARTMENT.MANAGE_ALL,
                // Employee permissions
                PERMISSIONS.EMPLOYEE.CREATE,
                PERMISSIONS.EMPLOYEE.READ_ALL,
                PERMISSIONS.EMPLOYEE.READ_SELF,
                PERMISSIONS.EMPLOYEE.UPDATE_ALL,
                PERMISSIONS.EMPLOYEE.DELETE,
                // Device permissions
                PERMISSIONS.DEVICE.CREATE,
                PERMISSIONS.DEVICE.READ_ALL,
                PERMISSIONS.DEVICE.MANAGE_ALL,
                PERMISSIONS.DEVICE.UPDATE_MANAGED,
                PERMISSIONS.DEVICE.MANAGE_MANAGED,
                // Guest permissions
                PERMISSIONS.GUEST.CREATE,
                PERMISSIONS.GUEST.READ_ALL,
                PERMISSIONS.GUEST.UPDATE_MANAGED,
                PERMISSIONS.GUEST.MANAGE,
                PERMISSIONS.GUEST.APPROVE,
                // Attendance permissions
                PERMISSIONS.ATTENDANCE.CREATE,
                PERMISSIONS.ATTENDANCE.READ_ALL,
                PERMISSIONS.ATTENDANCE.DELETE_MANAGED,
                // Report permissions
                PERMISSIONS.REPORT.GENERATE_ORG,
                PERMISSIONS.REPORT.GENERATE_BRANCH,
                PERMISSIONS.REPORT.READ_ALL,
                // Audit permissions
                PERMISSIONS.AUDIT.READ_ORG,
            ],
            [Role.BRANCH_MANAGER]: [
                // Branch permissions
                PERMISSIONS.BRANCH.READ_ALL,
                PERMISSIONS.BRANCH.UPDATE_MANAGED,
                // Department permissions
                PERMISSIONS.DEPARTMENT.CREATE,
                PERMISSIONS.DEPARTMENT.MANAGE_ALL,
                // Employee permissions
                PERMISSIONS.EMPLOYEE.CREATE,
                PERMISSIONS.EMPLOYEE.READ_ALL,
                PERMISSIONS.EMPLOYEE.READ_SELF,
                PERMISSIONS.EMPLOYEE.UPDATE_ALL,
                PERMISSIONS.EMPLOYEE.UPDATE_MANAGED,
                PERMISSIONS.EMPLOYEE.DELETE,
                // Device permissions
                PERMISSIONS.DEVICE.CREATE,
                PERMISSIONS.DEVICE.READ_ALL,
                PERMISSIONS.DEVICE.MANAGE_ALL,
                PERMISSIONS.DEVICE.UPDATE_MANAGED,
                PERMISSIONS.DEVICE.MANAGE_MANAGED,
                // Guest permissions
                PERMISSIONS.GUEST.CREATE,
                PERMISSIONS.GUEST.READ_ALL,
                PERMISSIONS.GUEST.UPDATE_MANAGED,
                PERMISSIONS.GUEST.MANAGE,
                PERMISSIONS.GUEST.APPROVE,
                // Attendance permissions
                PERMISSIONS.ATTENDANCE.CREATE,
                PERMISSIONS.ATTENDANCE.READ_ALL,
                PERMISSIONS.ATTENDANCE.DELETE_MANAGED,
                // Report permissions
                PERMISSIONS.REPORT.GENERATE_BRANCH,
            ],
            [Role.EMPLOYEE]: [
                // Employee permissions
                PERMISSIONS.EMPLOYEE.READ_SELF,
                // Basic attendance permissions
                PERMISSIONS.ATTENDANCE.CREATE,
            ],
        };

        return permissionMatrix[role] || [];
    }
}
