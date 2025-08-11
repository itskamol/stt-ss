import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { OrganizationRepository } from './organization.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { DatabaseUtil } from '../../shared/utils';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../../shared/dto';

@Injectable()
export class OrganizationService {
    constructor(
        private readonly organizationRepository: OrganizationRepository,
        private readonly logger: LoggerService
    ) {}

    /**
     * Create a new organization (SUPER_ADMIN only)
     */
    async createOrganization(
        createOrganizationDto: CreateOrganizationDto,
        createdByUserId: string,
        correlationId?: string
    ): Promise<Organization> {
        try {
            const organization = await this.organizationRepository.create(createOrganizationDto);

            this.logger.logUserAction(
                createdByUserId,
                'ORGANIZATION_CREATED',
                {
                    organizationId: organization.id,
                    organizationName: organization.name,
                },
                organization.id,
                correlationId
            );

            return organization;
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                const fields = DatabaseUtil.getUniqueConstraintFields(error);
                throw new ConflictException(
                    `Organization with this ${fields.join(', ')} already exists`
                );
            }
            throw error;
        }
    }

    /**
     * Get all organizations (SUPER_ADMIN only)
     */
    async getAllOrganizations(correlationId?: string): Promise<Organization[]> {
        return this.organizationRepository.findMany();
    }

    /**
     * Get organization by ID
     */
    async getOrganizationById(id: string): Promise<Organization | null> {
        return this.organizationRepository.findById(id);
    }

    /**
     * Get organization by name
     */
    async getOrganizationByName(name: string): Promise<Organization | null> {
        return this.organizationRepository.findByName(name);
    }

    /**
     * Update organization (ORG_ADMIN or SUPER_ADMIN)
     */
    async updateOrganization(
        id: string,
        updateOrganizationDto: UpdateOrganizationDto,
        updatedByUserId: string,
        correlationId?: string
    ): Promise<Organization> {
        try {
            const existingOrganization = await this.organizationRepository.findById(id);
            if (!existingOrganization) {
                throw new NotFoundException('Organization not found');
            }

            const updatedOrganization = await this.organizationRepository.update(
                id,
                updateOrganizationDto
            );

            this.logger.logUserAction(
                updatedByUserId,
                'ORGANIZATION_UPDATED',
                {
                    organizationId: id,
                    changes: updateOrganizationDto,
                    oldName: existingOrganization.name,
                    newName: updatedOrganization.name,
                },
                id,
                correlationId
            );

            return updatedOrganization;
        } catch (error) {
            if (DatabaseUtil.isUniqueConstraintError(error)) {
                const fields = DatabaseUtil.getUniqueConstraintFields(error);
                throw new ConflictException(
                    `Organization with this ${fields.join(', ')} already exists`
                );
            }
            throw error;
        }
    }

    /**
     * Delete organization (SUPER_ADMIN only)
     */
    async deleteOrganization(
        id: string,
        deletedByUserId: string,
        correlationId?: string
    ): Promise<void> {
        const existingOrganization = await this.organizationRepository.findById(id);
        if (!existingOrganization) {
            throw new NotFoundException('Organization not found');
        }

        await this.organizationRepository.delete(id);

        this.logger.logUserAction(
            deletedByUserId,
            'ORGANIZATION_DELETED',
            {
                organizationId: id,
                organizationName: existingOrganization.name,
            },
            id,
            correlationId
        );
    }

    /**
     * Get organization with statistics
     */
    async getOrganizationWithStats(id: string) {
        const organizationWithStats = await this.organizationRepository.findWithStats(id);

        if (!organizationWithStats) {
            throw new NotFoundException('Organization not found');
        }

        return {
            id: organizationWithStats.id,
            name: organizationWithStats.name,
            description: organizationWithStats.description,
            createdAt: organizationWithStats.createdAt,
            updatedAt: organizationWithStats.updatedAt,
            statistics: {
                totalUsers: organizationWithStats._count.users,
                totalBranches: organizationWithStats._count.branches,
                totalEmployees: organizationWithStats._count.employees,
                totalDevices: organizationWithStats._count.devices,
            },
        };
    }

    /**
     * Search organizations by name (SUPER_ADMIN only)
     */
    async searchOrganizations(searchTerm: string): Promise<Organization[]> {
        return this.organizationRepository.findMany({
            name: {
                contains: searchTerm,
                mode: 'insensitive',
            },
        });
    }

    /**
     * Get organization count
     */
    async getOrganizationCount(): Promise<number> {
        return this.organizationRepository.count();
    }
}
