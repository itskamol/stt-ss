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
} from '../../shared/dto';
import { Permissions, Scope, User } from '../../shared/decorators';
import { DataScope, UserContext } from '../../shared/interfaces';

@Controller('guests')
export class GuestController {
    constructor(private readonly guestService: GuestService) {}

    @Post('visits')
    @Permissions('guest:create')
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
    @Permissions('guest:read:all')
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
    @Permissions('guest:read:all')
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
    @Permissions('guest:read:all')
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
    @Permissions('guest:read:all')
    async getGuestVisitsByStatus(
        @Param('status') status: string,
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
    @Permissions('guest:read:all')
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
    @Permissions('guest:update:managed')
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
    @Permissions('guest:approve')
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
            accessCredentials: (guestVisit as any).accessCredentials,
            createdByUserId: guestVisit.createdByUserId,
            createdAt: guestVisit.createdAt,
            updatedAt: guestVisit.updatedAt,
        };
    }

    @Post('visits/:id/reject')
    @Permissions('guest:approve')
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
    @Permissions('guest:manage')
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
    @Permissions('guest:manage')
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
    @Permissions('admin:system:manage')
    @HttpCode(HttpStatus.OK)
    async expireOverdueVisits(@Scope() scope: DataScope): Promise<{ expiredCount: number }> {
        const expiredCount = await this.guestService.expireOverdueVisits(scope);
        return { expiredCount };
    }
}
