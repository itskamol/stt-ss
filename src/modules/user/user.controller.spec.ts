import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { LoggerService } from '../../core/logger/logger.service';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from '../../shared/dto';
import { DataScope, UserContext } from '../../shared/interfaces';
import { Role } from '../../shared/enums';

describe('UserController', () => {
    let controller: UserController;
    let userService: UserService;
    let logger: LoggerService;

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
        roles: ['ORG_ADMIN'],
        permissions: ['user:manage:org'],
    };

    const mockScope: DataScope = {
        organizationId: 'org-456',
        branchIds: [],
    };

    const mockUserEntity = {
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
        userService = module.get<UserService>(UserService);
        logger = module.get<LoggerService>(LoggerService);
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
            expect(result).toEqual({
                id: mockUserEntity.id,
                email: mockUserEntity.email,
                fullName: mockUserEntity.fullName,
                isActive: mockUserEntity.isActive,
                createdAt: mockUserEntity.createdAt,
                updatedAt: mockUserEntity.updatedAt,
            });
        });
    });

    describe('getUserById', () => {
        it('should return user by id', async () => {
            mockUserService.findById.mockResolvedValue(mockUserEntity);

            const result = await controller.getUserById('user-123', mockScope);

            expect(mockUserService.findById).toHaveBeenCalledWith('user-123');
            expect(result).toEqual({
                id: mockUserEntity.id,
                email: mockUserEntity.email,
                fullName: mockUserEntity.fullName,
                isActive: mockUserEntity.isActive,
                createdAt: mockUserEntity.createdAt,
                updatedAt: mockUserEntity.updatedAt,
            });
        });

        it('should throw error when user not found', async () => {
            mockUserService.findById.mockResolvedValue(null);

            await expect(controller.getUserById('nonexistent', mockScope)).rejects.toThrow(
                'User not found'
            );
        });
    });

    describe('getOrganizationUsers', () => {
        it('should return paginated organization users', async () => {
            const mockOrgUsers = [
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
                {
                    id: 'org-user-2',
                    userId: 'user-2',
                    organizationId: 'org-456',
                    role: Role.BRANCH_MANAGER,
                    createdAt: new Date(),
                    user: {
                        id: 'user-2',
                        email: 'user2@example.com',
                        fullName: 'User Two',
                        isActive: true,
                    },
                    managedBranches: [
                        {
                            branchId: 'branch-1',
                            branch: { name: 'Main Branch' },
                        },
                    ],
                },
            ];

            mockUserService.getOrganizationUsers.mockResolvedValue(mockOrgUsers);

            const result = await controller.getOrganizationUsers(mockScope, { page: 1, limit: 10 });

            expect(mockUserService.getOrganizationUsers).toHaveBeenCalledWith(mockScope);
            expect(result.data).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
            expect(result.data[0]).toEqual(
                expect.objectContaining({
                    id: 'user-1',
                    email: 'user1@example.com',
                    role: Role.ORG_ADMIN,
                    managedBranches: [],
                })
            );
            expect(result.data[1]).toEqual(
                expect.objectContaining({
                    id: 'user-2',
                    email: 'user2@example.com',
                    role: Role.BRANCH_MANAGER,
                    managedBranches: [
                        {
                            branchId: 'branch-1',
                            branchName: 'Main Branch',
                        },
                    ],
                })
            );
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
            expect(result.isActive).toBe(false);
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
            expect(result).toEqual({
                id: mockOrgUser.id,
                userId: mockOrgUser.userId,
                organizationId: mockOrgUser.organizationId,
                role: mockOrgUser.role,
                createdAt: mockOrgUser.createdAt,
            });
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
            expect(result).toEqual({
                id: 'user-123',
                email: 'test@example.com',
                fullName: 'Test User',
                organizations: [
                    {
                        organizationId: 'org-456',
                        organizationName: 'Test Organization',
                        role: Role.ORG_ADMIN,
                        managedBranches: [
                            {
                                branchId: 'branch-1',
                                branchName: 'Main Branch',
                                assignedAt: expect.any(Date),
                            },
                        ],
                        joinedAt: expect.any(Date),
                    },
                ],
            });
        });

        it('should throw error when user not found', async () => {
            mockUserService.getUserWithOrganizations.mockResolvedValue(null);

            await expect(controller.getUserOrganizations('nonexistent')).rejects.toThrow(
                'User not found'
            );
        });
    });
});
