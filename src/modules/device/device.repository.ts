import { Injectable } from '@nestjs/common';
import { Device } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateDeviceDto, UpdateDeviceDto } from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';
import { QueryBuilder } from '../../shared/utils/query-builder.util';

@Injectable()
export class DeviceRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: CreateDeviceDto, scope: DataScope): Promise<Device> {
        return this.prisma.device.create({
            data: {
                name: data.name,
                type: data.type as any,
                branchId: data.branchId,
                ipAddress: data.ipAddress,
                macAddress: data.macAddress,
                model: data.model,
                organizationId: scope.organizationId,
            },
        });
    }

    async findById(id: string, scope: DataScope): Promise<Device | null> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.device.findFirst({
            where: {
                id,
                branch: whereClause,
            },
        });
    }

    async findByMacAddress(macAddress: string, scope: DataScope): Promise<Device | null> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.device.findFirst({
            where: {
                macAddress,
                ...whereClause,
            },
        });
    }

    async findByDeviceIdentifier(
        deviceIdentifier: string,
        scope: DataScope
    ): Promise<Device | null> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.device.findFirst({
            where: {
                deviceIdentifier,
                ...whereClause,
            },
        });
    }

    async findMany(filters: any = {}, scope: DataScope): Promise<Device[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.device.findMany({
            where: {
                ...filters,
                branch: whereClause,
            },
            orderBy: { name: 'asc' },
        });
    }

    async findByBranch(branchId: string, scope: DataScope): Promise<Device[]> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.device.findMany({
            where: {
                branchId,
                ...whereClause,
            },
            orderBy: { name: 'asc' },
        });
    }

    async update(id: string, data: UpdateDeviceDto, scope: DataScope): Promise<Device> {
        const updateData: any = {};

        if (data.name !== undefined) updateData.name = data.name;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.ipAddress !== undefined) updateData.ipAddress = data.ipAddress;
        if (data.macAddress !== undefined) updateData.macAddress = data.macAddress;
        if (data.model !== undefined) updateData.model = data.model;
        if (data.status !== undefined) updateData.status = data.status;

        return this.prisma.device.update({
            where: { id },
            data: updateData,
        });
    }

    async delete(id: string, scope: DataScope): Promise<void> {
        await this.prisma.device.delete({
            where: { id },
        });
    }

    async count(filters: any = {}, scope: DataScope): Promise<number> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.device.count({
            where: {
                ...filters,
                branch: whereClause,
            },
        });
    }

    async findWithStats(id: string, scope: DataScope) {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.device.findFirst({
            where: {
                id,
                branch: whereClause,
            },
            include: {
                _count: {
                    select: {
                        events: true,
                    },
                },
            },
        });
    }

    async searchDevices(searchTerm: string, scope: DataScope): Promise<Device[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.device.findMany({
            where: {
                branch: whereClause,
                OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                    { macAddress: { contains: searchTerm, mode: 'insensitive' } },
                    { model: { contains: searchTerm, mode: 'insensitive' } },
                    { ipAddress: { contains: searchTerm, mode: 'insensitive' } },
                ],
            },
            orderBy: { name: 'asc' },
        });
    }

    async getAllMacAddresses(scope: DataScope): Promise<string[]> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const devices = await this.prisma.device.findMany({
            where: whereClause,
            select: {
                macAddress: true,
            },
        });

        return devices.map(device => device.macAddress).filter(Boolean);
    }

    async findByStatus(status: string, scope: DataScope): Promise<Device[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.device.findMany({
            where: {
                status: status as any,
                branch: whereClause,
            },
            orderBy: { name: 'asc' },
        });
    }

    async findByType(type: string, scope: DataScope): Promise<Device[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.device.findMany({
            where: {
                type: type as any,
                branch: whereClause,
            },
            orderBy: { name: 'asc' },
        });
    }

    async updateLastSeen(id: string, lastSeenAt: Date): Promise<void> {
        await this.prisma.device.update({
            where: { id },
            data: { lastSeenAt },
        });
    }

    async findOfflineDevices(thresholdMinutes: number, scope: DataScope): Promise<Device[]> {
        const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.device.findMany({
            where: {
                status: 'ONLINE',
                lastSeenAt: {
                    lt: threshold,
                },
                branch: whereClause,
            },
            orderBy: { lastSeenAt: 'asc' },
        });
    }

    async getAllIdentifiers(scope: DataScope): Promise<string[]> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const devices = await this.prisma.device.findMany({
            where: whereClause,
            select: {
                deviceIdentifier: true,
            },
        });

        return devices
            .map(device => device.deviceIdentifier)
            .filter((identifier): identifier is string => identifier !== null);
    }
}
