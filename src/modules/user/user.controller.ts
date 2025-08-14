import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { LoggerService } from '@/core/logger';
import {
    AssignUserToOrganizationDto,
    ChangePasswordDto,
    CreateUserDto,
    ErrorResponseDto,
    OrganizationUserResponseDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateUserDto,
    UserResponseDto,
    UserWithOrganizationsResponseDto,
} from '@/shared/dto';
import { NoScoping, Permissions, Roles, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';
import { Role } from '@prisma/client';
import { plainToClass } from 'class-transformer';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly logger: LoggerService
    ) {}

    @Post()
    @NoScoping()
    @Permissions(PERMISSIONS.USER.CREATE_ORG_ADMIN)
    @ApiOperation({ summary: 'Create a new user' })
    @ApiBody({ type: CreateUserDto })
    @ApiResponse({
        status: 201,
        description: 'The user has been successfully created.',
        type: UserResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async createUser(
        @Body() createUserDto: CreateUserDto,
        @User() user: UserContext
    ): Promise<UserResponseDto> {
        const createdUser = await this.userService.createUser(createUserDto, user.sub);
        return plainToClass(UserResponseDto, createdUser);
    }

    @Get(':id')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Get a specific user by ID' })
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiResponse({ status: 200, description: 'The user details.', type: UserResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'User not found.', type: ErrorResponseDto })
    async getUserById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<UserResponseDto> {
        const user = await this.userService.findById(id);
        if (!user) {
            throw new Error('User not found');
        }
        return plainToClass(UserResponseDto, user);
    }

    @Get()
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Get all users in the current organization' })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of users in the organization.',
        type: PaginationResponseDto<OrganizationUserResponseDto>,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async getOrganizationUsers(
        @Scope() scope: DataScope,
        @Query() paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<OrganizationUserResponseDto>> {
        const users = await this.userService.getOrganizationUsers(scope);

        // Simple pagination (in a real app, you'd do this at the database level)
        const { page = 1, limit = 10 } = paginationDto;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedUsers = users.slice(startIndex, endIndex);

        const responseUsers = paginatedUsers.map(orgUser =>
            plainToClass(OrganizationUserResponseDto, {
                ...orgUser.user,
                role: orgUser.role,
                organizationId: orgUser.organizationId,
                managedBranches: orgUser.managedBranches.map(mb => ({
                    branchId: mb.branchId,
                    branchName: mb.branch.name,
                })),
            })
        );

        return new PaginationResponseDto(responseUsers, users.length, page, limit);
    }

    @Patch(':id')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Update a user' })
    @ApiParam({ name: 'id', description: 'ID of the user to update' })
    @ApiBody({ type: UpdateUserDto })
    @ApiResponse({
        status: 200,
        description: 'The user has been successfully updated.',
        type: UserResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'User not found.', type: ErrorResponseDto })
    async updateUser(
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto,
        @User() user: UserContext
    ): Promise<UserResponseDto> {
        const updatedUser = await this.userService.updateUser(id, updateUserDto, user.sub);
        return plainToClass(UserResponseDto, updatedUser);
    }

    @Patch(':id/password')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Change a user’s password' })
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiBody({ type: ChangePasswordDto })
    @ApiResponse({ status: 204, description: 'Password changed successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'User not found.', type: ErrorResponseDto })
    async changeUserPassword(
        @Param('id') id: string,
        @Body() changePasswordDto: ChangePasswordDto,
        @User() user: UserContext
    ): Promise<void> {
        await this.userService.changePassword(id, changePasswordDto, user.sub);
    }

    @Post(':id/assign-organization')
    @NoScoping()
    @Roles(Role.SUPER_ADMIN)
    @ApiOperation({ summary: 'Assign a user to an organization (Super Admin)' })
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiBody({ type: AssignUserToOrganizationDto })
    @ApiResponse({ status: 201, description: 'User assigned successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({
        status: 404,
        description: 'User or organization not found.',
        type: ErrorResponseDto,
    })
    async assignUserToOrganization(
        @Param('id') userId: string,
        @Body() assignDto: AssignUserToOrganizationDto,
        @User() user: UserContext
    ) {
        const assignmentData = {
            ...assignDto,
            userId,
        };

        const orgUser = await this.userService.assignToOrganization(assignmentData, user.sub);

        return {
            id: orgUser.id,
            userId: orgUser.userId,
            organizationId: orgUser.organizationId,
            role: orgUser.role,
            createdAt: orgUser.createdAt,
        };
    }

    @Delete(':userId/organizations/:organizationId')
    @NoScoping()
    @Roles(Role.SUPER_ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove a user from an organization (Super Admin)' })
    @ApiParam({ name: 'userId', description: 'ID of the user' })
    @ApiParam({ name: 'organizationId', description: 'ID of the organization' })
    @ApiResponse({ status: 204, description: 'User removed successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Assignment not found.', type: ErrorResponseDto })
    async removeUserFromOrganization(
        @Param('userId') userId: string,
        @Param('organizationId') organizationId: string,
        @User() user: UserContext
    ): Promise<void> {
        await this.userService.removeFromOrganization(userId, organizationId, user.sub);
    }

    @Patch(':id/activate')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Activate a user' })
    @ApiParam({ name: 'id', description: 'ID of the user to activate' })
    @ApiResponse({
        status: 200,
        description: 'The user has been successfully activated.',
        type: UserResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'User not found.', type: ErrorResponseDto })
    async activateUser(
        @Param('id') id: string,
        @User() user: UserContext
    ): Promise<UserResponseDto> {
        const activatedUser = await this.userService.activateUser(id, user.sub);
        return plainToClass(UserResponseDto, activatedUser);
    }

    @Patch(':id/deactivate')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Deactivate a user' })
    @ApiParam({ name: 'id', description: 'ID of the user to deactivate' })
    @ApiResponse({
        status: 200,
        description: 'The user has been successfully deactivated.',
        type: UserResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'User not found.', type: ErrorResponseDto })
    async deactivateUser(
        @Param('id') id: string,
        @User() user: UserContext
    ): Promise<UserResponseDto> {
        const deactivatedUser = await this.userService.deactivateUser(id, user.sub);
        return plainToClass(UserResponseDto, deactivatedUser);
    }

    @Get(':id/organizations')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Get all organizations a user belongs to' })
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiResponse({
        status: 200,
        description: 'A list of organizations for the user.',
        type: UserWithOrganizationsResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'User not found.', type: ErrorResponseDto })
    async getUserOrganizations(
        @Param('id') id: string
    ): Promise<UserWithOrganizationsResponseDto> {
        const userWithOrgs = await this.userService.getUserWithOrganizations(id);

        if (!userWithOrgs) {
            throw new Error('User not found');
        }

        return plainToClass(UserWithOrganizationsResponseDto, {
            ...userWithOrgs,
            organizations: userWithOrgs.organizationLinks.map(link => ({
                organizationId: link.organizationId,
                organizationName: link.organization.name,
                role: link.role,
                managedBranches: link.managedBranches.map(mb => ({
                    branchId: mb.branchId,
                    branchName: mb.branch.name,
                    assignedAt: mb.assignedAt,
                })),
                joinedAt: link.createdAt,
            })),
        });
    }
}
