import { Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../../shared/dto/organization.dto';
import { DataScope } from '../../shared/interfaces/data-scope.interface';
import { QueryBuilder } from '../../shared/utils/query-builder.util';

@Injectable()
export class OrganizationRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: CreateOrganizationDto): Promise<Organization> {
        return this.prisma.organization.create({
            data,
        });
    }

    async findById(id: string): Promise<Organization | null> {
        return this.prisma.organization.findUnique({
            where: { id },
        });
    }

    async findByName(name: string): Promise<Organization | null> {
        return this.prisma.organization.findUnique({
            where: { name },
        });
    }

    async findMany(filters: any = {}): Promise<Organization[]> {
        return this.prisma.organization.findMany({
            where: filters,
            orderBy: { createdAt: 'desc' },
        });
    }

    async update(id: string, data: UpdateOrganizationDto): Promise<Organization> {
        return this.prisma.organization.update({
            where: { id },
            data,
        });
    }

    async delete(id: string): Promise<void> {
        await this.prisma.organization.delete({
            where: { id },
        });
    }

    async count(filters: any = {}): Promise<number> {
        return this.prisma.organization.count({
            where: filters,
        });
    }

    async findWithStats(id: string) {
        return this.prisma.organization.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        users: true,
                        branches: true,
                        employees: true,
                        devices: true,
                    },
                },
            },
        });
    }
}
