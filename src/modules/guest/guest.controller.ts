import {
    Body,
    Controller,
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
import { GuestService } from './guest.service';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
    ApproveGuestVisitDto,
    CreateGuestVisitDto,
    GuestVisitFiltersDto,
    GuestVisitResponseDto,
    GuestVisitStatsDto,
    PaginationDto,
    RejectGuestVisitDto,
    UpdateGuestVisitDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';
import { GuestStatus, GuestVisit } from '@prisma/client';
import { ApiOkResponseData, ApiOkResponsePaginated } from '@/shared/utils';

@ApiTags('Guests')
@ApiBearerAuth()
@Controller('guests')
@ApiExtraModels(ApiSuccessResponse, GuestVisitResponseDto, GuestVisitStatsDto)
export class GuestController {
    constructor(private readonly guestService: GuestService) {}

    @Post('visits')
    @Permissions(PERMISSIONS.GUEST.CREATE)
    @ApiOperation({ summary: 'Create a new guest visit request' })
    @ApiBody({ type: CreateGuestVisitDto })
    @ApiResponse({
        status: 201,
        description: 'The guest visit has been successfully created.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(GuestVisitResponseDto) },
                    },
                },
            ],
        }
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async createGuestVisit(
        @Body() createGuestVisitDto: CreateGuestVisitDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<GuestVisit> {
        return this.guestService.createGuestVisit(
            createGuestVisitDto,
            scope,
            user.sub
        );
    }

    @Get('visits')
    @Permissions(PERMISSIONS.GUEST.READ_ALL)
    @ApiOperation({ summary: 'Get all guest visits with filters and pagination' })
    @ApiOkResponsePaginated(GuestVisitResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getGuestVisits(
        @Scope() scope: DataScope,
        @Query() filtersDto: GuestVisitFiltersDto,
        @Query() paginationDto: PaginationDto
    ) {
        const filters = {
            status: filtersDto.status,
            branchId: filtersDto.branchId,
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
        };

        return this.guestService.getGuestVisits(filters, scope, paginationDto);
    }

    @Get('visits/search')
    @Permissions(PERMISSIONS.GUEST.READ_ALL)
    @ApiOperation({ summary: 'Search for guest visits' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiOkResponsePaginated(GuestVisitResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async searchGuestVisits(
        @Query('q') searchTerm: string,
        @Scope() scope: DataScope
    ): Promise<GuestVisit[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }
        return this.guestService.searchGuestVisits(searchTerm.trim(), scope);
    }

    @Get('visits/stats')
    @Permissions(PERMISSIONS.GUEST.READ_ALL)
    @ApiOperation({ summary: 'Get guest visit statistics' })
    @ApiQuery({ name: 'filtersDto', type: GuestVisitFiltersDto })
    @ApiOkResponseData(GuestVisitStatsDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getGuestVisitStats(
        @Scope() scope: DataScope,
        @Query() filtersDto: GuestVisitFiltersDto
    ): Promise<GuestVisitStatsDto> {
        const filters = {
            branchId: filtersDto.branchId,
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
        };

        return this.guestService.getGuestVisitStats(filters, scope);
    }

    @Get('visits/status/:status')
    @Permissions(PERMISSIONS.GUEST.READ_ALL)
    @ApiOperation({ summary: 'Get guest visits by status' })
    @ApiParam({ name: 'status', description: 'Status of the guest visit' })
    @ApiOkResponsePaginated(GuestVisitResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getGuestVisitsByStatus(
        @Param('status') status: GuestStatus,
        @Scope() scope: DataScope
    ): Promise<GuestVisit[]> {
        return this.guestService.getGuestVisitsByStatus(status, scope);
    }

    @Get('visits/:id')
    @Permissions(PERMISSIONS.GUEST.READ_ALL)
    @ApiOperation({ summary: 'Get a specific guest visit by ID' })
    @ApiParam({ name: 'id', description: 'ID of the guest visit' })
    @ApiOkResponseData(GuestVisitResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Guest visit not found.', type: ApiErrorResponse })
    async getGuestVisitById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<GuestVisit> {
        const guestVisit = await this.guestService.getGuestVisitById(id, scope);
        if (!guestVisit) {
            throw new NotFoundException('Guest visit not found.');
        }
        return guestVisit;
    }

    @Patch('visits/:id')
    @Permissions(PERMISSIONS.GUEST.UPDATE_MANAGED)
    @ApiOperation({ summary: 'Update a guest visit' })
    @ApiParam({ name: 'id', description: 'ID of the guest visit to update' })
    @ApiBody({ type: UpdateGuestVisitDto })
    @ApiOkResponseData(GuestVisitResponseDto)
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Guest visit not found.', type: ApiErrorResponse })
    async updateGuestVisit(
        @Param('id') id: string,
        @Body() updateGuestVisitDto: UpdateGuestVisitDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<GuestVisit> {
        return this.guestService.updateGuestVisit(
            id,
            updateGuestVisitDto,
            scope,
            user.sub
        );
    }

    @Post('visits/:id/approve')
    @Permissions(PERMISSIONS.GUEST.APPROVE)
    @ApiOperation({ summary: 'Approve a guest visit' })
    @ApiParam({ name: 'id', description: 'ID of the guest visit to approve' })
    @ApiBody({ type: ApproveGuestVisitDto })
    @ApiOkResponseData(GuestVisitResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Guest visit not found.', type: ApiErrorResponse })
    async approveGuestVisit(
        @Param('id') id: string,
        @Body() approveDto: ApproveGuestVisitDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<GuestVisit> {
        return this.guestService.approveGuestVisit(
            id,
            approveDto,
            scope,
            user.sub
        );
    }

    @Post('visits/:id/reject')
    @Permissions(PERMISSIONS.GUEST.APPROVE)
    @ApiOperation({ summary: 'Reject a guest visit' })
    @ApiParam({ name: 'id', description: 'ID of the guest visit to reject' })
    @ApiBody({ type: RejectGuestVisitDto })
    @ApiOkResponseData(GuestVisitResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Guest visit not found.', type: ApiErrorResponse })
    async rejectGuestVisit(
        @Param('id') id: string,
        @Body() rejectDto: RejectGuestVisitDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<GuestVisit> {
        return this.guestService.rejectGuestVisit(
            id,
            rejectDto.reason,
            scope,
            user.sub
        );
    }

    @Post('visits/:id/activate')
    @Permissions(PERMISSIONS.GUEST.MANAGE)
    @ApiOperation({ summary: 'Activate a guest visit (check-in)' })
    @ApiParam({ name: 'id', description: 'ID of the guest visit to activate' })
    @ApiOkResponseData(GuestVisitResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Guest visit not found.', type: ApiErrorResponse })
    async activateGuestVisit(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<GuestVisit> {
        return this.guestService.activateGuestVisit(id, scope, user.sub);
    }

    @Post('visits/:id/complete')
    @Permissions(PERMISSIONS.GUEST.MANAGE)
    @ApiOperation({ summary: 'Complete a guest visit (check-out)' })
    @ApiParam({ name: 'id', description: 'ID of the guest visit to complete' })
    @ApiOkResponseData(GuestVisitResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Guest visit not found.', type: ApiErrorResponse })
    async completeGuestVisit(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<GuestVisit> {
        return this.guestService.completeGuestVisit(id, scope, user.sub);
    }

    @Post('visits/expire-overdue')
    @Permissions(PERMISSIONS.ADMIN.SYSTEM_MANAGE)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Expire overdue guest visits' })
    @ApiOkResponseData(Number)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async expireOverdueVisits(@Scope() scope: DataScope): Promise<{ expiredCount: number }> {
        const expiredCount = await this.guestService.expireOverdueVisits(scope);
        return { expiredCount };
    }
}
