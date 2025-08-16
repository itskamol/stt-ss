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
    CommandResponseDto,
    CreateDeviceDto,
    CreateDeviceTemplateDto,
    DeviceCommandDto,
    DeviceConfigurationResponseDto,
    DeviceControlDto,
    DeviceCountResponseDto,
    DeviceHealthResponseDto,
    DeviceResponseDto,
    DeviceStatsResponseDto,
    DeviceSyncEmployeesDto,
    ErrorResponseDto,
    PaginationDto,
    PaginationResponseDto,
    RetrySyncResponseDto,
    SimplifiedDeviceCreationDto,
    SyncStatusResponseDto,
    TestConnectionResponseDto,
    UpdateDeviceDto,
    UpdateDeviceTemplateDto,
} from '@/shared/dto';
import {
    CreateWebhookDto,
    WebhookConfigurationResponseDto,
} from '@/shared/dto/webhook.dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';
import { plainToClass } from 'class-transformer';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('devices')
export class DeviceController {
    constructor(private readonly deviceService: DeviceService) {}

    @Post()
    @Permissions(PERMISSIONS.DEVICE.CREATE)
    @ApiOperation({ summary: 'Create a new device' })
    @ApiBody({ type: CreateDeviceDto })
    @ApiResponse({
        status: 201,
        description: 'The device has been successfully created.',
        type: DeviceResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async createDevice(
        @Body() createDeviceDto: CreateDeviceDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto> {
        const device = await this.deviceService.createDevice(createDeviceDto, scope, user.sub);
        return plainToClass(DeviceResponseDto, device);
    }

  
  
    
    @Post('simplified')
    @Permissions(PERMISSIONS.DEVICE.CREATE)
    @ApiOperation({
        summary: 'Create device with simplified information',
        description: 'Create a device with minimal required fields. The system will automatically scan the device and populate its information.',
    })
    @ApiBody({ type: SimplifiedDeviceCreationDto })
    @ApiResponse({
        status: 201,
        description: 'The device has been successfully created with auto-discovered information.',
        type: DeviceResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input or device not reachable.',
        type: ErrorResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async createDeviceWithSimplifiedInfo(
        @Body() simplifiedInfo: SimplifiedDeviceCreationDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto> {
        const device = await this.deviceService.createDevice(
            simplifiedInfo,
            scope,
            user.sub,
            { preScan: true }
        );
        return plainToClass(DeviceResponseDto, device);
    }

    
    @Get()
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get all devices with pagination' })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiResponse({
        status: 200,
        description: 'A paginated list of devices.',
        type: PaginationResponseDto<DeviceResponseDto>,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
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

        const responseDevices = paginatedDevices.map(device =>
            plainToClass(DeviceResponseDto, device)
        );

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
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async searchDevices(
        @Query('q') searchTerm: string,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }

        const devices = await this.deviceService.searchDevices(searchTerm.trim(), scope);

        return devices.map(device => plainToClass(DeviceResponseDto, device));
    }

    @Get('count')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get the total number of devices' })
    @ApiResponse({
        status: 200,
        description: 'The total number of devices.',
        type: DeviceCountResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async getDeviceCount(@Scope() scope: DataScope): Promise<DeviceCountResponseDto> {
        const count = await this.deviceService.getDeviceCount(scope);
        return { count };
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
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ErrorResponseDto })
    async getDevicesByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto[]> {
        const devices = await this.deviceService.getDevicesByBranch(branchId, scope);
        return devices.map(device => plainToClass(DeviceResponseDto, device));
    }

    @Get('branch/:branchId/count')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get the number of devices in a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiResponse({
        status: 200,
        description: 'The number of devices in the branch.',
        type: DeviceCountResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ErrorResponseDto })
    async getDeviceCountByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<DeviceCountResponseDto> {
        const count = await this.deviceService.getDeviceCountByBranch(branchId, scope);
        return { count };
    }

    @Get('identifier/:identifier')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get a device by its unique identifier' })
    @ApiParam({ name: 'identifier', description: 'Unique identifier of the device' })
    @ApiResponse({ status: 200, description: 'The device details.', type: DeviceResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async getDeviceByIdentifier(
        @Param('identifier') identifier: string,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto> {
        const device = await this.deviceService.getDeviceBySerialNumber(identifier, scope);
        if (!device) {
            throw new Error('Device not found');
        }
        return plainToClass(DeviceResponseDto, device);
    }

    @Get(':id')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get a specific device by ID' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 200, description: 'The device details.', type: DeviceResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async getDeviceById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto> {
        const device = await this.deviceService.getDeviceById(id, scope);
        if (!device) {
            throw new Error('Device not found');
        }
        return plainToClass(DeviceResponseDto, device);
    }

    @Get(':id/stats')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get statistics for a specific device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({
        status: 200,
        description: 'The device statistics.',
        type: DeviceStatsResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async getDeviceWithStats(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<DeviceStatsResponseDto> {
        const deviceWithStats = await this.deviceService.getDeviceWithStats(id, scope);
        return plainToClass(DeviceStatsResponseDto, deviceWithStats);
    }

    @Get(':id/health')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get the health status of a specific device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({
        status: 200,
        description: 'The device health status.',
        type: DeviceHealthResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async getDeviceHealth(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<DeviceHealthResponseDto> {
        return this.deviceService.getDeviceHealth(id, scope);
    }

    @Post(':id/test-connection')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Test the connection to a device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({
        status: 200,
        description: 'Connection test result.',
        type: TestConnectionResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async testDeviceConnection(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<TestConnectionResponseDto> {
        return this.deviceService.testDeviceConnection(id, scope);
    }

    @Post(':id/command')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Send a command to a device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiBody({ type: DeviceCommandDto })
    @ApiResponse({
        status: 200,
        description: 'The result of the command.',
        type: CommandResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid command.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async sendDeviceCommand(
        @Param('id') id: string,
        @Body() commandDto: DeviceCommandDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<CommandResponseDto> {
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
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async updateDevice(
        @Param('id') id: string,
        @Body() updateDeviceDto: UpdateDeviceDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto> {
        const device = await this.deviceService.updateDevice(id, updateDeviceDto, scope, user.sub);
        return plainToClass(DeviceResponseDto, device);
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
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async toggleDeviceStatus(
        @Param('id') id: string,
        @Body('isActive') isActive: boolean,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceResponseDto> {
        const device = await this.deviceService.toggleDeviceStatus(id, isActive, scope, user.sub);
        return plainToClass(DeviceResponseDto, device);
    }

    @Post(':id/control')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Control device actions (open door, reboot, etc.)' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiBody({ type: DeviceControlDto })
    @ApiResponse({
        status: 200,
        description: 'Device control result.',
        type: CommandResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid control action.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async controlDevice(
        @Param('id') id: string,
        @Body() controlDto: DeviceControlDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<CommandResponseDto> {
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
    @ApiResponse({
        status: 200,
        description: 'Employee sync result.',
        type: SyncStatusResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid sync parameters.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async syncEmployees(
        @Param('id') id: string,
        @Body() syncDto: DeviceSyncEmployeesDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<SyncStatusResponseDto> {
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
    @ApiResponse({
        status: 200,
        description: 'Employee sync status.',
        type: SyncStatusResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async getSyncStatus(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<SyncStatusResponseDto> {
        const stats = await this.deviceService.getEmployeeSyncStatus(id, scope);
        return plainToClass(SyncStatusResponseDto, stats);
    }

    @Post(':id/retry-failed-syncs')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Retry failed employee syncs for device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({
        status: 200,
        description: 'Retry sync result.',
        type: RetrySyncResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async retryFailedSyncs(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<RetrySyncResponseDto> {
        const stats = await this.deviceService.retryFailedSyncs(id, scope, user.sub);
        return plainToClass(RetrySyncResponseDto, stats);
    }

    @Get(':id/configuration')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get device configuration' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({
        status: 200,
        description: 'Device configuration.',
        type: DeviceConfigurationResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async getDeviceConfiguration(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<DeviceConfigurationResponseDto> {
        return this.deviceService.getDeviceConfiguration(id, scope);
    }

    @Post(':id/configuration')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Create device configuration' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({
        status: 201,
        description: 'Device configuration created.',
        type: DeviceConfigurationResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid configuration.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async createDeviceConfiguration(
        @Param('id') id: string,
        @Body() configData: any,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceConfigurationResponseDto> {
        return this.deviceService.createDeviceConfiguration(id, configData, scope, user.sub);
    }

    @Patch(':id/configuration')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Update device configuration' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({
        status: 200,
        description: 'Device configuration updated.',
        type: DeviceConfigurationResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid configuration.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async updateDeviceConfiguration(
        @Param('id') id: string,
        @Body() configData: any,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceConfigurationResponseDto> {
        return this.deviceService.updateDeviceConfiguration(id, configData, scope, user.sub);
    }

    @Delete(':id/configuration')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Delete device configuration' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 204, description: 'Device configuration deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async deleteDeviceConfiguration(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.deviceService.deleteDeviceConfiguration(id, scope, user.sub);
    }

    @Delete(':id')
    @Permissions(PERMISSIONS.DEVICE.UPDATE_MANAGED)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a device' })
    @ApiParam({ name: 'id', description: 'ID of the device to delete' })
    @ApiResponse({ status: 204, description: 'The device has been successfully deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
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
    @ApiResponse({ status: 400, description: 'Invalid template data.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
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
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async getTemplates(@Scope() scope: DataScope) {
        return this.deviceService.getDeviceTemplates(scope);
    }

    @Get('templates/:id')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get a specific device template' })
    @ApiParam({ name: 'id', description: 'ID of the template' })
    @ApiResponse({ status: 200, description: 'Device template details.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Template not found.', type: ErrorResponseDto })
    async getTemplateById(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.getDeviceTemplateById(id, scope);
    }

    @Patch('templates/:id')
    @Permissions(PERMISSIONS.DEVICE.UPDATE_MANAGED)
    @ApiOperation({ summary: 'Update a device template' })
    @ApiParam({ name: 'id', description: 'ID of the template' })
    @ApiBody({ type: UpdateDeviceTemplateDto })
    @ApiResponse({ status: 200, description: 'Device template updated.' })
    @ApiResponse({ status: 400, description: 'Invalid template data.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Template not found.', type: ErrorResponseDto })
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
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Template not found.', type: ErrorResponseDto })
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
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({
        status: 404,
        description: 'Device or template not found.',
        type: ErrorResponseDto,
    })
    async applyTemplateToDevice(
        @Param('id') id: string,
        @Param('templateId') templateId: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.applyTemplateToDevice(templateId, id, scope, user.sub);
    }

    // Webhook Management Endpoints
    @Post(':id/webhook')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Configure webhook for device events' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiBody({ type: CreateWebhookDto })
    @ApiResponse({ status: 201, description: 'Webhook configured successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid webhook configuration.', type: ErrorResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async configureWebhook(
        @Param('id') id: string,
        @Body() webhookConfig: CreateWebhookDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.configureWebhook(id, webhookConfig, scope, user.sub);
    }

    @Get(':id/webhooks')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get webhook configurations for device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ 
        status: 200, 
        description: 'Webhook configurations retrieved.',
        type: WebhookConfigurationResponseDto
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async getWebhookConfiguration(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<WebhookConfigurationResponseDto> {
        return this.deviceService.getWebhookConfiguration(id, scope);
    }

    @Delete(':id/webhook/:hostId')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove webhook configuration' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiParam({ name: 'hostId', description: 'ID of the webhook host' })
    @ApiResponse({ status: 204, description: 'Webhook removed successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async removeWebhook(
        @Param('id') id: string,
        @Param('hostId') hostId: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<void> {
        await this.deviceService.removeWebhook(id, hostId, scope, user.sub);
    }

    @Post(':id/webhook/:hostId/test')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Test webhook configuration' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiParam({ name: 'hostId', description: 'ID of the webhook host' })
    @ApiResponse({ status: 200, description: 'Webhook test result.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ErrorResponseDto })
    async testWebhook(
        @Param('id') id: string,
        @Param('hostId') hostId: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.testWebhook(id, hostId, scope, user.sub);
    }
}
