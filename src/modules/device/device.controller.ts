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
    CreateDeviceTemplateDto,
    DeviceCommandDto,
    DeviceControlDto,
    DeviceDiscoveryResponseDto,
    DeviceResponseDto,
    DeviceSyncEmployeesDto,
    PaginationDto,
    PaginationResponseDto,
    UpdateDeviceDto,
    UpdateDeviceTemplateDto,
    DeviceAutoDiscoveryDto,
    DeviceDiscoveryTestDto,
    DeviceAutoDiscoveryResponseDto,
} from '@/shared/dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';
import { DeviceProtocol } from '@prisma/client';

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
            departmentId: device.departmentId,
            name: device.name,
            type: device.type,
            deviceIdentifier: device.deviceIdentifier,
            ipAddress: device.ipAddress,
            username: device.username,
            port: device.port,
            protocol: device.protocol,
            macAddress: device.macAddress,
            manufacturer: device.manufacturer,
            model: device.model,
            firmware: device.firmware,
            description: device.description,
            status: device.status,
            isActive: device.isActive,
            lastSeen: device.lastSeen,
            timeout: device.timeout || 5000,
            retryAttempts: device.retryAttempts || 3,
            keepAlive: device.keepAlive || true,
            createdAt: device.createdAt,
            updatedAt: device.updatedAt,
        };
    }

    @Post()
    @Permissions(PERMISSIONS.DEVICE.CREATE)
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

    @Post('auto-discover')
    @Permissions(PERMISSIONS.DEVICE.CREATE)
    @ApiOperation({ 
        summary: 'Create device with auto-discovery',
        description: 'Create a device with minimal information. The system will automatically discover device details like manufacturer, model, firmware, and MAC address.'
    })
    @ApiBody({ type: DeviceAutoDiscoveryDto })
    @ApiResponse({
        status: 201,
        description: 'The device has been successfully created with auto-discovered information.',
        type: DeviceResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input or device not reachable.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async createDeviceWithAutoDiscovery(
        @Body() basicInfo: DeviceAutoDiscoveryDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto> {
        const device = await this.deviceService.createDeviceWithAutoDiscovery(
            basicInfo,
            scope,
            user.sub
        );

        return this.mapDeviceToResponse(device);
    }

    @Post('discover-info')
    @Permissions(PERMISSIONS.DEVICE.CREATE)
    @ApiOperation({ 
        summary: 'Discover device information',
        description: 'Test connection and discover device information without creating the device.'
    })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['ipAddress', 'port', 'username', 'password'],
            properties: {
                ipAddress: { type: 'string', description: 'Device IP address' },
                port: { type: 'number', description: 'Device port' },
                username: { type: 'string', description: 'Device username' },
                password: { type: 'string', description: 'Device password' },
                protocol: { type: 'string', description: 'Protocol (HTTP/HTTPS)', default: 'HTTP' },
            }
        }
    })
    @ApiResponse({
        status: 200,
        description: 'Device information discovered successfully.',
        type: DeviceAutoDiscoveryResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid connection details.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async discoverDeviceInfo(
        @Body() connectionDetails: DeviceDiscoveryTestDto
    ): Promise<DeviceAutoDiscoveryResponseDto> {
        const discoveredInfo = await this.deviceService.discoverDeviceInfo(connectionDetails);

        return {
            connected: discoveredInfo.status !== 'UNKNOWN',
            manufacturer: discoveredInfo.manufacturer,
            model: discoveredInfo.model,
            firmware: discoveredInfo.firmware,
            macAddress: discoveredInfo.macAddress,
            deviceIdentifier: discoveredInfo.deviceIdentifier,
            capabilities: discoveredInfo.capabilities,
            status: discoveredInfo.status,
            discoveredAt: new Date(),
        };
    }

    @Get()
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
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
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
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
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get the total number of devices' })
    @ApiResponse({ status: 200, description: 'The total number of devices.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getDeviceCount(@Scope() scope: DataScope): Promise<{ count: number }> {
        const count = await this.deviceService.getDeviceCount(scope);
        return { count };
    }

    @Get('discover')
    @Permissions(PERMISSIONS.DEVICE.CREATE)
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
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
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
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
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
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
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
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
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
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get statistics for a specific device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 200, description: 'The device statistics.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async getDeviceWithStats(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.getDeviceWithStats(id, scope);
    }

    @Get(':id/health')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get the health status of a specific device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 200, description: 'The device health status.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async getDeviceHealth(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.getDeviceHealth(id, scope);
    }

    @Post(':id/test-connection')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Test the connection to a device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 200, description: 'Connection test result.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async testDeviceConnection(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.testDeviceConnection(id, scope);
    }

    @Post(':id/command')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
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
    @Permissions(PERMISSIONS.DEVICE.UPDATE_MANAGED)
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
    @Permissions(PERMISSIONS.DEVICE.UPDATE_MANAGED)
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

    @Post(':id/control')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Control device actions (open door, reboot, etc.)' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiBody({ type: DeviceControlDto })
    @ApiResponse({ status: 200, description: 'Device control result.' })
    @ApiResponse({ status: 400, description: 'Invalid control action.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async controlDevice(
        @Param('id') id: string,
        @Body() controlDto: DeviceControlDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.controlDevice(
            id,
            {
                action: controlDto.action,
                parameters: controlDto.parameters,
                timeout: controlDto.timeout,
            },
            scope,
            user.sub
        );
    }

    @Post(':id/sync-employees')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Sync employees to device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiBody({ type: DeviceSyncEmployeesDto })
    @ApiResponse({ status: 200, description: 'Employee sync result.' })
    @ApiResponse({ status: 400, description: 'Invalid sync parameters.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async syncEmployees(
        @Param('id') id: string,
        @Body() syncDto: DeviceSyncEmployeesDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.syncEmployeesToDevice(
            id,
            {
                employeeIds: syncDto.employeeIds,
                departmentId: syncDto.departmentId,
                branchId: syncDto.branchId,
                forceSync: syncDto.forceSync,
                removeMissing: syncDto.removeMissing,
            },
            scope,
            user.sub
        );
    }

    @Get(':id/sync-status')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get employee sync status for device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 200, description: 'Employee sync status.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async getSyncStatus(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.getEmployeeSyncStatus(id, scope);
    }

    @Post(':id/retry-failed-syncs')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Retry failed employee syncs for device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 200, description: 'Retry sync result.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async retryFailedSyncs(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.retryFailedSyncs(id, scope, user.sub);
    }

    @Get(':id/configuration')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get device configuration' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 200, description: 'Device configuration.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async getDeviceConfiguration(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.getDeviceConfiguration(id, scope);
    }

    @Post(':id/configuration')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Create device configuration' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 201, description: 'Device configuration created.' })
    @ApiResponse({ status: 400, description: 'Invalid configuration.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async createDeviceConfiguration(
        @Param('id') id: string,
        @Body() configData: any,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.createDeviceConfiguration(id, configData, scope, user.sub);
    }

    @Patch(':id/configuration')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Update device configuration' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 200, description: 'Device configuration updated.' })
    @ApiResponse({ status: 400, description: 'Invalid configuration.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async updateDeviceConfiguration(
        @Param('id') id: string,
        @Body() configData: any,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.updateDeviceConfiguration(id, configData, scope, user.sub);
    }

    @Delete(':id/configuration')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Delete device configuration' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 204, description: 'Device configuration deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device not found.' })
    async deleteDeviceConfiguration(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        await this.deviceService.deleteDeviceConfiguration(id, scope, user.sub);
    }

    @Delete(':id')
    @Permissions(PERMISSIONS.DEVICE.UPDATE_MANAGED)
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

    // Device Template Endpoints
    @Post('templates')
    @Permissions(PERMISSIONS.DEVICE.CREATE)
    @ApiOperation({ summary: 'Create a device template' })
    @ApiBody({ type: CreateDeviceTemplateDto })
    @ApiResponse({ status: 201, description: 'Device template created.' })
    @ApiResponse({ status: 400, description: 'Invalid template data.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async createTemplate(
        @Body() templateData: CreateDeviceTemplateDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.createDeviceTemplate(templateData, scope, user.sub);
    }

    @Get('templates')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get all device templates' })
    @ApiResponse({ status: 200, description: 'List of device templates.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async getTemplates(@Scope() scope: DataScope) {
        return this.deviceService.getDeviceTemplates(scope);
    }

    @Get('templates/:id')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get a specific device template' })
    @ApiParam({ name: 'id', description: 'ID of the template' })
    @ApiResponse({ status: 200, description: 'Device template details.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Template not found.' })
    async getTemplateById(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.getDeviceTemplateById(id, scope);
    }

    @Patch('templates/:id')
    @Permissions(PERMISSIONS.DEVICE.UPDATE_MANAGED)
    @ApiOperation({ summary: 'Update a device template' })
    @ApiParam({ name: 'id', description: 'ID of the template' })
    @ApiBody({ type: UpdateDeviceTemplateDto })
    @ApiResponse({ status: 200, description: 'Device template updated.' })
    @ApiResponse({ status: 400, description: 'Invalid template data.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Template not found.' })
    async updateTemplate(
        @Param('id') id: string,
        @Body() templateData: UpdateDeviceTemplateDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.updateDeviceTemplate(id, templateData, scope, user.sub);
    }

    @Delete('templates/:id')
    @Permissions(PERMISSIONS.DEVICE.UPDATE_MANAGED)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a device template' })
    @ApiParam({ name: 'id', description: 'ID of the template' })
    @ApiResponse({ status: 204, description: 'Device template deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Template not found.' })
    async deleteTemplate(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.deviceService.deleteDeviceTemplate(id, scope, user.sub);
    }

    @Post(':id/apply-template/:templateId')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Apply a template to a device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiParam({ name: 'templateId', description: 'ID of the template' })
    @ApiResponse({ status: 200, description: 'Template applied to device.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiResponse({ status: 404, description: 'Device or template not found.' })
    async applyTemplateToDevice(
        @Param('id') id: string,
        @Param('templateId') templateId: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.applyTemplateToDevice(templateId, id, scope, user.sub);
    }
}
