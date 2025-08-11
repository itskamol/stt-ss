import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';
import { CustomJwtService, JwtPayload } from './jwt.service';
import { LoggerService } from '../../core/logger/logger.service';
import { CacheService } from '../../core/cache/cache.service';
import { PasswordUtil } from '../../shared/utils/password.util';
import { Role } from '../../shared/enums';

export interface LoginDto {
    email: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        email: string;
        fullName?: string;
        organizationId?: string;
        roles: string[];
    };
}

export interface RefreshTokenDto {
    refreshToken: string;
}

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
                this.logger.logSecurityEvent(
                    'LOGIN_FAILED_USER_NOT_FOUND',
                    { email },
                    undefined,
                    undefined,
                    correlationId
                );
                throw new UnauthorizedException('Invalid credentials');
            }

            // Check if user is active
            if (!user.isActive) {
                this.logger.logSecurityEvent(
                    'LOGIN_FAILED_USER_INACTIVE',
                    { email, userId: user.id },
                    user.id,
                    undefined,
                    correlationId
                );
                throw new UnauthorizedException('Account is inactive');
            }

            // Verify password
            const isPasswordValid = await PasswordUtil.compare(password, user.passwordHash);
            if (!isPasswordValid) {
                this.logger.logSecurityEvent(
                    'LOGIN_FAILED_INVALID_PASSWORD',
                    { email, userId: user.id },
                    user.id,
                    undefined,
                    correlationId
                );
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

            this.logger.logUserAction(
                user.id,
                'LOGIN_SUCCESS',
                { email, organizationId, roles },
                organizationId,
                correlationId
            );

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
                this.logger.logSecurityEvent(
                    'REFRESH_TOKEN_DENIED',
                    { userId: payload.sub, tokenVersion: payload.tokenVersion },
                    payload.sub,
                    undefined,
                    correlationId
                );
                throw new UnauthorizedException('Refresh token has been revoked');
            }

            // Find user
            const user = await this.userRepository.findById(payload.sub);
            if (!user || !user.isActive) {
                this.logger.logSecurityEvent(
                    'REFRESH_TOKEN_FAILED_USER_INVALID',
                    { userId: payload.sub },
                    payload.sub,
                    undefined,
                    correlationId
                );
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

            this.logger.logUserAction(
                user.id,
                'TOKEN_REFRESH_SUCCESS',
                { organizationId },
                organizationId,
                correlationId
            );

            return newTokens;
        } catch (error) {
            this.logger.logSecurityEvent(
                'REFRESH_TOKEN_FAILED',
                { error: error.message },
                undefined,
                undefined,
                correlationId
            );
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    /**
     * Validate user by ID (used by JWT strategy)
     */
    async validateUser(userId: string): Promise<any> {
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

            this.logger.logUserAction(
                payload.sub,
                'LOGOUT_TOKEN_DENIED',
                { tokenVersion: payload.tokenVersion },
                undefined,
                correlationId
            );
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
                'organization:create',
                'organization:read:all',
                'organization:read:self',
                'organization:update:self',
                'user:create:org_admin',
                'user:manage:org',
                'audit:read:system',
            ],
            [Role.ORG_ADMIN]: [
                'organization:read:self',
                'organization:update:self',
                'user:manage:org',
                'branch:create',
                'branch:read:all',
                'branch:update:managed',
                'department:create',
                'department:manage:all',
                'employee:create',
                'employee:read:all',
                'employee:read:self',
                'employee:update:all',
                'employee:delete',
                'device:create',
                'device:manage:all',
                'guest:create',
                'guest:approve',
                'report:generate:org',
                'report:generate:branch',
                'audit:read:org',
            ],
            [Role.BRANCH_MANAGER]: [
                'branch:read:all',
                'branch:update:managed',
                'department:create',
                'department:manage:all',
                'employee:create',
                'employee:read:all',
                'employee:read:self',
                'employee:update:all',
                'employee:delete',
                'device:create',
                'device:manage:all',
                'guest:create',
                'guest:approve',
                'report:generate:branch',
            ],
            [Role.EMPLOYEE]: ['employee:read:self'],
        };

        return permissionMatrix[role] || [];
    }
}
