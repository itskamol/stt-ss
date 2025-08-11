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
import { OrganizationService } from './organization.service';
import { LoggerService } from '../../core/logger/logger.service';
import {
    CreateOrganizationDto,
    OrganizationResponseDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateOrganizationDto,
} from '../../shared/dto';
import { NoScoping, Permissions, Roles, Scope, User } from '../../shared/decorators';
import { DataScope, UserContext } from '../../shared/interfaces';

@Controller('organizations')
export class OrganizationController {
    constructor(
        private readonly organizationService: OrganizationService,
        private readonly logger: LoggerService
    ) {}

    @Post()
    @NoScoping()
    @Permissions('organization:create')
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
    @Permissions('organization:read:all')
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
    @Permissions('organization:read:all')
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
    @Permissions('organization:read:all')
    async getOrganizationCount(): Promise<{ count: number }> {
        const count = await this.organizationService.getOrganizationCount();
        return { count };
    }

    @Get('self')
    @Permissions('organization:read:self')
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
    @Permissions('organization:read:self')
    async getCurrentOrganizationWithStats(@Scope() scope: DataScope) {
        return this.organizationService.getOrganizationWithStats(scope.organizationId);
    }

    @Get(':id')
    @NoScoping()
    @Permissions('organization:read:all')
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
    @Permissions('organization:read:all')
    async getOrganizationWithStats(@Param('id') id: string) {
        return this.organizationService.getOrganizationWithStats(id);
    }

    @Patch('self')
    @Permissions('organization:update:self')
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
    @Permissions('organization:read:all') // SUPER_ADMIN can update any organization
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
    @Roles('SUPER_ADMIN')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteOrganization(@Param('id') id: string, @User() user: UserContext): Promise<void> {
        await this.organizationService.deleteOrganization(id, user.sub);
    }
}
