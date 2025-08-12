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
import { OrganizationService } from './organization.service';
import { LoggerService } from '@/core/logger/logger.service';
import {
    CreateOrganizationDto,
    OrganizationResponseDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateOrganizationDto,
} from '@/shared/dto';
import { NoScoping, Permissions, Roles, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';
import { Role } from '@prisma/client';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationController {
    constructor(
        private readonly organizationService: OrganizationService,
        private readonly logger: LoggerService
    ) {}

    @Post()
    @NoScoping()
    @Permissions(PERMISSIONS.ORGANIZATION.CREATE)
    @ApiOperation({ summary: 'Create a new organization' })
    @ApiBody({ type: CreateOrganizationDto })
    @ApiResponse({
        status: 201,
        description: 'The organization has been successfully created.',
        type: OrganizationResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async createOrganization(
        @Body() createOrganizationDto: CreateOrganizationDto,
        @User() user: UserContext
    ): Promise<OrganizationResponseDto> {
        const organization = await this.organizationService.createOrganization(
            createOrganizationDto,
            user.sub
        );

        return {
            id: organization.id,
            name: organization.name,
            description: organization.description,
            createdAt: organization.createdAt,
            updatedAt: organization.updatedAt,
        };
    }

    @Get()
    @NoScoping()
    @Permissions(PERMISSIONS.ORGANIZATION.READ_ALL)
    @ApiOperation({ summary: 'Get all organizations with pagination' })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of organizations.',
        type: PaginationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getAllOrganizations(
        @Query() paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<OrganizationResponseDto>> {
        const organizations = await this.organizationService.getAllOrganizations();

        // Simple pagination (in a real app, you'd do this at the database level)
        const { page = 1, limit = 10 } = paginationDto;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedOrganizations = organizations.slice(startIndex, endIndex);

        const responseOrganizations = paginatedOrganizations.map(org => ({
            id: org.id,
            name: org.name,
            description: org.description,
            createdAt: org.createdAt,
            updatedAt: org.updatedAt,
        }));

        return new PaginationResponseDto(responseOrganizations, organizations.length, page, limit);
    }

    @Get('search')
    @NoScoping()
    @Permissions(PERMISSIONS.ORGANIZATION.READ_ALL)
    @ApiOperation({ summary: 'Search for organizations' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiResponse({
        status: 200,
        description: 'A list of organizations matching the search term.',
        type: [OrganizationResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async searchOrganizations(@Query('q') searchTerm: string): Promise<OrganizationResponseDto[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        const organizations = await this.organizationService.searchOrganizations(searchTerm.trim());

        return organizations.map(org => ({
            id: org.id,
            name: org.name,
            description: org.description,
            createdAt: org.createdAt,
            updatedAt: org.updatedAt,
        }));
    }

    @Get('count')
    @NoScoping()
    @Permissions(PERMISSIONS.ORGANIZATION.READ_ALL)
    @ApiOperation({ summary: 'Get the total number of organizations' })
    @ApiResponse({ status: 200, description: 'The total number of organizations.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getOrganizationCount(): Promise<{ count: number }> {
        const count = await this.organizationService.getOrganizationCount();
        return { count };
    }

    @Get('self')
    @Permissions(PERMISSIONS.ORGANIZATION.READ_SELF)
    @ApiOperation({ summary: 'Get the current authenticated user’s organization' })
    @ApiResponse({
        status: 200,
        description: 'The current organization details.',
        type: OrganizationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Organization not found.' })
    async getCurrentOrganization(@Scope() scope: DataScope): Promise<OrganizationResponseDto> {
        const organization = await this.organizationService.getOrganizationById(
            scope.organizationId
        );

        if (!organization) {
            throw new Error('Organization not found');
        }

        return {
            id: organization.id,
            name: organization.name,
            description: organization.description,
            createdAt: organization.createdAt,
            updatedAt: organization.updatedAt,
        };
    }

    @Get('self/stats')
    @Permissions(PERMISSIONS.ORGANIZATION.READ_SELF)
    @ApiOperation({ summary: 'Get statistics for the current organization' })
    @ApiResponse({ status: 200, description: 'The organization statistics.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Organization not found.' })
    async getCurrentOrganizationWithStats(@Scope() scope: DataScope) {
        return this.organizationService.getOrganizationWithStats(scope.organizationId);
    }

    @Get(':id')
    @NoScoping()
    @Permissions(PERMISSIONS.ORGANIZATION.READ_ALL)
    @ApiOperation({ summary: 'Get a specific organization by ID' })
    @ApiParam({ name: 'id', description: 'ID of the organization' })
    @ApiResponse({
        status: 200,
        description: 'The organization details.',
        type: OrganizationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Organization not found.' })
    async getOrganizationById(@Param('id') id: string): Promise<OrganizationResponseDto> {
        const organization = await this.organizationService.getOrganizationById(id);

        if (!organization) {
            throw new Error('Organization not found');
        }

        return {
            id: organization.id,
            name: organization.name,
            description: organization.description,
            createdAt: organization.createdAt,
            updatedAt: organization.updatedAt,
        };
    }

    @Get(':id/stats')
    @NoScoping()
    @Permissions(PERMISSIONS.ORGANIZATION.READ_ALL)
    @ApiOperation({ summary: 'Get statistics for a specific organization' })
    @ApiParam({ name: 'id', description: 'ID of the organization' })
    @ApiResponse({ status: 200, description: 'The organization statistics.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Organization not found.' })
    async getOrganizationWithStats(@Param('id') id: string) {
        return this.organizationService.getOrganizationWithStats(id);
    }

    @Patch('self')
    @Permissions(PERMISSIONS.ORGANIZATION.UPDATE_SELF)
    @ApiOperation({ summary: 'Update the current organization' })
    @ApiBody({ type: UpdateOrganizationDto })
    @ApiResponse({
        status: 200,
        description: 'The organization has been successfully updated.',
        type: OrganizationResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Organization not found.' })
    async updateCurrentOrganization(
        @Body() updateOrganizationDto: UpdateOrganizationDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<OrganizationResponseDto> {
        const organization = await this.organizationService.updateOrganization(
            scope.organizationId,
            updateOrganizationDto,
            user.sub
        );

        return {
            id: organization.id,
            name: organization.name,
            description: organization.description,
            createdAt: organization.createdAt,
            updatedAt: organization.updatedAt,
        };
    }

    @Patch(':id')
    @NoScoping()
    @Permissions(PERMISSIONS.ORGANIZATION.READ_ALL) // SUPER_ADMIN can update any organization
    @ApiOperation({ summary: 'Update a specific organization (Super Admin)' })
    @ApiParam({ name: 'id', description: 'ID of the organization to update' })
    @ApiBody({ type: UpdateOrganizationDto })
    @ApiResponse({
        status: 200,
        description: 'The organization has been successfully updated.',
        type: OrganizationResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Organization not found.' })
    async updateOrganization(
        @Param('id') id: string,
        @Body() updateOrganizationDto: UpdateOrganizationDto,
        @User() user: UserContext
    ): Promise<OrganizationResponseDto> {
        const organization = await this.organizationService.updateOrganization(
            id,
            updateOrganizationDto,
            user.sub
        );

        return {
            id: organization.id,
            name: organization.name,
            description: organization.description,
            createdAt: organization.createdAt,
            updatedAt: organization.updatedAt,
        };
    }

    @Delete(':id')
    @NoScoping()
    @Roles(Role.SUPER_ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete an organization (Super Admin)' })
    @ApiParam({ name: 'id', description: 'ID of the organization to delete' })
    @ApiResponse({
        status: 204,
        description: 'The organization has been successfully deleted.',
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Organization not found.' })
    async deleteOrganization(@Param('id') id: string, @User() user: UserContext): Promise<void> {
        await this.organizationService.deleteOrganization(id, user.sub);
    }
}
