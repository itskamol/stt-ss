import { Injectable } from '@nestjs/common';
import { Device, DeviceProtocol, ParameterFormatType } from '@prisma/client';
import { PrismaService } from '@/core/database/prisma.service';
import { CreateDeviceDto, UpdateDeviceDto } from '@/shared/dto';
import { DataScope } from '@/shared/interfaces';
import { QueryBuilder } from '@/shared/utils/query-builder.util';

@Injectable()
export class DeviceRepository {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: CreateDeviceDto, scope: DataScope): Promise<Device> {
        return this.prisma.device.create({
            data: {
                name: data.name,
                type: data.type,
                branchId: data.branchId,
                host: data.host,
                username: data.username,
                password: data.password,
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

    async findByDeviceSerialNumber(
        serialNumber: string,
        scope: DataScope
    ): Promise<Device | null> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.device.findFirst({
            where: {
                serialNumber,
                ...whereClause,
            },
        });
    }

    async findMany(scope: DataScope, skip: number, take: number, filters: any = {}): Promise<Device[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.device.findMany({
            where: {
                ...filters,
                branch: whereClause,
            },
            skip,
            take,
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
        return this.prisma.device.update({
            where: { id },
            data,
        });
    }

    async delete(id: string, scope: DataScope): Promise<void> {
        await this.prisma.device.delete({
            where: { id },
        });
    }

    async count(scope: DataScope, filters: any = {}): Promise<number> {
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

    async searchDevices(searchTerm: string, scope: DataScope, skip: number, take: number): Promise<Device[]> {
        const whereClause = QueryBuilder.buildBranchScope(scope);

        return this.prisma.device.findMany({
            where: {
                branch: whereClause,
                OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                    { macAddress: { contains: searchTerm, mode: 'insensitive' } },
                    { model: { contains: searchTerm, mode: 'insensitive' } },
                    { host: { contains: searchTerm, mode: 'insensitive' } },
                ],
            },
            skip,
            take,
            orderBy: { name: 'asc' },
        });
    }

    async updateLastSeen(id: string, lastSeen: Date): Promise<void> {
        await this.prisma.device.update({
            where: { id },
            data: { lastSeen },
        });
    }

    async getAllIdentifiers(scope: DataScope): Promise<string[]> {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        const devices = await this.prisma.device.findMany({
            where: whereClause,
            select: {
                id: true,
                macAddress: true,
            },
        });

        return devices
            .map(device => device.macAddress || device.id)
            .filter((identifier): identifier is string => identifier !== null);
    }

    // ==================== Webhook Methods ====================

    async createWebhook(data: {
        deviceId: string;
        hostId: string;
        url: string;
        host: string;
        port: number;
        eventTypes: string[];
        protocolType: DeviceProtocol;
        parameterFormatType: ParameterFormatType;
        isActive: boolean;
        createdByUserId: string;
        organizationId: string;
    }) {
        return this.prisma.deviceWebhook.create({
            data,
        });
    }

    async findWebhooksByDevice(deviceId: string, scope: DataScope) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.deviceWebhook.findMany({
            where: {
                deviceId,
                ...whereClause,
                isActive: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findWebhookByHostId(deviceId: string, hostId: string, scope: DataScope) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.deviceWebhook.findFirst({
            where: {
                deviceId,
                hostId,
                ...whereClause,
            },
        });
    }

    async updateWebhook(webhookId: string, data: {
        isActive?: boolean;
        triggerCount?: number;
        lastTriggered?: Date;
        lastError?: string | null;
        lastErrorAt?: Date | null;
        updatedAt?: Date;
    }) {
        return this.prisma.deviceWebhook.update({
            where: { id: webhookId },
            data,
        });
    }

    async deleteWebhook(webhookId: string): Promise<void> {
        await this.prisma.deviceWebhook.delete({
            where: { id: webhookId },
        });
    }

    async findAllWebhooks(scope: DataScope) {
        const whereClause = QueryBuilder.buildOrganizationScope(scope);

        return this.prisma.deviceWebhook.findMany({
            where: {
                ...whereClause,
                isActive: true,
            },
            include: {
                device: {
                    select: {
                        id: true,
                        name: true,
                        host: true,
                        status: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
