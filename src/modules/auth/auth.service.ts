import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';
import { CustomJwtService, JwtPayload } from './jwt.service';
import { CacheService } from '@/core/cache/cache.service';
import { PasswordUtil } from '@/shared/utils/password.util';
import { Role } from '@/shared/enums';
import { LoginDto, LoginResponseDto, RefreshTokenDto, RefreshTokenResponseDto } from '@/shared/dto';
import { User } from '@prisma/client';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';

@Injectable()
export class AuthService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly jwtService: CustomJwtService,
        private readonly cacheService: CacheService
    ) {}

    /**
     * Authenticate user with email and password
     */
    async login(loginDto: LoginDto): Promise<LoginResponseDto> {
        const { email, password } = loginDto;

        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is inactive');
        }

        const isPasswordValid = await PasswordUtil.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

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

        const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
            sub: user.id,
            email: user.email,
            organizationId,
            branchIds,
            roles,
            permissions,
        };

        const tokens = this.jwtService.generateTokenPair(jwtPayload);

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
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(
        refreshTokenDto: RefreshTokenDto
    ): Promise<RefreshTokenResponseDto> {
        const { refreshToken } = refreshTokenDto;

        const payload = this.jwtService.verifyRefreshToken(refreshToken);

        const tokenId = `${payload.sub}:${payload.tokenVersion}`;
        const isDenied = await this.cacheService.isRefreshTokenDenied(tokenId);
        if (isDenied) {
            throw new UnauthorizedException('Refresh token has been revoked');
        }

        const user = await this.userRepository.findById(payload.sub);
        if (!user || !user.isActive) {
            throw new UnauthorizedException('Invalid refresh token');
        }

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

        const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
            sub: user.id,
            email: user.email,
            organizationId,
            branchIds,
            roles,
            permissions,
        };

        const newTokens = this.jwtService.generateTokenPair(
            jwtPayload,
            payload.tokenVersion + 1
        );

        return newTokens;
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
    async logout(refreshToken: string, userId: string): Promise<void> {
        try {
            const payload = this.jwtService.verifyRefreshToken(refreshToken);
            const tokenId = `${payload.sub}:${payload.tokenVersion}`;
            await this.cacheService.denyRefreshToken(tokenId, payload.exp || 0);
        } catch (error) {
            // Do not throw error on logout
        }
    }

    /**
     * Get permissions for a given role
     */
    private getPermissionsForRole(role: Role): string[] {
        const permissionMatrix: Record<Role, string[]> = {
            [Role.SUPER_ADMIN]: [
                PERMISSIONS.ORGANIZATION.CREATE,
                PERMISSIONS.ORGANIZATION.READ_ALL,
                PERMISSIONS.ORGANIZATION.READ_SELF,
                PERMISSIONS.ORGANIZATION.UPDATE_SELF,
                PERMISSIONS.USER.CREATE_ORG_ADMIN,
                PERMISSIONS.USER.MANAGE_ORG,
                PERMISSIONS.ADMIN.QUEUE_READ,
                PERMISSIONS.ADMIN.QUEUE_MANAGE,
                PERMISSIONS.ADMIN.SYSTEM_MANAGE,
                PERMISSIONS.AUDIT.READ_SYSTEM,
            ],
            [Role.ORG_ADMIN]: [
                PERMISSIONS.ORGANIZATION.READ_SELF,
                PERMISSIONS.ORGANIZATION.UPDATE_SELF,
                PERMISSIONS.USER.MANAGE_ORG,
                PERMISSIONS.BRANCH.CREATE,
                PERMISSIONS.BRANCH.READ_ALL,
                PERMISSIONS.BRANCH.UPDATE_MANAGED,
                PERMISSIONS.DEPARTMENT.CREATE,
                PERMISSIONS.DEPARTMENT.MANAGE_ALL,
                PERMISSIONS.EMPLOYEE.CREATE,
                PERMISSIONS.EMPLOYEE.READ_ALL,
                PERMISSIONS.EMPLOYEE.READ_SELF,
                PERMISSIONS.EMPLOYEE.UPDATE_ALL,
                PERMISSIONS.EMPLOYEE.DELETE,
                PERMISSIONS.DEVICE.CREATE,
                PERMISSIONS.DEVICE.READ_ALL,
                PERMISSIONS.DEVICE.MANAGE_ALL,
                PERMISSIONS.DEVICE.UPDATE_MANAGED,
                PERMISSIONS.DEVICE.MANAGE_MANAGED,
                PERMISSIONS.GUEST.CREATE,
                PERMISSIONS.GUEST.READ_ALL,
                PERMISSIONS.GUEST.UPDATE_MANAGED,
                PERMISSIONS.GUEST.MANAGE,
                PERMISSIONS.GUEST.APPROVE,
                PERMISSIONS.ATTENDANCE.CREATE,
                PERMISSIONS.ATTENDANCE.READ_ALL,
                PERMISSIONS.ATTENDANCE.DELETE_MANAGED,
                PERMISSIONS.REPORT.GENERATE_ORG,
                PERMISSIONS.REPORT.GENERATE_BRANCH,
                PERMISSIONS.REPORT.READ_ALL,
                PERMISSIONS.AUDIT.READ_ORG,
            ],
            [Role.BRANCH_MANAGER]: [
                PERMISSIONS.BRANCH.READ_ALL,
                PERMISSIONS.BRANCH.UPDATE_MANAGED,
                PERMISSIONS.DEPARTMENT.CREATE,
                PERMISSIONS.DEPARTMENT.MANAGE_ALL,
                PERMISSIONS.EMPLOYEE.CREATE,
                PERMISSIONS.EMPLOYEE.READ_ALL,
                PERMISSIONS.EMPLOYEE.READ_SELF,
                PERMISSIONS.EMPLOYEE.UPDATE_ALL,
                PERMISSIONS.EMPLOYEE.UPDATE_MANAGED,
                PERMISSIONS.EMPLOYEE.DELETE,
                PERMISSIONS.DEVICE.CREATE,
                PERMISSIONS.DEVICE.READ_ALL,
                PERMISSIONS.DEVICE.MANAGE_ALL,
                PERMISSIONS.DEVICE.UPDATE_MANAGED,
                PERMISSIONS.DEVICE.MANAGE_MANAGED,
                PERMISSIONS.GUEST.CREATE,
                PERMISSIONS.GUEST.READ_ALL,
                PERMISSIONS.GUEST.UPDATE_MANAGED,
                PERMISSIONS.GUEST.MANAGE,
                PERMISSIONS.GUEST.APPROVE,
                PERMISSIONS.ATTENDANCE.CREATE,
                PERMISSIONS.ATTENDANCE.READ_ALL,
                PERMISSIONS.ATTENDANCE.DELETE_MANAGED,
                PERMISSIONS.REPORT.GENERATE_BRANCH,
            ],
            [Role.EMPLOYEE]: [
                PERMISSIONS.EMPLOYEE.READ_SELF,
                PERMISSIONS.ATTENDANCE.CREATE,
            ],
        };

        return permissionMatrix[role] || [];
    }
}
