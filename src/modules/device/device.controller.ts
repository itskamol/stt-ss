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
import { DeviceService } from './device.service';
import {
    CreateDeviceDto,
    DeviceCommandDto,
    DeviceDiscoveryResponseDto,
    DeviceResponseDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateDeviceDto,
} from '../../shared/dto';
import { Permissions, Scope, User } from '../../shared/decorators';
import { DataScope, UserContext } from '../../shared/interfaces';

@Controller('devices')
export class DeviceController {
    constructor(private readonly deviceService: DeviceService) {}

    private mapDeviceToResponse(device: any): DeviceResponseDto {
        return {
            id: device.id,
            organizationId: device.organizationId,
            branchId: device.branchId,
            name: device.name,
            type: device.type,
            deviceIdentifier: device.deviceIdentifier,
            ipAddress: device.ipAddress,
            macAddress: device.macAddress,
            model: device.model,
            description: device.description,
            status: device.status,
            isActive: device.isActive,
            lastSeen: device.lastSeen || device.lastSeenAt,
            lastSeenAt: device.lastSeenAt,
            createdAt: device.createdAt,
            updatedAt: device.updatedAt,
        };
    }

    @Post()
    @Permissions('device:create')
    async createDevice(
        @Body() createDeviceDto: CreateDeviceDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto> {
        const device = await this.deviceService.createDevice(createDeviceDto, scope, user.sub);

        return this.mapDeviceToResponse(device);
    }

    @Get()
    @Permissions('device:read:all')
    async getDevices(
        @Scope() scope: DataScope,
        @Query() paginationDto: PaginationDto
    ): Promise<PaginationResponseDto<DeviceResponseDto>> {
        const devices = await this.deviceService.getDevices(scope);

        // Simple pagination (in a real app, you'd do this at the database level)
        const { page = 1, limit = 10 } = paginationDto;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedDevices = devices.slice(startIndex, endIndex);

        const responseDevices = paginatedDevices.map(device => this.mapDeviceToResponse(device));

        return new PaginationResponseDto(responseDevices, devices.length, page, limit);
    }

    @Get('search')
    @Permissions('device:read:all')
    async searchDevices(
        @Query('q') searchTerm: string,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        const devices = await this.deviceService.searchDevices(searchTerm.trim(), scope);

        return devices.map(device => this.mapDeviceToResponse(device));
    }

    @Get('count')
    @Permissions('device:read:all')
    async getDeviceCount(@Scope() scope: DataScope): Promise<{ count: number }> {
        const count = await this.deviceService.getDeviceCount(scope);
        return { count };
    }

    @Get('discover')
    @Permissions('device:create')
    async discoverDevices(@Scope() scope: DataScope): Promise<DeviceDiscoveryResponseDto> {
        return this.deviceService.discoverDevices(scope);
    }

    @Get('branch/:branchId')
    @Permissions('device:read:all')
    async getDevicesByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto[]> {
        const devices = await this.deviceService.getDevicesByBranch(branchId, scope);

        return devices.map(device => this.mapDeviceToResponse(device));
    }

    @Get('branch/:branchId/count')
    @Permissions('device:read:all')
    async getDeviceCountByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<{ count: number }> {
        const count = await this.deviceService.getDeviceCountByBranch(branchId, scope);
        return { count };
    }

    @Get('identifier/:identifier')
    @Permissions('device:read:all')
    async getDeviceByIdentifier(
        @Param('identifier') identifier: string,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto> {
        const device = await this.deviceService.getDeviceByIdentifier(identifier, scope);

        if (!device) {
            throw new Error('Device not found');
        }

        return this.mapDeviceToResponse(device);
    }

    @Get(':id')
    @Permissions('device:read:all')
    async getDeviceById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto> {
        const device = await this.deviceService.getDeviceById(id, scope);

        if (!device) {
            throw new Error('Device not found');
        }

        return this.mapDeviceToResponse(device);
    }

    @Get(':id/stats')
    @Permissions('device:read:all')
    async getDeviceWithStats(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.getDeviceWithStats(id, scope);
    }

    @Get(':id/health')
    @Permissions('device:read:all')
    async getDeviceHealth(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.getDeviceHealth(id, scope);
    }

    @Post(':id/test-connection')
    @Permissions('device:manage:managed')
    async testDeviceConnection(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.testDeviceConnection(id, scope);
    }

    @Post(':id/command')
    @Permissions('device:manage:managed')
    async sendDeviceCommand(
        @Param('id') id: string,
        @Body() commandDto: DeviceCommandDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.sendDeviceCommand(
            id,
            {
                command: commandDto.command,
                parameters: commandDto.parameters,
                timeout: commandDto.timeout,
            },
            scope,
            user.sub
        );
    }

    @Patch(':id')
    @Permissions('device:update:managed')
    async updateDevice(
        @Param('id') id: string,
        @Body() updateDeviceDto: UpdateDeviceDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto> {
        const device = await this.deviceService.updateDevice(id, updateDeviceDto, scope, user.sub);

        return this.mapDeviceToResponse(device);
    }

    @Patch(':id/status')
    @Permissions('device:update:managed')
    async toggleDeviceStatus(
        @Param('id') id: string,
        @Body('isActive') isActive: boolean,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto> {
        const device = await this.deviceService.toggleDeviceStatus(id, isActive, scope, user.sub);

        return this.mapDeviceToResponse(device);
    }

    @Delete(':id')
    @Permissions('device:update:managed')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteDevice(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.deviceService.deleteDevice(id, scope, user.sub);
    }
}
