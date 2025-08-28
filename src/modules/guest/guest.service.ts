import crypto from 'crypto';
import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { GuestStatus, GuestVisit } from '@prisma/client';
import { GuestRepository } from './guest.repository';
// import { QueueProducer } from '@/core/queue/queue.producer'; // Temporarily disabled
import {
    ApproveGuestVisitDto,
    CreateGuestVisitDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateGuestVisitDto,
} from '@/shared/dto';
import { DataScope, GuestVisitWithCredentials } from '@/shared/interfaces';

@Injectable()
export class GuestService {
    constructor(
        private readonly guestRepository: GuestRepository,
        // @Optional() private readonly queueProducer: QueueProducer // Temporarily disabled
    ) {}

    /**
     * Create a new guest visit request
     */
    async createGuestVisit(
        createGuestVisitDto: CreateGuestVisitDto,
        scope: DataScope,
        createdByUserId: string
    ): Promise<GuestVisit> {
        // Validate that the branch is accessible within the scope
        if (scope.branchIds && !scope.branchIds.includes(createGuestVisitDto.branchId)) {
            throw new BadRequestException('Branch not accessible within your scope');
        }

        // Validate visit times
        const scheduledEntry = new Date(createGuestVisitDto.scheduledEntryTime);
        const scheduledExit = new Date(createGuestVisitDto.scheduledExitTime);

        if (scheduledEntry >= scheduledExit) {
            throw new BadRequestException('Scheduled entry time must be before exit time');
        }

        if (scheduledEntry < new Date()) {
            throw new BadRequestException('Scheduled entry time cannot be in the past');
        }

        return this.guestRepository.create(createGuestVisitDto, scope, createdByUserId);
    }

    /**
     * Get all guest visits (scoped to managed branches)
     */
    async getGuestVisits(
        filters: {
            status?: string;
            branchId?: string;
            startDate?: Date;
            endDate?: Date;
        },
        scope: DataScope,
        paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<GuestVisit>> {
        const { page, limit } = paginationDto;
        const skip = (page - 1) * limit;

        const [visits, total] = await Promise.all([
            this.guestRepository.findMany(scope, skip, limit, filters),
            this.guestRepository.count(scope, filters),
        ]);

        return new PaginationResponseDto(visits, total, page, limit);
    }

    /**
     * Get guest visit by ID
     */
    async getGuestVisitById(id: string, scope: DataScope): Promise<GuestVisit> {
        const visit = await this.guestRepository.findById(id, scope);
        if (!visit) {
            throw new NotFoundException('Guest visit not found');
        }
        return visit;
    }

    /**
     * Update guest visit
     */
    async updateGuestVisit(
        id: string,
        updateGuestVisitDto: UpdateGuestVisitDto,
        scope: DataScope,
        updatedByUserId: string
    ): Promise<GuestVisit> {
        const existingVisit = await this.getGuestVisitById(id, scope);

        // Only allow updates if visit is still pending or approved (not active/completed)
        if (['ACTIVE', 'COMPLETED', 'EXPIRED'].includes(existingVisit.status)) {
            throw new BadRequestException('Cannot update visit in current status');
        }

        // Validate visit times if being updated
        if (updateGuestVisitDto.scheduledEntryTime || updateGuestVisitDto.scheduledExitTime) {
            const entryTime = updateGuestVisitDto.scheduledEntryTime
                ? new Date(updateGuestVisitDto.scheduledEntryTime)
                : existingVisit.scheduledEntryTime;
            const exitTime = updateGuestVisitDto.scheduledExitTime
                ? new Date(updateGuestVisitDto.scheduledExitTime)
                : existingVisit.scheduledExitTime;

            if (entryTime >= exitTime) {
                throw new BadRequestException('Scheduled entry time must be before exit time');
            }
        }

        return this.guestRepository.update(id, updateGuestVisitDto, scope);
    }

    /**
     * Approve guest visit
     */
    async approveGuestVisit(
        id: string,
        approveDto: ApproveGuestVisitDto,
        scope: DataScope,
        approvedByUserId: string
    ): Promise<GuestVisit> {
        const existingVisit = await this.getGuestVisitById(id, scope);

        if (existingVisit.status !== 'PENDING_APPROVAL') {
            throw new BadRequestException('Only pending visits can be approved');
        }

        // Generate access credentials
        const accessCredentials = await this.generateAccessCredentials(
            existingVisit,
            approveDto.accessCredentialType
        );

        const updatedVisit = await this.guestRepository.update(
            id,
            {
                status: 'APPROVED',
                accessCredentialType: approveDto.accessCredentialType,
                accessCredentialHash: accessCredentials.hash,
            },
            scope
        );

        // Schedule visit expiration
        await this.scheduleVisitExpiration(updatedVisit);

        return {
            ...updatedVisit,
            accessCredentials: accessCredentials.credential,
        } as GuestVisitWithCredentials;
    }

    /**
     * Reject guest visit
     */
    async rejectGuestVisit(
        id: string,
        reason: string,
        scope: DataScope,
        rejectedByUserId: string
    ): Promise<GuestVisit> {
        await this.getGuestVisitById(id, scope);

        return this.guestRepository.update(
            id,
            {
                status: 'REJECTED',
            },
            scope
        );
    }

    /**
     * Activate guest visit (when guest arrives)
     */
    async activateGuestVisit(
        id: string,
        scope: DataScope,
        activatedByUserId?: string
    ): Promise<GuestVisit> {
        const existingVisit = await this.getGuestVisitById(id, scope);

        if (existingVisit.status !== 'APPROVED') {
            throw new BadRequestException('Only approved visits can be activated');
        }

        // Check if visit is within scheduled time
        const now = new Date();
        if (now < existingVisit.scheduledEntryTime) {
            throw new BadRequestException('Visit cannot be activated before scheduled entry time');
        }

        if (now > existingVisit.scheduledExitTime) {
            throw new BadRequestException('Visit has expired');
        }

        return this.guestRepository.update(
            id,
            {
                status: 'ACTIVE',
            },
            scope
        );
    }

    /**
     * Complete guest visit (when guest leaves)
     */
    async completeGuestVisit(
        id: string,
        scope: DataScope,
        completedByUserId?: string
    ): Promise<GuestVisit> {
        const existingVisit = await this.getGuestVisitById(id, scope);

        if (!['APPROVED', 'ACTIVE'].includes(existingVisit.status)) {
            throw new BadRequestException('Only approved or active visits can be completed');
        }

        return this.guestRepository.update(
            id,
            {
                status: 'COMPLETED',
            },
            scope
        );
    }

    /**
     * Get guest visits by status
     */
    async getGuestVisitsByStatus(status: GuestStatus, scope: DataScope): Promise<GuestVisit[]> {
        const skip = 0;
        const take = 100; // or some other limit
        return this.guestRepository.findMany(scope, skip, take, { status });
    }

    /**
     * Search guest visits
     */
    async searchGuestVisits(searchTerm: string, scope: DataScope): Promise<GuestVisit[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }
        const skip = 0;
        const take = 10;
        return this.guestRepository.searchGuestVisits(searchTerm.trim(), scope, skip, take);
    }

    /**
     * Get guest visit statistics
     */
    async getGuestVisitStats(
        filters: {
            branchId?: string;
            startDate?: Date;
            endDate?: Date;
        },
        scope: DataScope
    ) {
        return this.guestRepository.getGuestVisitStats(filters, scope);
    }

    /**
     * Expire overdue visits
     */
    async expireOverdueVisits(scope?: DataScope): Promise<number> {
        const overdueVisits = await this.guestRepository.findOverdueVisits(scope);
        let expiredCount = 0;

        for (const visit of overdueVisits) {
            try {
                await this.guestRepository.update(
                    visit.id,
                    { status: 'EXPIRED' },
                    scope || {
                        organizationId: visit.organizationId,
                    }
                );
                expiredCount++;
            } catch (error) {
                // log error
            }
        }

        return expiredCount;
    }

    private async generateAccessCredentials(
        visit: GuestVisit,
        credentialType: string
    ): Promise<{ credential: string; hash: string }> {
        switch (credentialType) {
            case 'QR_CODE':
                // Generate QR code data
                const qrData = {
                    visitId: visit.id,
                    guestName: visit.guestName,
                    branchId: visit.branchId,
                    validFrom: visit.scheduledEntryTime,
                    validTo: visit.scheduledExitTime,
                    timestamp: new Date(),
                };
                const qrString = JSON.stringify(qrData);
                const qrHash = crypto.createHash('sha256').update(qrString).digest('hex');

                return {
                    credential: Buffer.from(qrString).toString('base64'),
                    hash: qrHash,
                };

            case 'TEMP_CARD':
                // Generate temporary card number
                const cardNumber = `TEMP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const cardHash = crypto.createHash('sha256').update(cardNumber).digest('hex');

                return {
                    credential: cardNumber,
                    hash: cardHash,
                };

            case 'FACE':
                // For face recognition, we'd typically store a reference ID
                const faceId = `FACE-${visit.id}-${Date.now()}`;
                const faceHash = crypto.createHash('sha256').update(faceId).digest('hex');

                return {
                    credential: faceId,
                    hash: faceHash,
                };

            default:
                throw new BadRequestException(`Unsupported credential type: ${credentialType}`);
        }
    }

    private async scheduleVisitExpiration(visit: GuestVisit): Promise<void> {
        try {
            // Temporarily disabled queue processing
            // await this.queueProducer.processGuestVisitExpiration({
            //     visitId: visit.id,
            //     guestId: visit.id, // Using visit ID as guest ID for now
            //     organizationId: visit.organizationId,
            //     branchId: visit.branchId,
            //     expiresAt: visit.scheduledExitTime,
            // });
        } catch (error) {
            // log error
        }
    }
}
