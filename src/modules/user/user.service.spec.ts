import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from '../../shared/dto';
import { DatabaseUtil, PasswordUtil } from '../../shared/utils';
import { Role } from '../../shared/enums';

// Mock the utility functions
jest.mock('../../shared/utils/password.util');
jest.mock('../../shared/utils/database.util');

describe('UserService', () => {
    let service: UserService;

    const mockUserRepository = {
        create: jest.fn(),
        findById: jest.fn(),
        findByEmail: jest.fn(),
        update: jest.fn(),
        updatePassword: jest.fn(),
        assignToOrganization: jest.fn(),
        removeFromOrganization: jest.fn(),
        findUserWithOrganizations: jest.fn(),
        findOrganizationUsers: jest.fn(),
    };

    const mockLogger = {
        logUserAction: jest.fn(),
        logSecurityEvent: jest.fn(),
    };

    const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        fullName: 'Test User',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: UserRepository,
                    useValue: mockUserRepository,
                },
                {
                    provide: LoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        service = module.get<UserService>(UserService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createUser', () => {
        const createUserDto: CreateUserDto = {
            email: 'newuser@example.com',
            password: 'StrongPassword123!',
            fullName: 'New User',
        };

        it('should create a user successfully', async () => {
            (PasswordUtil.validatePassword as jest.Mock).mockReturnValue({
                isValid: true,
                errors: [],
            });
            (PasswordUtil.hash as jest.Mock).mockResolvedValue('hashed-password');
            mockUserRepository.create.mockResolvedValue(mockUser);

            const result = await service.createUser(createUserDto, 'correlation-123');

            expect(PasswordUtil.validatePassword).toHaveBeenCalledWith('StrongPassword123!');
            expect(PasswordUtil.hash).toHaveBeenCalledWith('StrongPassword123!');
            expect(mockUserRepository.create).toHaveBeenCalledWith({
                ...createUserDto,
                passwordHash: 'hashed-password',
            });
            expect(mockLogger.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'USER_CREATED',
                { email: 'test@example.com' },
                undefined,
                'correlation-123'
            );
            expect(result).toEqual(mockUser);
        });

        it('should throw ConflictException for weak password', async () => {
            (PasswordUtil.validatePassword as jest.Mock).mockReturnValue({
                isValid: false,
                errors: ['Password too weak'],
            });

            await expect(service.createUser(createUserDto, 'correlation-123')).rejects.toThrow(
                ConflictException
            );
            expect(mockUserRepository.create).not.toHaveBeenCalled();
        });

        it('should handle unique constraint violation', async () => {
            (PasswordUtil.validatePassword as jest.Mock).mockReturnValue({
                isValid: true,
                errors: [],
            });
            (PasswordUtil.hash as jest.Mock).mockResolvedValue('hashed-password');

            const uniqueError = new Error('Unique constraint violation');
            (DatabaseUtil.isUniqueConstraintError as jest.Mock).mockReturnValue(true);
            (DatabaseUtil.getUniqueConstraintFields as jest.Mock).mockReturnValue(['email']);
            mockUserRepository.create.mockRejectedValue(uniqueError);

            await expect(service.createUser(createUserDto, 'correlation-123')).rejects.toThrow(
                ConflictException
            );
        });
    });

    describe('findById', () => {
        it('should return user by id', async () => {
            mockUserRepository.findById.mockResolvedValue(mockUser);

            const result = await service.findById('user-123');

            expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
            expect(result).toEqual(mockUser);
        });

        it('should return null when user not found', async () => {
            mockUserRepository.findById.mockResolvedValue(null);

            const result = await service.findById('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('updateUser', () => {
        const updateUserDto: UpdateUserDto = {
            fullName: 'Updated Name',
            isActive: false,
        };

        it('should update user successfully', async () => {
            const updatedUser = { ...mockUser, ...updateUserDto };
            mockUserRepository.findById.mockResolvedValue(mockUser);
            mockUserRepository.update.mockResolvedValue(updatedUser);

            const result = await service.updateUser('user-123', updateUserDto, 'correlation-123');

            expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
            expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', updateUserDto);
            expect(mockLogger.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'USER_UPDATED',
                { changes: updateUserDto },
                undefined,
                'correlation-123'
            );
            expect(result).toEqual(updatedUser);
        });

        it('should throw NotFoundException when user not found', async () => {
            mockUserRepository.findById.mockResolvedValue(null);

            await expect(
                service.updateUser('nonexistent', updateUserDto, 'correlation-123')
            ).rejects.toThrow(NotFoundException);
            expect(mockUserRepository.update).not.toHaveBeenCalled();
        });
    });

    describe('changePassword', () => {
        const changePasswordDto: ChangePasswordDto = {
            currentPassword: 'OldPassword123!',
            newPassword: 'NewPassword123!',
        };

        it('should change password successfully', async () => {
            mockUserRepository.findById.mockResolvedValue(mockUser);
            (PasswordUtil.compare as jest.Mock).mockResolvedValue(true);
            (PasswordUtil.validatePassword as jest.Mock).mockReturnValue({
                isValid: true,
                errors: [],
            });
            (PasswordUtil.hash as jest.Mock).mockResolvedValue('new-hashed-password');
            mockUserRepository.updatePassword.mockResolvedValue(undefined);

            await service.changePassword('user-123', changePasswordDto, 'correlation-123');

            expect(PasswordUtil.compare).toHaveBeenCalledWith('OldPassword123!', 'hashed-password');
            expect(PasswordUtil.validatePassword).toHaveBeenCalledWith('NewPassword123!');
            expect(PasswordUtil.hash).toHaveBeenCalledWith('NewPassword123!');
            expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(
                'user-123',
                'new-hashed-password'
            );
            expect(mockLogger.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'PASSWORD_CHANGED',
                {},
                undefined,
                'correlation-123'
            );
        });

        it('should throw NotFoundException when user not found', async () => {
            mockUserRepository.findById.mockResolvedValue(null);

            await expect(
                service.changePassword('nonexistent', changePasswordDto, 'correlation-123')
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ConflictException for invalid current password', async () => {
            mockUserRepository.findById.mockResolvedValue(mockUser);
            (PasswordUtil.compare as jest.Mock).mockResolvedValue(false);

            await expect(
                service.changePassword('user-123', changePasswordDto, 'correlation-123')
            ).rejects.toThrow(ConflictException);
            expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
                'PASSWORD_CHANGE_FAILED_INVALID_CURRENT',
                { userId: 'user-123' },
                'user-123',
                undefined,
                'correlation-123'
            );
        });

        it('should throw ConflictException for weak new password', async () => {
            mockUserRepository.findById.mockResolvedValue(mockUser);
            (PasswordUtil.compare as jest.Mock).mockResolvedValue(true);
            (PasswordUtil.validatePassword as jest.Mock).mockReturnValue({
                isValid: false,
                errors: ['Password too weak'],
            });

            await expect(
                service.changePassword('user-123', changePasswordDto, 'correlation-123')
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('assignToOrganization', () => {
        const assignDto = {
            userId: 'user-123',
            organizationId: 'org-456',
            role: Role.ORG_ADMIN,
        };

        it('should assign user to organization successfully', async () => {
            const mockOrgUser = {
                id: 'org-user-123',
                userId: 'user-123',
                organizationId: 'org-456',
                role: Role.ORG_ADMIN,
                createdAt: new Date(),
            };

            mockUserRepository.assignToOrganization.mockResolvedValue(mockOrgUser);

            const result = await service.assignToOrganization(assignDto, 'correlation-123');

            expect(mockUserRepository.assignToOrganization).toHaveBeenCalledWith(assignDto);
            expect(mockLogger.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'USER_ASSIGNED_TO_ORGANIZATION',
                {
                    organizationId: 'org-456',
                    role: Role.ORG_ADMIN,
                    branchIds: undefined,
                },
                'org-456',
                'correlation-123'
            );
            expect(result).toEqual(mockOrgUser);
        });

        it('should handle unique constraint violation', async () => {
            const uniqueError = new Error('Unique constraint violation');
            (DatabaseUtil.isUniqueConstraintError as jest.Mock).mockReturnValue(true);
            mockUserRepository.assignToOrganization.mockRejectedValue(uniqueError);

            await expect(
                service.assignToOrganization(assignDto, 'correlation-123')
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('activateUser', () => {
        it('should activate user', async () => {
            const activatedUser = { ...mockUser, isActive: true };
            mockUserRepository.findById.mockResolvedValue(mockUser);
            mockUserRepository.update.mockResolvedValue(activatedUser);

            const result = await service.activateUser('user-123', 'correlation-123');

            expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', { isActive: true });
            expect(mockLogger.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'USER_ACTIVATED',
                {},
                undefined,
                'correlation-123'
            );
            expect(result).toEqual(activatedUser);
        });
    });

    describe('deactivateUser', () => {
        it('should deactivate user', async () => {
            const deactivatedUser = { ...mockUser, isActive: false };
            mockUserRepository.findById.mockResolvedValue(mockUser);
            mockUserRepository.update.mockResolvedValue(deactivatedUser);

            const result = await service.deactivateUser('user-123', 'correlation-123');

            expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', { isActive: false });
            expect(mockLogger.logUserAction).toHaveBeenCalledWith(
                'user-123',
                'USER_DEACTIVATED',
                {},
                undefined,
                'correlation-123'
            );
            expect(result).toEqual(deactivatedUser);
        });
    });
});
