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
    ApiExtraModels,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
    getSchemaPath,
} from '@nestjs/swagger';
import { DeviceService } from './device.service';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
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
    PaginationDto,
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
import { ApiOkResponseData, ApiOkResponsePaginated } from '@/shared/utils';
import { Device, DeviceTemplate } from '@prisma/client';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('devices')
@ApiExtraModels(ApiSuccessResponse, DeviceResponseDto, DeviceStatsResponseDto, DeviceHealthResponseDto, TestConnectionResponseDto, CommandResponseDto, SyncStatusResponseDto, RetrySyncResponseDto, DeviceConfigurationResponseDto, WebhookConfigurationResponseDto, DeviceCountResponseDto)
export class DeviceController {
    constructor(private readonly deviceService: DeviceService) {}

    @Post()
    @Permissions(PERMISSIONS.DEVICE.CREATE)
    @ApiOperation({ summary: 'Create a new device' })
    @ApiBody({ type: CreateDeviceDto })
    @ApiResponse({
        status: 201,
        description: 'The device has been successfully created.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(DeviceResponseDto) },
                    },
                },
            ],
        }
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async createDevice(
        @Body() createDeviceDto: CreateDeviceDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Device> {
        return this.deviceService.createDevice(createDeviceDto, scope, user.sub);
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
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(DeviceResponseDto) },
                    },
                },
            ],
        }
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input or device not reachable.',
        type: ApiErrorResponse,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async createDeviceWithSimplifiedInfo(
        @Body() simplifiedInfo: SimplifiedDeviceCreationDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Device> {
        return this.deviceService.createDeviceWithSimplifiedInfo(
            simplifiedInfo,
            scope,
            user.sub
        );
    }

    @Get()
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get all devices with pagination' })
    @ApiQuery({ name: 'paginationDto', type: PaginationDto })
    @ApiOkResponsePaginated(DeviceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getDevices(
        @Scope() scope: DataScope,
        @Query() paginationDto: PaginationDto
    ) {
        return this.deviceService.getDevices(scope, paginationDto);
    }

    @Get('search')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Search for devices' })
    @ApiQuery({ name: 'q', description: 'Search term (at least 2 characters)' })
    @ApiOkResponsePaginated(DeviceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async searchDevices(
        @Query('q') searchTerm: string,
        @Scope() scope: DataScope
    ): Promise<Device[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return [];
        }
        return this.deviceService.searchDevices(searchTerm.trim(), scope);
    }

    @Get('count')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get the total number of devices' })
    @ApiOkResponseData(DeviceCountResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getDeviceCount(@Scope() scope: DataScope): Promise<{ count: number }> {
        const count = await this.deviceService.getDeviceCount(scope);
        return { count };
    }

    @Get('branch/:branchId')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get all devices for a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiOkResponsePaginated(DeviceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ApiErrorResponse })
    async getDevicesByBranch(
        @Param('branchId') branchId: string,
        @Scope() scope: DataScope
    ): Promise<Device[]> {
        return this.deviceService.getDevicesByBranch(branchId, scope);
    }

    @Get('branch/:branchId/count')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get the number of devices in a specific branch' })
    @ApiParam({ name: 'branchId', description: 'ID of the branch' })
    @ApiOkResponseData(DeviceCountResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Branch not found.', type: ApiErrorResponse })
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
    @ApiOkResponseData(DeviceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async getDeviceByIdentifier(
        @Param('identifier') identifier: string,
        @Scope() scope: DataScope
    ): Promise<Device> {
        return this.deviceService.getDeviceByIdentifier(identifier, scope);
    }

    @Get(':id')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get a specific device by ID' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiOkResponseData(DeviceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async getDeviceById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<Device> {
        return this.deviceService.getDeviceById(id, scope);
    }

    @Get(':id/stats')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get statistics for a specific device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiOkResponseData(DeviceStatsResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async getDeviceWithStats(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.getDeviceWithStats(id, scope);
    }

    @Get(':id/health')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get the health status of a specific device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiOkResponseData(DeviceHealthResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
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
    @ApiOkResponseData(TestConnectionResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
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
    @ApiOkResponseData(CommandResponseDto)
    @ApiResponse({ status: 400, description: 'Invalid command.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
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
    @ApiOkResponseData(DeviceResponseDto)
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async updateDevice(
        @Param('id') id: string,
        @Body() updateDeviceDto: UpdateDeviceDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Device> {
        return this.deviceService.updateDevice(id, updateDeviceDto, scope, user.sub);
    }

    @Patch(':id/status')
    @Permissions(PERMISSIONS.DEVICE.UPDATE_MANAGED)
    @ApiOperation({ summary: 'Toggle the active status of a device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiBody({
        schema: { type: 'object', properties: { isActive: { type: 'boolean' } } },
    })
    @ApiOkResponseData(DeviceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async toggleDeviceStatus(
        @Param('id') id: string,
        @Body('isActive') isActive: boolean,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Device> {
        return this.deviceService.toggleDeviceStatus(id, isActive, scope, user.sub);
    }

    @Post(':id/control')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Control device actions (open door, reboot, etc.)' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiBody({ type: DeviceControlDto })
    @ApiOkResponseData(CommandResponseDto)
    @ApiResponse({ status: 400, description: 'Invalid control action.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
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
    @ApiOkResponseData(SyncStatusResponseDto)
    @ApiResponse({ status: 400, description: 'Invalid sync parameters.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
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
    @ApiOkResponseData(SyncStatusResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async getSyncStatus(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<SyncStatusResponseDto> {
        const status = await this.deviceService.getEmployeeSyncStatus(id, scope);
        return {
            status: 'COMPLETED',
            ...status
        } as SyncStatusResponseDto;
    }

    @Post(':id/retry-failed-syncs')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Retry failed employee syncs for device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiOkResponseData(RetrySyncResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async retryFailedSyncs(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<RetrySyncResponseDto> {
        const result = await this.deviceService.retryFailedSyncs(id, scope, user.sub);
        return {
            success: true,
            message: 'Retried failed syncs',
            ...result,
        };
    }

    @Get(':id/configuration')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get device configuration' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiOkResponseData(DeviceConfigurationResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
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
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(DeviceConfigurationResponseDto) },
                    },
                },
            ],
        }
    })
    @ApiResponse({ status: 400, description: 'Invalid configuration.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
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
    @ApiOkResponseData(DeviceConfigurationResponseDto)
    @ApiResponse({ status: 400, description: 'Invalid configuration.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
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
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
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
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
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
    @ApiResponse({
        status: 201,
        description: 'Device template created.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(UpdateDeviceTemplateDto) },
                    },
                },
            ],
        }
    })
    @ApiResponse({ status: 400, description: 'Invalid template data.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async createTemplate(
        @Body() templateData: CreateDeviceTemplateDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceTemplate> {
        return this.deviceService.createDeviceTemplate(templateData, scope, user.sub);
    }

    @Get('templates')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get all device templates' })
    @ApiOkResponsePaginated(UpdateDeviceTemplateDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getTemplates(@Scope() scope: DataScope): Promise<DeviceTemplate[]> {
        return this.deviceService.getDeviceTemplates(scope);
    }

    @Get('templates/:id')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get a specific device template' })
    @ApiParam({ name: 'id', description: 'ID of the template' })
    @ApiOkResponseData(UpdateDeviceTemplateDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Template not found.', type: ApiErrorResponse })
    async getTemplateById(@Param('id') id: string, @Scope() scope: DataScope): Promise<DeviceTemplate> {
        return this.deviceService.getDeviceTemplateById(id, scope);
    }

    @Patch('templates/:id')
    @Permissions(PERMISSIONS.DEVICE.UPDATE_MANAGED)
    @ApiOperation({ summary: 'Update a device template' })
    @ApiParam({ name: 'id', description: 'ID of the template' })
    @ApiBody({ type: UpdateDeviceTemplateDto })
    @ApiOkResponseData(UpdateDeviceTemplateDto)
    @ApiResponse({ status: 400, description: 'Invalid template data.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Template not found.', type: ApiErrorResponse })
    async updateTemplate(
        @Param('id') id: string,
        @Body() templateData: UpdateDeviceTemplateDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceTemplate> {
        return this.deviceService.updateDeviceTemplate(id, templateData, scope, user.sub);
    }

    @Delete('templates/:id')
    @Permissions(PERMISSIONS.DEVICE.UPDATE_MANAGED)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a device template' })
    @ApiParam({ name: 'id', description: 'ID of the template' })
    @ApiResponse({ status: 204, description: 'Device template deleted.' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Template not found.', type: ApiErrorResponse })
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
    @ApiOkResponseData(DeviceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({
        status: 404,
        description: 'Device or template not found.',
        type: ApiErrorResponse,
    })
    async applyTemplateToDevice(
        @Param('id') id: string,
        @Param('templateId') templateId: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Device> {
        return this.deviceService.applyTemplateToDevice(templateId, id, scope, user.sub);
    }

    // Webhook Management Endpoints
    @Post(':id/webhook')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Configure webhook for device events' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiBody({ type: CreateWebhookDto })
    @ApiResponse({ status: 201, description: 'Webhook configured successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid webhook configuration.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
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
    @ApiOkResponseData(WebhookConfigurationResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
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
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
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
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async testWebhook(
        @Param('id') id: string,
        @Param('hostId') hostId: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.testWebhook(id, hostId, scope, user.sub);
    }
}
