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
    NotFoundException,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiExtraModels,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
    getSchemaPath,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { LoggerService } from '@/core/logger';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
    AssignUserToOrganizationDto,
    ChangePasswordDto,
    CreateUserDto,
    OrganizationUserResponseDto,
    PaginationDto,
    UpdateUserDto,
    UserResponseDto,
    UserWithOrganizationsResponseDto,
} from '@/shared/dto';
import { NoScoping, Permissions, Roles, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';
import { OrganizationUser, Role, User as UserModel } from '@prisma/client';
import { ApiOkResponseData, ApiOkResponsePaginated } from '@/shared/utils';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@ApiExtraModels(
    ApiSuccessResponse,
    UserResponseDto,
    OrganizationUserResponseDto,
    UserWithOrganizationsResponseDto
)
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
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(UserResponseDto) },
                    },
                },
            ],
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 409, description: 'Conflict.', type: ApiErrorResponse })
    async createUser(
        @Body() createUserDto: CreateUserDto,
        @User() user: UserContext
    ): Promise<UserModel> {
        return this.userService.createUser(createUserDto, user.sub);
    }

    @Get(':id')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Get a specific user by ID' })
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiOkResponseData(UserResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'User not found.', type: ApiErrorResponse })
    async getUserById(@Param('id') id: string, @Scope() scope: DataScope): Promise<UserModel> {
        const user = await this.userService.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    @Get()
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Get all users in the current organization' })
    @ApiOkResponsePaginated(OrganizationUserResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getOrganizationUsers(@Scope() scope: DataScope, @Query() paginationDto: PaginationDto) {
        return this.userService.getOrganizationUsers(scope, paginationDto);
    }

    @Patch(':id')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Update a user' })
    @ApiParam({ name: 'id', description: 'ID of the user to update' })
    @ApiBody({ type: UpdateUserDto })
    @ApiOkResponseData(UserResponseDto)
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'User not found.', type: ApiErrorResponse })
    async updateUser(
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto,
        @User() user: UserContext
    ): Promise<UserModel> {
        return this.userService.updateUser(id, updateUserDto, user.sub);
    }

    @Patch(':id/password')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Change a user’s password' })
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiBody({ type: ChangePasswordDto })
    @ApiResponse({ status: 204, description: 'Password changed successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'User not found.', type: ApiErrorResponse })
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
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({
        status: 404,
        description: 'User or organization not found.',
        type: ApiErrorResponse,
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

        return this.userService.assignToOrganization(assignmentData, user.sub);
    }

    @Delete(':userId/organizations/:organizationId')
    @NoScoping()
    @Roles(Role.SUPER_ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove a user from an organization (Super Admin)' })
    @ApiParam({ name: 'userId', description: 'ID of the user' })
    @ApiParam({ name: 'organizationId', description: 'ID of the organization' })
    @ApiResponse({ status: 204, description: 'User removed successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Assignment not found.', type: ApiErrorResponse })
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
    @ApiOkResponseData(UserResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'User not found.', type: ApiErrorResponse })
    async activateUser(@Param('id') id: string, @User() user: UserContext): Promise<UserModel> {
        return this.userService.activateUser(id, user.sub);
    }

    @Patch(':id/deactivate')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Deactivate a user' })
    @ApiParam({ name: 'id', description: 'ID of the user to deactivate' })
    @ApiOkResponseData(UserResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'User not found.', type: ApiErrorResponse })
    async deactivateUser(@Param('id') id: string, @User() user: UserContext): Promise<UserModel> {
        return this.userService.deactivateUser(id, user.sub);
    }

    @Get(':id/organizations')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Get all organizations a user belongs to' })
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiOkResponseData(UserWithOrganizationsResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'User not found.', type: ApiErrorResponse })
    async getUserOrganizations(@Param('id') id: string) {
        const userWithOrgs = await this.userService.getUserWithOrganizations(id);

        if (!userWithOrgs) {
            throw new NotFoundException('User not found');
        }

        return userWithOrgs;
    }
}
