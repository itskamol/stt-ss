import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { GuestVisit } from '@prisma/client';
import { GuestRepository } from './guest.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { QueueProducer } from '../../core/queue/queue.producer';
import { ApproveGuestVisitDto, CreateGuestVisitDto, UpdateGuestVisitDto } from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';

@Injectable()
export class GuestService {
    constructor(
        private readonly guestRepository: GuestRepository,
        private readonly logger: LoggerService,
        private readonly queueProducer: QueueProducer
    ) {}

    /**
     * Create a new guest visit request
     */
    async createGuestVisit(
        createGuestVisitDto: CreateGuestVisitDto,
        scope: DataScope,
        createdByUserId: string,
        correlationId?: string
    ): Promise<GuestVisit> {
        try {
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

            const guestVisit = await this.guestRepository.create(
                createGuestVisitDto,
                scope,
                createdByUserId
            );

            this.logger.logUserAction(
                createdByUserId,
                'GUEST_VISIT_CREATED',
                {
                    guestVisitId: guestVisit.id,
                    guestName: guestVisit.guestName,
                    branchId: guestVisit.branchId,
                    scheduledEntryTime: guestVisit.scheduledEntryTime,
                    scheduledExitTime: guestVisit.scheduledExitTime,
                },
                scope.organizationId,
                correlationId
            );

            return guestVisit;
        } catch (error) {
            this.logger.error('Failed to create guest visit', error.message, {
                guestName: createGuestVisitDto.guestName,
                branchId: createGuestVisitDto.branchId,
                createdByUserId,
            });
            throw error;
        }
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
        scope: DataScope
    ): Promise<GuestVisit[]> {
        return this.guestRepository.findMany(filters, scope);
    }

    /**
     * Get guest visit by ID
     */
    async getGuestVisitById(id: string, scope: DataScope): Promise<GuestVisit | null> {
        return this.guestRepository.findById(id, scope);
    }

    /**
     * Update guest visit
     */
    async updateGuestVisit(
        id: string,
        updateGuestVisitDto: UpdateGuestVisitDto,
        scope: DataScope,
        updatedByUserId: string,
        correlationId?: string
    ): Promise<GuestVisit> {
        const existingVisit = await this.guestRepository.findById(id, scope);
        if (!existingVisit) {
            throw new NotFoundException('Guest visit not found');
        }

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

        const updatedVisit = await this.guestRepository.update(id, updateGuestVisitDto, scope);

        this.logger.logUserAction(
            updatedByUserId,
            'GUEST_VISIT_UPDATED',
            {
                guestVisitId: id,
                changes: updateGuestVisitDto,
                oldStatus: existingVisit.status,
                newStatus: updatedVisit.status,
            },
            scope.organizationId,
            correlationId
        );

        return updatedVisit;
    }

    /**
     * Approve guest visit
     */
    async approveGuestVisit(
        id: string,
        approveDto: ApproveGuestVisitDto,
        scope: DataScope,
        approvedByUserId: string,
        correlationId?: string
    ): Promise<GuestVisit> {
        const existingVisit = await this.guestRepository.findById(id, scope);
        if (!existingVisit) {
            throw new NotFoundException('Guest visit not found');
        }

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

        this.logger.logUserAction(
            approvedByUserId,
            'GUEST_VISIT_APPROVED',
            {
                guestVisitId: id,
                guestName: existingVisit.guestName,
                accessCredentialType: approveDto.accessCredentialType,
                scheduledEntryTime: existingVisit.scheduledEntryTime,
                scheduledExitTime: existingVisit.scheduledExitTime,
            },
            scope.organizationId,
            correlationId
        );

        return {
            ...updatedVisit,
            accessCredentials: accessCredentials.credential,
        } as any;
    }

    /**
     * Reject guest visit
     */
    async rejectGuestVisit(
        id: string,
        reason: string,
        scope: DataScope,
        rejectedByUserId: string,
        correlationId?: string
    ): Promise<GuestVisit> {
        const existingVisit = await this.guestRepository.findById(id, scope);
        if (!existingVisit) {
            throw new NotFoundException('Guest visit not found');
        }

        if (existingVisit.status !== 'PENDING_APPROVAL') {
            throw new BadRequestException('Only pending visits can be rejected');
        }

        const updatedVisit = await this.guestRepository.update(
            id,
            {
                status: 'REJECTED',
            },
            scope
        );

        this.logger.logUserAction(
            rejectedByUserId,
            'GUEST_VISIT_REJECTED',
            {
                guestVisitId: id,
                guestName: existingVisit.guestName,
                reason,
            },
            scope.organizationId,
            correlationId
        );

        return updatedVisit;
    }

    /**
     * Activate guest visit (when guest arrives)
     */
    async activateGuestVisit(
        id: string,
        scope: DataScope,
        activatedByUserId?: string,
        correlationId?: string
    ): Promise<GuestVisit> {
        const existingVisit = await this.guestRepository.findById(id, scope);
        if (!existingVisit) {
            throw new NotFoundException('Guest visit not found');
        }

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

        const updatedVisit = await this.guestRepository.update(
            id,
            {
                status: 'ACTIVE',
            },
            scope
        );

        this.logger.logUserAction(
            activatedByUserId || 'SYSTEM',
            'GUEST_VISIT_ACTIVATED',
            {
                guestVisitId: id,
                guestName: existingVisit.guestName,
                activatedAt: now,
            },
            scope.organizationId,
            correlationId
        );

        return updatedVisit;
    }

    /**
     * Complete guest visit (when guest leaves)
     */
    async completeGuestVisit(
        id: string,
        scope: DataScope,
        completedByUserId?: string,
        correlationId?: string
    ): Promise<GuestVisit> {
        const existingVisit = await this.guestRepository.findById(id, scope);
        if (!existingVisit) {
            throw new NotFoundException('Guest visit not found');
        }

        if (!['APPROVED', 'ACTIVE'].includes(existingVisit.status)) {
            throw new BadRequestException('Only approved or active visits can be completed');
        }

        const updatedVisit = await this.guestRepository.update(
            id,
            {
                status: 'COMPLETED',
            },
            scope
        );

        this.logger.logUserAction(
            completedByUserId || 'SYSTEM',
            'GUEST_VISIT_COMPLETED',
            {
                guestVisitId: id,
                guestName: existingVisit.guestName,
                completedAt: new Date(),
            },
            scope.organizationId,
            correlationId
        );

        return updatedVisit;
    }

    /**
     * Get guest visits by status
     */
    async getGuestVisitsByStatus(status: string, scope: DataScope): Promise<GuestVisit[]> {
        return this.guestRepository.findByStatus(status, scope);
    }

    /**
     * Search guest visits
     */
    async searchGuestVisits(searchTerm: string, scope: DataScope): Promise<GuestVisit[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        return this.guestRepository.searchGuestVisits(searchTerm.trim(), scope);
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

                this.logger.log('Guest visit expired', {
                    guestVisitId: visit.id,
                    guestName: visit.guestName,
                    scheduledExitTime: visit.scheduledExitTime,
                });
            } catch (error) {
                this.logger.error('Failed to expire guest visit', error.message, {
                    guestVisitId: visit.id,
                });
            }
        }

        return expiredCount;
    }

    private async generateAccessCredentials(
        visit: GuestVisit,
        credentialType: string
    ): Promise<{ credential: string; hash: string }> {
        const crypto = require('crypto');

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
            await this.queueProducer.processGuestVisitExpiration({
                visitId: visit.id,
                guestId: visit.id, // Using visit ID as guest ID for now
                organizationId: visit.organizationId,
                branchId: visit.branchId,
                expiresAt: visit.scheduledExitTime,
            });

            this.logger.log('Guest visit expiration scheduled', {
                guestVisitId: visit.id,
                expiresAt: visit.scheduledExitTime,
            });
        } catch (error) {
            this.logger.error('Failed to schedule visit expiration', error.message, {
                guestVisitId: visit.id,
            });
        }
    }
}
