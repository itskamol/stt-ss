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
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { DeviceService } from './device.service';
import {
    CreateDeviceDto,
    DeviceCommandDto,
    DeviceDiscoveryResponseDto,
    DeviceResponseDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateDeviceDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { DataScope, UserContext } from '@/shared/interfaces';

@ApiTags('Devices')
@ApiBearerAuth()
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
    @ApiOperation({ summary: 'Create a new device' })
    @ApiBody({ type: CreateDeviceDto })
    @ApiResponse({
        status: 201,
        description: 'The device has been successfully created.',
        type: DeviceResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
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
    @ApiOperation({ summary: 'Get all devices with pagination' })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of devices.',
        type: PaginationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
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
    @ApiOperation({ summary: 'Search for devices' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiResponse({
        status: 200,
        description: 'A list of devices matching the search term.',
        type: [DeviceResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
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
    @ApiOperation({ summary: 'Get the total number of devices' })
    @ApiResponse({ status: 200, description: 'The total number of devices.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getDeviceCount(@Scope() scope: DataScope): Promise<{ count: number }> {
        const count = await this.deviceService.getDeviceCount(scope);
        return { count };
    }

    @Get('discover')
    @Permissions('device:create')
    @ApiOperation({ summary: 'Discover devices on the network' })
    @ApiResponse({
        status: 200,
        description: 'A list of discovered devices.',
        type: DeviceDiscoveryResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async discoverDevices(@Scope() scope: DataScope): Promise<DeviceDiscoveryResponseDto> {
        return this.deviceService.discoverDevices(scope);
    }

    @Get('branch/:branchId')
    @Permissions('device:read:all')
    @ApiOperation({ summary: 'Get all devices for a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiResponse({
        status: 200,
        description: 'A list of devices for the branch.',
        type: [DeviceResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Branch not found.' })
    async getDevicesByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto[]> {
        const devices = await this.deviceService.getDevicesByBranch(branchId, scope);

        return devices.map(device => this.mapDeviceToResponse(device));
    }

    @Get('branch/:branchId/count')
    @Permissions('device:read:all')
    @ApiOperation({ summary: 'Get the number of devices in a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiResponse({ status: 200, description: 'The number of devices in the branch.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Branch not found.' })
    async getDeviceCountByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<{ count: number }> {
        const count = await this.deviceService.getDeviceCountByBranch(branchId, scope);
        return { count };
    }

    @Get('identifier/:identifier')
    @Permissions('device:read:all')
    @ApiOperation({ summary: 'Get a device by its unique identifier' })
    @ApiParam({ name: 'identifier', description: 'Unique identifier of the device' })
    @ApiResponse({ status: 200, description: 'The device details.', type: DeviceResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
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
    @ApiOperation({ summary: 'Get a specific device by ID' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 200, description: 'The device details.', type: DeviceResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
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
    @ApiOperation({ summary: 'Get statistics for a specific device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 200, description: 'The device statistics.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async getDeviceWithStats(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.getDeviceWithStats(id, scope);
    }

    @Get(':id/health')
    @Permissions('device:read:all')
    @ApiOperation({ summary: 'Get the health status of a specific device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 200, description: 'The device health status.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async getDeviceHealth(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.getDeviceHealth(id, scope);
    }

    @Post(':id/test-connection')
    @Permissions('device:manage:managed')
    @ApiOperation({ summary: 'Test the connection to a device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 200, description: 'Connection test result.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async testDeviceConnection(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.testDeviceConnection(id, scope);
    }

    @Post(':id/command')
    @Permissions('device:manage:managed')
    @ApiOperation({ summary: 'Send a command to a device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiBody({ type: DeviceCommandDto })
    @ApiResponse({ status: 200, description: 'The result of the command.' })
    @ApiResponse({ status: 400, description: 'Invalid command.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
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
    @ApiOperation({ summary: 'Update a device' })
    @ApiParam({ name: 'id', description: 'ID of the device to update' })
    @ApiBody({ type: UpdateDeviceDto })
    @ApiResponse({
        status: 200,
        description: 'The device has been successfully updated.',
        type: DeviceResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
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
    @ApiOperation({ summary: 'Toggle the active status of a device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiBody({
        schema: { type: 'object', properties: { isActive: { type: 'boolean' } } },
    })
    @ApiResponse({
        status: 200,
        description: 'The device status has been updated.',
        type: DeviceResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
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
    @ApiOperation({ summary: 'Delete a device' })
    @ApiParam({ name: 'id', description: 'ID of the device to delete' })
    @ApiResponse({ status: 204, description: 'The device has been successfully deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async deleteDevice(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.deviceService.deleteDevice(id, scope, user.sub);
    }
}
