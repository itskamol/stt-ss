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
import { LoggerService } from '@/core/logger/logger.service';
import {
    AssignUserToOrganizationDto,
    ChangePasswordDto,
    CreateUserDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateUserDto,
    UserResponseDto,
} from '@/shared/dto';
import { NoScoping, Permissions, Roles, Scope, User } from '@/shared/decorators';
import { DataScope, UserContext } from '@/shared/interfaces';
import { Role } from '@prisma/client';

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
    @Permissions('user:create:org_admin')
    @ApiOperation({ summary: 'Create a new user' })
    @ApiBody({ type: CreateUserDto })
    @ApiResponse({
        status: 201,
        description: 'The user has been successfully created.',
        type: UserResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async createUser(
        @Body() createUserDto: CreateUserDto,
        @User() user: UserContext
    ): Promise<UserResponseDto> {
        const createdUser = await this.userService.createUser(createUserDto, user.sub);

        return {
            id: createdUser.id,
            email: createdUser.email,
            fullName: createdUser.fullName,
            isActive: createdUser.isActive,
            createdAt: createdUser.createdAt,
            updatedAt: createdUser.updatedAt,
        };
    }

    @Get(':id')
    @Permissions('user:manage:org')
    @ApiOperation({ summary: 'Get a specific user by ID' })
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiResponse({ status: 200, description: 'The user details.', type: UserResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async getUserById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<UserResponseDto> {
        const user = await this.userService.findById(id);

        if (!user) {
            // Return 404 to prevent information leakage
            throw new Error('User not found');
        }

        return {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }

    @Get()
    @Permissions('user:manage:org')
    @ApiOperation({ summary: 'Get all users in the current organization' })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of users in the organization.',
        type: PaginationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getOrganizationUsers(
        @Scope() scope: DataScope,
        @Query() paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<any>> {
        const users = await this.userService.getOrganizationUsers(scope);

        // Simple pagination (in a real app, you'd do this at the database level)
        const { page = 1, limit = 10 } = paginationDto;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedUsers = users.slice(startIndex, endIndex);

        const responseUsers = paginatedUsers.map(orgUser => ({
            id: orgUser.user.id,
            email: orgUser.user.email,
            fullName: orgUser.user.fullName,
            isActive: orgUser.user.isActive,
            role: orgUser.role,
            organizationId: orgUser.organizationId,
            managedBranches: orgUser.managedBranches.map(mb => ({
                branchId: mb.branchId,
                branchName: mb.branch.name,
            })),
            createdAt: orgUser.createdAt,
        }));

        return new PaginationResponseDto(responseUsers, users.length, page, limit);
    }

    @Patch(':id')
    @Permissions('user:manage:org')
    @ApiOperation({ summary: 'Update a user' })
    @ApiParam({ name: 'id', description: 'ID of the user to update' })
    @ApiBody({ type: UpdateUserDto })
    @ApiResponse({
        status: 200,
        description: 'The user has been successfully updated.',
        type: UserResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async updateUser(
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto,
        @User() user: UserContext
    ): Promise<UserResponseDto> {
        const updatedUser = await this.userService.updateUser(id, updateUserDto, user.sub);

        return {
            id: updatedUser.id,
            email: updatedUser.email,
            fullName: updatedUser.fullName,
            isActive: updatedUser.isActive,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
        };
    }

    @Patch(':id/password')
    @Permissions('user:manage:org')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Change a user’s password' })
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiBody({ type: ChangePasswordDto })
    @ApiResponse({ status: 204, description: 'Password changed successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
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
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'User or organization not found.' })
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
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Assignment not found.' })
    async removeUserFromOrganization(
        @Param('userId') userId: string,
        @Param('organizationId') organizationId: string,
        @User() user: UserContext
    ): Promise<void> {
        await this.userService.removeFromOrganization(userId, organizationId, user.sub);
    }

    @Patch(':id/activate')
    @Permissions('user:manage:org')
    @ApiOperation({ summary: 'Activate a user' })
    @ApiParam({ name: 'id', description: 'ID of the user to activate' })
    @ApiResponse({
        status: 200,
        description: 'The user has been successfully activated.',
        type: UserResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async activateUser(
        @Param('id') id: string,
        @User() user: UserContext
    ): Promise<UserResponseDto> {
        const activatedUser = await this.userService.activateUser(id, user.sub);

        return {
            id: activatedUser.id,
            email: activatedUser.email,
            fullName: activatedUser.fullName,
            isActive: activatedUser.isActive,
            createdAt: activatedUser.createdAt,
            updatedAt: activatedUser.updatedAt,
        };
    }

    @Patch(':id/deactivate')
    @Permissions('user:manage:org')
    @ApiOperation({ summary: 'Deactivate a user' })
    @ApiParam({ name: 'id', description: 'ID of the user to deactivate' })
    @ApiResponse({
        status: 200,
        description: 'The user has been successfully deactivated.',
        type: UserResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async deactivateUser(
        @Param('id') id: string,
        @User() user: UserContext
    ): Promise<UserResponseDto> {
        const deactivatedUser = await this.userService.deactivateUser(id, user.sub);

        return {
            id: deactivatedUser.id,
            email: deactivatedUser.email,
            fullName: deactivatedUser.fullName,
            isActive: deactivatedUser.isActive,
            createdAt: deactivatedUser.createdAt,
            updatedAt: deactivatedUser.updatedAt,
        };
    }

    @Get(':id/organizations')
    @Permissions('user:manage:org')
    @ApiOperation({ summary: 'Get all organizations a user belongs to' })
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiResponse({ status: 200, description: 'A list of organizations for the user.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async getUserOrganizations(@Param('id') id: string) {
        const userWithOrgs = await this.userService.getUserWithOrganizations(id);

        if (!userWithOrgs) {
            throw new Error('User not found');
        }

        return {
            id: userWithOrgs.id,
            email: userWithOrgs.email,
            fullName: userWithOrgs.fullName,
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
        };
    }
}
