import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { LoggerService } from '@/core/logger';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from '@/shared/dto';
import { DataScope, UserContext } from '@/shared/interfaces';
import { Role } from '@/shared/enums';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { NotFoundException } from '@nestjs/common';
import { User as UserModel } from '@prisma/client';

describe('UserController', () => {
    let controller: UserController;

    const mockUserService = {
        createUser: jest.fn(),
        findById: jest.fn(),
        updateUser: jest.fn(),
        changePassword: jest.fn(),
        assignToOrganization: jest.fn(),
        removeFromOrganization: jest.fn(),
        activateUser: jest.fn(),
        deactivateUser: jest.fn(),
        getUserWithOrganizations: jest.fn(),
        getOrganizationUsers: jest.fn(),
    };

    const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    };

    const mockUser: UserContext = {
        sub: 'user-123',
        email: 'admin@example.com',
        organizationId: 'org-456',
        branchIds: [],
        roles: [Role.ORG_ADMIN],
        permissions: [PERMISSIONS.USER.MANAGE_ORG],
    };

    const mockScope: DataScope = {
        organizationId: 'org-456',
        branchIds: [],
    };

    const mockUserEntity: Partial<UserModel> = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UserController],
            providers: [
                {
                    provide: UserService,
                    useValue: mockUserService,
                },
                {
                    provide: LoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        controller = module.get<UserController>(UserController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createUser', () => {
        it('should create a new user', async () => {
            const createUserDto: CreateUserDto = {
                email: 'newuser@example.com',
                password: 'StrongPassword123!',
                fullName: 'New User',
            };

            mockUserService.createUser.mockResolvedValue(mockUserEntity);

            const result = await controller.createUser(createUserDto, mockUser);

            expect(mockUserService.createUser).toHaveBeenCalledWith(createUserDto, 'user-123');
            expect(result.id).toBe(mockUserEntity.id);
        });
    });

    describe('getUserById', () => {
        it('should return user by id', async () => {
            mockUserService.findById.mockResolvedValue(mockUserEntity);

            const result = await controller.getUserById('user-123', mockScope);

            expect(mockUserService.findById).toHaveBeenCalledWith('user-123');
            expect(result.id).toBe(mockUserEntity.id);
        });

        it('should throw error when user not found', async () => {
            mockUserService.findById.mockResolvedValue(null);

            await expect(controller.getUserById('nonexistent', mockScope)).rejects.toThrow(
                NotFoundException
            );
        });
    });

    describe('getOrganizationUsers', () => {
        it('should return paginated organization users', async () => {
            const mockOrgUsers = {
                data: [
                    {
                        id: 'org-user-1',
                        userId: 'user-1',
                        organizationId: 'org-456',
                        role: Role.ORG_ADMIN,
                        createdAt: new Date(),
                        user: {
                            id: 'user-1',
                            email: 'user1@example.com',
                            fullName: 'User One',
                            isActive: true,
                        },
                        managedBranches: [],
                    },
                ],
                total: 1,
                page: 1,
                limit: 10,
            };

            mockUserService.getOrganizationUsers.mockResolvedValue(mockOrgUsers);

            const paginationDto = { page: 1, limit: 10 };
            const result = await controller.getOrganizationUsers(mockScope, paginationDto);

            expect(mockUserService.getOrganizationUsers).toHaveBeenCalledWith(
                mockScope,
                paginationDto
            );
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
        });
    });

    describe('updateUser', () => {
        it('should update user', async () => {
            const updateUserDto: UpdateUserDto = {
                fullName: 'Updated Name',
                isActive: false,
            };

            const updatedUser = { ...mockUserEntity, ...updateUserDto };
            mockUserService.updateUser.mockResolvedValue(updatedUser);

            const result = await controller.updateUser('user-123', updateUserDto, mockUser);

            expect(mockUserService.updateUser).toHaveBeenCalledWith(
                'user-123',
                updateUserDto,
                'user-123'
            );
            expect(result.fullName).toBe('Updated Name');
        });
    });

    describe('changeUserPassword', () => {
        it('should change user password', async () => {
            const changePasswordDto: ChangePasswordDto = {
                currentPassword: 'OldPassword123!',
                newPassword: 'NewPassword123!',
            };

            mockUserService.changePassword.mockResolvedValue(undefined);

            await controller.changeUserPassword('user-123', changePasswordDto, mockUser);

            expect(mockUserService.changePassword).toHaveBeenCalledWith(
                'user-123',
                changePasswordDto,
                'user-123'
            );
        });
    });

    describe('assignUserToOrganization', () => {
        it('should assign user to organization', async () => {
            const assignDto = {
                userId: 'user-123',
                organizationId: 'org-789',
                role: Role.ORG_ADMIN,
            };

            const mockOrgUser = {
                id: 'org-user-123',
                userId: 'user-123',
                organizationId: 'org-789',
                role: Role.ORG_ADMIN,
                createdAt: new Date(),
            };

            mockUserService.assignToOrganization.mockResolvedValue(mockOrgUser);

            const result = await controller.assignUserToOrganization(
                'user-123',
                assignDto,
                mockUser
            );

            expect(mockUserService.assignToOrganization).toHaveBeenCalledWith(
                {
                    ...assignDto,
                    userId: 'user-123',
                },
                'user-123'
            );
            expect(result).toEqual(mockOrgUser);
        });
    });

    describe('removeUserFromOrganization', () => {
        it('should remove user from organization', async () => {
            mockUserService.removeFromOrganization.mockResolvedValue(undefined);

            await controller.removeUserFromOrganization('user-123', 'org-456', mockUser);

            expect(mockUserService.removeFromOrganization).toHaveBeenCalledWith(
                'user-123',
                'org-456',
                'user-123'
            );
        });
    });

    describe('activateUser', () => {
        it('should activate user', async () => {
            const activatedUser = { ...mockUserEntity, isActive: true };
            mockUserService.activateUser.mockResolvedValue(activatedUser);

            const result = await controller.activateUser('user-123', mockUser);

            expect(mockUserService.activateUser).toHaveBeenCalledWith('user-123', 'user-123');
            expect(result.isActive).toBe(true);
        });
    });

    describe('deactivateUser', () => {
        it('should deactivate user', async () => {
            const deactivatedUser = { ...mockUserEntity, isActive: false };
            mockUserService.deactivateUser.mockResolvedValue(deactivatedUser);

            const result = await controller.deactivateUser('user-123', mockUser);

            expect(mockUserService.deactivateUser).toHaveBeenCalledWith('user-123', 'user-123');
            expect(result.isActive).toBe(false);
        });
    });

    describe('getUserOrganizations', () => {
        it('should return user with organizations', async () => {
            const mockUserWithOrgs = {
                id: 'user-123',
                email: 'test@example.com',
                fullName: 'Test User',
                organizationLinks: [
                    {
                        organizationId: 'org-456',
                        organization: { name: 'Test Organization' },
                        role: Role.ORG_ADMIN,
                        createdAt: new Date(),
                        managedBranches: [
                            {
                                branchId: 'branch-1',
                                branch: { name: 'Main Branch' },
                                assignedAt: new Date(),
                            },
                        ],
                    },
                ],
            };

            mockUserService.getUserWithOrganizations.mockResolvedValue(mockUserWithOrgs);

            const result = await controller.getUserOrganizations('user-123');

            expect(mockUserService.getUserWithOrganizations).toHaveBeenCalledWith('user-123');
            expect(result.id).toEqual(mockUserWithOrgs.id);
        });

        it('should throw error when user not found', async () => {
            mockUserService.getUserWithOrganizations.mockResolvedValue(null);

            await expect(controller.getUserOrganizations('nonexistent')).rejects.toThrow(
                NotFoundException
            );
        });
    });
});
