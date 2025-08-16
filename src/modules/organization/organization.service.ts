import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { OrganizationRepository } from './organization.repository';
import { DatabaseUtil } from '@/shared/utils';
import {
    CreateOrganizationDto,
    UpdateOrganizationDto,
    PaginationDto,
    PaginationResponseDto,
} from '@/shared/dto';

@Injectable()
export class OrganizationService {
    constructor(private readonly organizationRepository: OrganizationRepository) {}

    /**
     * Create a new organization (SUPER_ADMIN only)
     */
    async createOrganization(
        createOrganizationDto: CreateOrganizationDto,
        createdByUserId: string
    ): Promise<Organization> {
        try {
            return await this.organizationRepository.create(createOrganizationDto);
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
    async getAllOrganizations(
        paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<Organization>> {
        const { page, limit } = paginationDto;
        const skip = (page - 1) * limit;

        const [organizations, total] = await Promise.all([
            this.organizationRepository.findMany(skip, limit),
            this.organizationRepository.countAll(),
        ]);

        return new PaginationResponseDto(organizations, total, page, limit);
    }

    /**
     * Get organization by ID
     */
    async getOrganizationById(id: string): Promise<Organization> {
        const organization = await this.organizationRepository.findById(id);
        if (!organization) {
            throw new NotFoundException('Organization not found');
        }
        return organization;
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
        updatedByUserId: string
    ): Promise<Organization> {
        await this.getOrganizationById(id); // Ensure organization exists

        try {
            return await this.organizationRepository.update(id, updateOrganizationDto);
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
    async deleteOrganization(id: string, deletedByUserId: string): Promise<void> {
        await this.getOrganizationById(id); // Ensure organization exists
        await this.organizationRepository.delete(id);
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
        const take = 10; // Limit search results
        const skip = 0;
        return this.organizationRepository.findMany(skip, take, {
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
