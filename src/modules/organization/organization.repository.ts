import { Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { PrismaService } from '@/core/database/prisma.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from '@/shared/dto/organization.dto';

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

    async findMany(skip: number, take: number, filters: any = {}): Promise<Organization[]> {
        return this.prisma.organization.findMany({
            where: filters,
            skip,
            take,
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

    async countAll(): Promise<number> {
        return this.prisma.organization.count();
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
