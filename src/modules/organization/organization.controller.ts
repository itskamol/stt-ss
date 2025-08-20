import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Patch,
    Post,
    Query,
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
import { OrganizationService } from './organization.service';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
    CreateOrganizationDto,
    OrganizationCountResponseDto,
    OrganizationResponseDto,
    OrganizationStatsResponseDto,
    PaginationDto,
    UpdateOrganizationDto,
} from '@/shared/dto';
import { NoScoping, Permissions, Roles, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';
import { Organization, Role } from '@prisma/client';
import { ApiOkResponseData, ApiOkResponsePaginated } from '@/shared/utils';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
@ApiExtraModels(
    ApiSuccessResponse,
    OrganizationResponseDto,
    OrganizationStatsResponseDto,
    OrganizationCountResponseDto
)
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) {}

    @Post()
    @NoScoping()
    @Permissions(PERMISSIONS.ORGANIZATION.CREATE)
    @ApiOperation({ summary: 'Create a new organization' })
    @ApiBody({ type: CreateOrganizationDto })
    @ApiResponse({
        status: 201,
        description: 'The organization has been successfully created.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(OrganizationResponseDto) },
                    },
                },
            ],
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async createOrganization(
        @Body() createOrganizationDto: CreateOrganizationDto,
        @User() user: UserContext
    ): Promise<Organization> {
        return this.organizationService.createOrganization(createOrganizationDto, user.sub);
    }

    @Get()
    @NoScoping()
    @Permissions(PERMISSIONS.ORGANIZATION.READ_ALL)
    @ApiOperation({ summary: 'Get all organizations with pagination' })
    @ApiOkResponsePaginated(OrganizationResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getAllOrganizations(@Query() paginationDto: PaginationDto) {
        return this.organizationService.getAllOrganizations(paginationDto);
    }

    @Get('search')
    @NoScoping()
    @Permissions(PERMISSIONS.ORGANIZATION.READ_ALL)
    @ApiOperation({ summary: 'Search for organizations' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiOkResponsePaginated(OrganizationResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async searchOrganizations(@Query('q') searchTerm: string): Promise<Organization[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }
        return this.organizationService.searchOrganizations(searchTerm.trim());
    }

    @Get('count')
    @NoScoping()
    @Permissions(PERMISSIONS.ORGANIZATION.READ_ALL)
    @ApiOperation({ summary: 'Get the total number of organizations' })
    @ApiOkResponseData(OrganizationCountResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getOrganizationCount(): Promise<{ count: number }> {
        const count = await this.organizationService.getOrganizationCount();
        return { count };
    }

    @Get('self')
    @Permissions(PERMISSIONS.ORGANIZATION.READ_SELF)
    @ApiOperation({ summary: 'Get the current authenticated user’s organization' })
    @ApiOkResponseData(OrganizationResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Organization not found.', type: ApiErrorResponse })
    async getCurrentOrganization(@Scope() scope: DataScope): Promise<Organization> {
        const organization = await this.organizationService.getOrganizationById(
            scope.organizationId
        );
        if (!organization) {
            throw new NotFoundException('Organization not found.');
        }
        return organization;
    }

    @Get('self/stats')
    @Permissions(PERMISSIONS.ORGANIZATION.READ_SELF)
    @ApiOperation({ summary: 'Get statistics for the current organization' })
    @ApiOkResponseData(OrganizationStatsResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Organization not found.', type: ApiErrorResponse })
    async getCurrentOrganizationWithStats(@Scope() scope: DataScope) {
        return this.organizationService.getOrganizationWithStats(scope.organizationId);
    }

    @Get(':id')
    @NoScoping()
    @Permissions(PERMISSIONS.ORGANIZATION.READ_ALL)
    @ApiOperation({ summary: 'Get a specific organization by ID' })
    @ApiParam({ name: 'id', description: 'ID of the organization' })
    @ApiOkResponseData(OrganizationResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Organization not found.', type: ApiErrorResponse })
    async getOrganizationById(@Param('id') id: string): Promise<Organization> {
        const organization = await this.organizationService.getOrganizationById(id);
        if (!organization) {
            throw new NotFoundException('Organization not found.');
        }
        return organization;
    }

    @Get(':id/stats')
    @NoScoping()
    @Permissions(PERMISSIONS.ORGANIZATION.READ_ALL)
    @ApiOperation({ summary: 'Get statistics for a specific organization' })
    @ApiParam({ name: 'id', description: 'ID of the organization' })
    @ApiOkResponseData(OrganizationStatsResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Organization not found.', type: ApiErrorResponse })
    async getOrganizationWithStats(@Param('id') id: string) {
        return this.organizationService.getOrganizationWithStats(id);
    }

    @Patch('self')
    @Permissions(PERMISSIONS.ORGANIZATION.UPDATE_SELF)
    @ApiOperation({ summary: 'Update the current organization' })
    @ApiBody({ type: UpdateOrganizationDto })
    @ApiOkResponseData(OrganizationResponseDto)
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Organization not found.', type: ApiErrorResponse })
    async updateCurrentOrganization(
        @Body() updateOrganizationDto: UpdateOrganizationDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Organization> {
        return this.organizationService.updateOrganization(
            scope.organizationId,
            updateOrganizationDto,
            user.sub
        );
    }

    @Patch(':id')
    @NoScoping()
    @Roles(Role.SUPER_ADMIN)
    @ApiOperation({ summary: 'Update a specific organization (Super Admin)' })
    @ApiParam({ name: 'id', description: 'ID of the organization to update' })
    @ApiBody({ type: UpdateOrganizationDto })
    @ApiOkResponseData(OrganizationResponseDto)
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Organization not found.', type: ApiErrorResponse })
    async updateOrganization(
        @Param('id') id: string,
        @Body() updateOrganizationDto: UpdateOrganizationDto,
        @User() user: UserContext
    ): Promise<Organization> {
        return this.organizationService.updateOrganization(id, updateOrganizationDto, user.sub);
    }

    @Delete(':id')
    @NoScoping()
    @Roles(Role.SUPER_ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete an organization (Super Admin)' })
    @ApiParam({ name: 'id', description: 'ID of the organization to delete' })
    @ApiResponse({ status: 204, description: 'The organization has been successfully deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Organization not found.', type: ApiErrorResponse })
    async deleteOrganization(@Param('id') id: string, @User() user: UserContext): Promise<void> {
        await this.organizationService.deleteOrganization(id, user.sub);
    }
}
