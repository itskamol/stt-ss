import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { UserRepository } from './user.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { DatabaseUtil, PasswordUtil } from '../../shared/utils';
import {
    AssignUserToOrganizationDto,
    ChangePasswordDto,
    CreateUserDto,
    UpdateUserDto,
} from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';

@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly logger: LoggerService
    ) {}

    /**
     * Create a new user
     */
    async createUser(createUserDto: CreateUserDto, correlationId?: string): Promise<User> {
        try {
            // Validate password strength
            const passwordValidation = PasswordUtil.validatePassword(createUserDto.password);
            if (!passwordValidation.isValid) {
                throw new ConflictException(
                    `Password validation failed: ${passwordValidation.errors.join(', ')}`
                );
            }

            // Hash password
            const passwordHash = await PasswordUtil.hash(createUserDto.password);

            // Create user
            const user = await this.userRepository.create({
                ...createUserDto,
                passwordHash,
            });

            this.logger.logUserAction(
                user.id,
                'USER_CREATED',
                { email: user.email },
                undefined,
                correlationId
            );

            return user;
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                const fields = DatabaseUtil.getUniqueConstraintFields(error);
                throw new ConflictException(`User with this ${fields.join(', ')} already exists`);
            }
            throw error;
        }
    }

    /**
     * Find user by ID
     */
    async findById(id: string): Promise<User | null> {
        return this.userRepository.findById(id);
    }

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<User | null> {
        return this.userRepository.findByEmail(email);
    }

    /**
     * Update user
     */
    async updateUser(
        id: string,
        updateUserDto: UpdateUserDto,
        correlationId?: string
    ): Promise<User> {
        try {
            const existingUser = await this.userRepository.findById(id);
            if (!existingUser) {
                throw new NotFoundException('User not found');
            }

            const updatedUser = await this.userRepository.update(id, updateUserDto);

            this.logger.logUserAction(
                id,
                'USER_UPDATED',
                { changes: updateUserDto },
                undefined,
                correlationId
            );

            return updatedUser;
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                const fields = DatabaseUtil.getUniqueConstraintFields(error);
                throw new ConflictException(`User with this ${fields.join(', ')} already exists`);
            }
            throw error;
        }
    }

    /**
     * Change user password
     */
    async changePassword(
        userId: string,
        changePasswordDto: ChangePasswordDto,
        correlationId?: string
    ): Promise<void> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Verify current password
        const isCurrentPasswordValid = await PasswordUtil.compare(
            changePasswordDto.currentPassword,
            user.passwordHash
        );
        if (!isCurrentPasswordValid) {
            this.logger.logSecurityEvent(
                'PASSWORD_CHANGE_FAILED_INVALID_CURRENT',
                { userId },
                userId,
                undefined,
                correlationId
            );
            throw new ConflictException('Current password is incorrect');
        }

        // Validate new password strength
        const passwordValidation = PasswordUtil.validatePassword(changePasswordDto.newPassword);
        if (!passwordValidation.isValid) {
            throw new ConflictException(
                `Password validation failed: ${passwordValidation.errors.join(', ')}`
            );
        }

        // Hash new password
        const newPasswordHash = await PasswordUtil.hash(changePasswordDto.newPassword);

        // Update password
        await this.userRepository.updatePassword(userId, newPasswordHash);

        this.logger.logUserAction(userId, 'PASSWORD_CHANGED', {}, undefined, correlationId);
    }

    /**
     * Assign user to organization with role
     */
    async assignToOrganization(assignDto: AssignUserToOrganizationDto, correlationId?: string) {
        try {
            const orgUser = await this.userRepository.assignToOrganization(assignDto);

            this.logger.logUserAction(
                assignDto.userId,
                'USER_ASSIGNED_TO_ORGANIZATION',
                {
                    organizationId: assignDto.organizationId,
                    role: assignDto.role,
                    branchIds: assignDto.branchIds,
                },
                assignDto.organizationId,
                correlationId
            );

            return orgUser;
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                throw new ConflictException('User is already assigned to this organization');
            }
            throw error;
        }
    }

    /**
     * Remove user from organization
     */
    async removeFromOrganization(
        userId: string,
        organizationId: string,
        correlationId?: string
    ): Promise<void> {
        await this.userRepository.removeFromOrganization(userId, organizationId);

        this.logger.logUserAction(
            userId,
            'USER_REMOVED_FROM_ORGANIZATION',
            { organizationId },
            organizationId,
            correlationId
        );
    }

    /**
     * Get user with organization context
     */
    async getUserWithOrganizations(userId: string) {
        return this.userRepository.findUserWithOrganizations(userId);
    }

    /**
     * Get organization users (scoped)
     */
    async getOrganizationUsers(scope: DataScope) {
        return this.userRepository.findOrganizationUsers(scope.organizationId, scope);
    }

    /**
     * Deactivate user
     */
    async deactivateUser(id: string, correlationId?: string): Promise<User> {
        const user = await this.updateUser(id, { isActive: false }, correlationId);

        this.logger.logUserAction(id, 'USER_DEACTIVATED', {}, undefined, correlationId);

        return user;
    }

    /**
     * Activate user
     */
    async activateUser(id: string, correlationId?: string): Promise<User> {
        const user = await this.updateUser(id, { isActive: true }, correlationId);

        this.logger.logUserAction(id, 'USER_ACTIVATED', {}, undefined, correlationId);

        return user;
    }
}
