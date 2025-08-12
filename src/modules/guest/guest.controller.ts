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
import { GuestService } from './guest.service';
import {
    ApproveGuestVisitDto,
    CreateGuestVisitDto,
    GuestVisitFiltersDto,
    GuestVisitResponseDto,
    GuestVisitStatsDto,
    PaginationDto,
    PaginationResponseDto,
    RejectGuestVisitDto,
    UpdateGuestVisitDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext, GuestVisitWithCredentials } from '@/shared/interfaces';
import { GuestStatus } from '@prisma/client';

@ApiTags('Guests')
@ApiBearerAuth()
@Controller('guests')
export class GuestController {
    constructor(private readonly guestService: GuestService) {}

    @Post('visits')
    @Permissions(PERMISSIONS.GUEST.CREATE)
    @ApiOperation({ summary: 'Create a new guest visit request' })
    @ApiBody({ type: CreateGuestVisitDto })
    @ApiResponse({
        status: 201,
        description: 'The guest visit has been successfully created.',
        type: GuestVisitResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async createGuestVisit(
        @Body() createGuestVisitDto: CreateGuestVisitDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<GuestVisitResponseDto> {
        const guestVisit = await this.guestService.createGuestVisit(
            createGuestVisitDto,
            scope,
            user.sub
        );

        return {
            id: guestVisit.id,
            organizationId: guestVisit.organizationId,
            branchId: guestVisit.branchId,
            guestName: guestVisit.guestName,
            guestContact: guestVisit.guestContact,
            responsibleEmployeeId: guestVisit.responsibleEmployeeId,
            scheduledEntryTime: guestVisit.scheduledEntryTime,
            scheduledExitTime: guestVisit.scheduledExitTime,
            status: guestVisit.status,
            accessCredentialType: guestVisit.accessCredentialType,
            createdByUserId: guestVisit.createdByUserId,
            createdAt: guestVisit.createdAt,
            updatedAt: guestVisit.updatedAt,
        };
    }

    @Get('visits')
    @Permissions(PERMISSIONS.GUEST.READ_ALL)
    @ApiOperation({ summary: 'Get all guest visits with filters and pagination' })
    @ApiQuery({ name: 'filtersDto', type: GuestVisitFiltersDto })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of guest visits.',
        type: PaginationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getGuestVisits(
        @Scope() scope: DataScope,
        @Query() filtersDto: GuestVisitFiltersDto,
        @Query() paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<GuestVisitResponseDto>> {
        const filters = {
            status: filtersDto.status,
            branchId: filtersDto.branchId,
            startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
            endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
        };

        const guestVisits = await this.guestService.getGuestVisits(filters, scope);

        // Simple pagination (in a real app, you'd do this at the database level)
        const { page = 1, limit = 10 } = paginationDto;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedVisits = guestVisits.slice(startIndex, endIndex);

        const responseVisits = paginatedVisits.map(visit => ({
            id: visit.id,
            organizationId: visit.organizationId,
            branchId: visit.branchId,
            guestName: visit.guestName,
            guestContact: visit.guestContact,
            responsibleEmployeeId: visit.responsibleEmployeeId,
            scheduledEntryTime: visit.scheduledEntryTime,
            scheduledExitTime: visit.scheduledExitTime,
            status: visit.status,
            accessCredentialType: visit.accessCredentialType,
            createdByUserId: visit.createdByUserId,
            createdAt: visit.createdAt,
            updatedAt: visit.updatedAt,
        }));

        return new PaginationResponseDto(responseVisits, guestVisits.length, page, limit);
    }

    @Get('visits/search')
    @Permissions(PERMISSIONS.GUEST.READ_ALL)
    @ApiOperation({ summary: 'Search for guest visits' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiResponse({
        status: 200,
        description: 'A list of guest visits matching the search term.',
        type: [GuestVisitResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async searchGuestVisits(
        @Query('q') searchTerm: string,
        @Scope() scope: DataScope
    ): Promise<GuestVisitResponseDto[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        const guestVisits = await this.guestService.searchGuestVisits(searchTerm.trim(), scope);

        return guestVisits.map(visit => ({
            id: visit.id,
            organizationId: visit.organizationId,
            branchId: visit.branchId,
            guestName: visit.guestName,
            guestContact: visit.guestContact,
            responsibleEmployeeId: visit.responsibleEmployeeId,
            scheduledEntryTime: visit.scheduledEntryTime,
            scheduledExitTime: visit.scheduledExitTime,
            status: visit.status,
            accessCredentialType: visit.accessCredentialType,
            createdByUserId: visit.createdByUserId,
            createdAt: visit.createdAt,
            updatedAt: visit.updatedAt,
        }));
    }

    @Get('visits/stats')
    @Permissions(PERMISSIONS.GUEST.READ_ALL)
    @ApiOperation({ summary: 'Get guest visit statistics' })
    @ApiQuery({ name: 'filtersDto', type: GuestVisitFiltersDto })
    @ApiResponse({
        status: 200,
        description: 'Guest visit statistics.',
        type: GuestVisitStatsDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
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
    @ApiResponse({
        status: 200,
        description: 'A list of guest visits with the specified status.',
        type: [GuestVisitResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getGuestVisitsByStatus(
        @Param('status') status: GuestStatus,
        @Scope() scope: DataScope
    ): Promise<GuestVisitResponseDto[]> {
        const guestVisits = await this.guestService.getGuestVisitsByStatus(status, scope);

        return guestVisits.map(visit => ({
            id: visit.id,
            organizationId: visit.organizationId,
            branchId: visit.branchId,
            guestName: visit.guestName,
            guestContact: visit.guestContact,
            responsibleEmployeeId: visit.responsibleEmployeeId,
            scheduledEntryTime: visit.scheduledEntryTime,
            scheduledExitTime: visit.scheduledExitTime,
            status: visit.status,
            accessCredentialType: visit.accessCredentialType,
            createdByUserId: visit.createdByUserId,
            createdAt: visit.createdAt,
            updatedAt: visit.updatedAt,
        }));
    }

    @Get('visits/:id')
    @Permissions(PERMISSIONS.GUEST.READ_ALL)
    @ApiOperation({ summary: 'Get a specific guest visit by ID' })
    @ApiParam({ name: 'id', description: 'ID of the guest visit' })
    @ApiResponse({
        status: 200,
        description: 'The guest visit details.',
        type: GuestVisitResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Guest visit not found.' })
    async getGuestVisitById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<GuestVisitResponseDto> {
        const guestVisit = await this.guestService.getGuestVisitById(id, scope);

        if (!guestVisit) {
            throw new Error('Guest visit not found');
        }

        return {
            id: guestVisit.id,
            organizationId: guestVisit.organizationId,
            branchId: guestVisit.branchId,
            guestName: guestVisit.guestName,
            guestContact: guestVisit.guestContact,
            responsibleEmployeeId: guestVisit.responsibleEmployeeId,
            scheduledEntryTime: guestVisit.scheduledEntryTime,
            scheduledExitTime: guestVisit.scheduledExitTime,
            status: guestVisit.status,
            accessCredentialType: guestVisit.accessCredentialType,
            createdByUserId: guestVisit.createdByUserId,
            createdAt: guestVisit.createdAt,
            updatedAt: guestVisit.updatedAt,
        };
    }

    @Patch('visits/:id')
    @Permissions(PERMISSIONS.GUEST.UPDATE_MANAGED)
    @ApiOperation({ summary: 'Update a guest visit' })
    @ApiParam({ name: 'id', description: 'ID of the guest visit to update' })
    @ApiBody({ type: UpdateGuestVisitDto })
    @ApiResponse({
        status: 200,
        description: 'The guest visit has been successfully updated.',
        type: GuestVisitResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Guest visit not found.' })
    async updateGuestVisit(
        @Param('id') id: string,
        @Body() updateGuestVisitDto: UpdateGuestVisitDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<GuestVisitResponseDto> {
        const guestVisit = await this.guestService.updateGuestVisit(
            id,
            updateGuestVisitDto,
            scope,
            user.sub
        );

        return {
            id: guestVisit.id,
            organizationId: guestVisit.organizationId,
            branchId: guestVisit.branchId,
            guestName: guestVisit.guestName,
            guestContact: guestVisit.guestContact,
            responsibleEmployeeId: guestVisit.responsibleEmployeeId,
            scheduledEntryTime: guestVisit.scheduledEntryTime,
            scheduledExitTime: guestVisit.scheduledExitTime,
            status: guestVisit.status,
            accessCredentialType: guestVisit.accessCredentialType,
            createdByUserId: guestVisit.createdByUserId,
            createdAt: guestVisit.createdAt,
            updatedAt: guestVisit.updatedAt,
        };
    }

    @Post('visits/:id/approve')
    @Permissions(PERMISSIONS.GUEST.APPROVE)
    @ApiOperation({ summary: 'Approve a guest visit' })
    @ApiParam({ name: 'id', description: 'ID of the guest visit to approve' })
    @ApiBody({ type: ApproveGuestVisitDto })
    @ApiResponse({
        status: 200,
        description: 'The guest visit has been successfully approved.',
        type: GuestVisitResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Guest visit not found.' })
    async approveGuestVisit(
        @Param('id') id: string,
        @Body() approveDto: ApproveGuestVisitDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<GuestVisitResponseDto> {
        const guestVisit = await this.guestService.approveGuestVisit(
            id,
            approveDto,
            scope,
            user.sub
        );

        return {
            id: guestVisit.id,
            organizationId: guestVisit.organizationId,
            branchId: guestVisit.branchId,
            guestName: guestVisit.guestName,
            guestContact: guestVisit.guestContact,
            responsibleEmployeeId: guestVisit.responsibleEmployeeId,
            scheduledEntryTime: guestVisit.scheduledEntryTime,
            scheduledExitTime: guestVisit.scheduledExitTime,
            status: guestVisit.status,
            accessCredentialType: guestVisit.accessCredentialType,
            accessCredentials: (guestVisit as GuestVisitWithCredentials).accessCredentials,
            createdByUserId: guestVisit.createdByUserId,
            createdAt: guestVisit.createdAt,
            updatedAt: guestVisit.updatedAt,
        };
    }

    @Post('visits/:id/reject')
    @Permissions(PERMISSIONS.GUEST.APPROVE)
    @ApiOperation({ summary: 'Reject a guest visit' })
    @ApiParam({ name: 'id', description: 'ID of the guest visit to reject' })
    @ApiBody({ type: RejectGuestVisitDto })
    @ApiResponse({
        status: 200,
        description: 'The guest visit has been successfully rejected.',
        type: GuestVisitResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Guest visit not found.' })
    async rejectGuestVisit(
        @Param('id') id: string,
        @Body() rejectDto: RejectGuestVisitDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<GuestVisitResponseDto> {
        const guestVisit = await this.guestService.rejectGuestVisit(
            id,
            rejectDto.reason,
            scope,
            user.sub
        );

        return {
            id: guestVisit.id,
            organizationId: guestVisit.organizationId,
            branchId: guestVisit.branchId,
            guestName: guestVisit.guestName,
            guestContact: guestVisit.guestContact,
            responsibleEmployeeId: guestVisit.responsibleEmployeeId,
            scheduledEntryTime: guestVisit.scheduledEntryTime,
            scheduledExitTime: guestVisit.scheduledExitTime,
            status: guestVisit.status,
            accessCredentialType: guestVisit.accessCredentialType,
            createdByUserId: guestVisit.createdByUserId,
            createdAt: guestVisit.createdAt,
            updatedAt: guestVisit.updatedAt,
        };
    }

    @Post('visits/:id/activate')
    @Permissions(PERMISSIONS.GUEST.MANAGE)
    @ApiOperation({ summary: 'Activate a guest visit (check-in)' })
    @ApiParam({ name: 'id', description: 'ID of the guest visit to activate' })
    @ApiResponse({
        status: 200,
        description: 'The guest visit has been successfully activated.',
        type: GuestVisitResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Guest visit not found.' })
    async activateGuestVisit(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<GuestVisitResponseDto> {
        const guestVisit = await this.guestService.activateGuestVisit(id, scope, user.sub);

        return {
            id: guestVisit.id,
            organizationId: guestVisit.organizationId,
            branchId: guestVisit.branchId,
            guestName: guestVisit.guestName,
            guestContact: guestVisit.guestContact,
            responsibleEmployeeId: guestVisit.responsibleEmployeeId,
            scheduledEntryTime: guestVisit.scheduledEntryTime,
            scheduledExitTime: guestVisit.scheduledExitTime,
            status: guestVisit.status,
            accessCredentialType: guestVisit.accessCredentialType,
            createdByUserId: guestVisit.createdByUserId,
            createdAt: guestVisit.createdAt,
            updatedAt: guestVisit.updatedAt,
        };
    }

    @Post('visits/:id/complete')
    @Permissions(PERMISSIONS.GUEST.MANAGE)
    @ApiOperation({ summary: 'Complete a guest visit (check-out)' })
    @ApiParam({ name: 'id', description: 'ID of the guest visit to complete' })
    @ApiResponse({
        status: 200,
        description: 'The guest visit has been successfully completed.',
        type: GuestVisitResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Guest visit not found.' })
    async completeGuestVisit(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<GuestVisitResponseDto> {
        const guestVisit = await this.guestService.completeGuestVisit(id, scope, user.sub);

        return {
            id: guestVisit.id,
            organizationId: guestVisit.organizationId,
            branchId: guestVisit.branchId,
            guestName: guestVisit.guestName,
            guestContact: guestVisit.guestContact,
            responsibleEmployeeId: guestVisit.responsibleEmployeeId,
            scheduledEntryTime: guestVisit.scheduledEntryTime,
            scheduledExitTime: guestVisit.scheduledExitTime,
            status: guestVisit.status,
            accessCredentialType: guestVisit.accessCredentialType,
            createdByUserId: guestVisit.createdByUserId,
            createdAt: guestVisit.createdAt,
            updatedAt: guestVisit.updatedAt,
        };
    }

    @Post('visits/expire-overdue')
    @Permissions(PERMISSIONS.ADMIN.SYSTEM_MANAGE)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Expire overdue guest visits' })
    @ApiResponse({ status: 200, description: 'The number of expired visits.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async expireOverdueVisits(@Scope() scope: DataScope): Promise<{ expiredCount: number }> {
        const expiredCount = await this.guestService.expireOverdueVisits(scope);
        return { expiredCount };
    }
}
