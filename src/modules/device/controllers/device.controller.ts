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
    PaginationResponseDto,
    RetrySyncResponseDto,
    SimplifiedDeviceCreationDto,
    SyncStatusResponseDto,
    TestConnectionResponseDto,
    UpdateDeviceDto,
    UpdateDeviceTemplateDto,
} from '@/shared/dto';
import { CreateWebhookDto, WebhookConfigurationResponseDto } from '@/shared/dto/webhook.dto';
import { Permissions, Scope, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { DataScope, UserContext } from '@/shared/interfaces';
import { ApiOkResponseData, ApiOkResponsePaginated } from '@/shared/utils';
import { Device, DeviceConfiguration, DeviceTemplate } from '@prisma/client';
import { plainToClass } from 'class-transformer';
import { DeviceService } from '../services/device.service';
import { DeviceDiscoveryService } from '../services/device-discovery.service';
import { DeviceTemplateService } from '../services/device-template.service';
import { DeviceWebhookService } from '../services/device-webhook.service';
import { PaginationService } from '@/shared/services/pagination.service';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('devices')
@ApiExtraModels(
    ApiSuccessResponse,
    DeviceResponseDto,
    DeviceStatsResponseDto,
    DeviceHealthResponseDto,
    TestConnectionResponseDto,
    CommandResponseDto,
    SyncStatusResponseDto,
    RetrySyncResponseDto,
    DeviceConfigurationResponseDto,
    WebhookConfigurationResponseDto,
    DeviceCountResponseDto
)
export class DeviceController {
    constructor(
        private readonly deviceService: DeviceService,
        private readonly deviceDiscoveryService: DeviceDiscoveryService,
        private readonly deviceTemplateService: DeviceTemplateService,
        private readonly deviceWebhookService: DeviceWebhookService,
        private readonly paginationService: PaginationService
    ) {}

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
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async createDevice(
        @Body() createDeviceDto: CreateDeviceDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<Device> {
        return this.deviceService.createDevice(createDeviceDto, scope);
    }

    @Post('simplified')
    @Permissions(PERMISSIONS.DEVICE.CREATE)
    @ApiOperation({
        summary: 'Create device with simplified information',
        description:
            'Create a device with minimal required fields. The system will automatically scan the device and populate its information.',
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
        },
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
    ): Promise<DeviceResponseDto> {
        const device = await this.deviceDiscoveryService.scanDeviceForCreationInternal(
            simplifiedInfo,
            scope
        );
        const createdDevice = await this.deviceService.createDevice(device, scope);
        return plainToClass(DeviceResponseDto, createdDevice);
    }

    @Get()
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get all devices with pagination' })
    @ApiOkResponsePaginated(DeviceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getDevices(@Scope() scope: DataScope, @Query() paginationDto: PaginationDto) {
        const result = await this.deviceService.getDevices(paginationDto, scope);
        return this.paginationService.paginate<Device, DeviceResponseDto>(
            Promise.resolve(result.data),
            Promise.resolve(result.total),
            paginationDto.page,
            paginationDto.limit
        );
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
    @ApiOkResponseData(DeviceResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async getDeviceById(@Param('id') id: string, @Scope() scope: DataScope): Promise<Device> {
        return this.deviceService.getDeviceById(id, scope);
    }

    @Get(':id/stats')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get statistics for a specific device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiOkResponseData(DeviceStatsResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async getDeviceWithStats(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceService.getDeviceWithStats(id, scope);
    }

    @Get(':id/health')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get the health status of a specific device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiOkResponseData(DeviceHealthResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async getDeviceHealth(@Param('id') id: string, @Scope() scope: DataScope): Promise<any> {
        return this.deviceService.getDeviceHealth(id, scope);
    }

    @Post(':id/test-connection')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Test the connection to a device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiOkResponseData(TestConnectionResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async testDeviceConnection(@Param('id') id: string, @Scope() scope: DataScope): Promise<any> {
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
            scope
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
        return this.deviceService.updateDevice(id, updateDeviceDto, scope);
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
        return this.deviceService.toggleDeviceStatus(id, scope);
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
        return this.deviceService.controlDevice(id, controlDto, scope);
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
        return this.deviceService.syncEmployeesToDevice(id, syncDto, scope, user.sub);
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
        return plainToClass(SyncStatusResponseDto, {
            status: 'COMPLETED',
            ...status,
        });
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

    // ==================== CREDENTIAL SYNC ENDPOINTS ====================

    @Post(':id/sync-face-credentials')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Sync employees with face credentials to device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({
        status: 200,
        description: 'Face credentials sync completed successfully.',
        schema: {
            type: 'object',
            properties: {
                deviceId: { type: 'string' },
                deviceName: { type: 'string' },
                credentialType: { type: 'string', enum: ['FACE'] },
                totalEmployees: { type: 'number' },
                added: { type: 'number' },
                updated: { type: 'number' },
                failed: { type: 'number' },
                syncedAt: { type: 'string', format: 'date-time' },
                status: { type: 'string' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async syncFaceCredentials(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.syncEmployeesWithFaceCredentials(id, scope, user.sub);
    }

    @Get(':id/employees-with-credentials/:credentialType')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get employees with specific credential type for device' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiParam({ 
        name: 'credentialType', 
        description: 'Type of credential',
        enum: ['FACE', 'FINGERPRINT', 'CARD', 'CAR_NUMBER', 'PASSWORD_HASH', 'QR_CODE']
    })
    @ApiResponse({
        status: 200,
        description: 'List of employees with specified credential type.',
        schema: {
            type: 'object',
            properties: {
                deviceId: { type: 'string' },
                deviceName: { type: 'string' },
                credentialType: { type: 'string' },
                totalEmployees: { type: 'number' },
                employees: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            employeeCode: { type: 'string' },
                            firstName: { type: 'string' },
                            lastName: { type: 'string' },
                            email: { type: 'string' },
                            photoKey: { type: 'string' },
                            credentials: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        type: { type: 'string' },
                                        value: { type: 'string' },
                                        metadata: { type: 'object' },
                                        isActive: { type: 'boolean' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async getEmployeesWithCredentialType(
        @Param('id') id: string,
        @Param('credentialType') credentialType: string,
        @Scope() scope: DataScope
    ) {
        return this.deviceService.getEmployeesWithCredentialType(id, credentialType as any, scope);
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
        },
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
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid template data.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async createTemplate(
        @Body() templateData: CreateDeviceTemplateDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceTemplate> {
        return this.deviceTemplateService.createDeviceTemplate(templateData, scope);
    }

    @Get('templates')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get all device templates' })
    @ApiOkResponsePaginated(UpdateDeviceTemplateDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getTemplates(@Scope() scope: DataScope): Promise<DeviceTemplate[]> {
        return this.deviceTemplateService.getDeviceTemplates(scope);
    }

    @Get('templates/:id')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get a specific device template' })
    @ApiParam({ name: 'id', description: 'ID of the template' })
    @ApiOkResponseData(UpdateDeviceTemplateDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Template not found.', type: ApiErrorResponse })
    async getTemplateById(
        @Param('id') id: string,
        @Scope() scope: DataScope
    ): Promise<DeviceTemplate> {
        return this.deviceTemplateService.getDeviceTemplateById(id, scope);
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
        return this.deviceTemplateService.updateDeviceTemplate(id, templateData, scope);
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
        await this.deviceTemplateService.deleteDeviceTemplate(id, scope, user.sub);
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
    ): Promise<void> {
        await this.deviceTemplateService.applyTemplateToDevice(templateId, id, scope);
    }

    @Post(':id/auto-apply-template')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Auto-apply matching template to device based on manufacturer/model' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiOkResponseData(DeviceConfigurationResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async autoApplyTemplate(
        @Param('id') id: string,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ): Promise<DeviceConfiguration> {
        await this.deviceTemplateService.autoApplyTemplateToDevice(id, scope, user.sub);
        const device = await this.deviceService.getDeviceById(id, scope);
        return this.deviceService.getDeviceConfiguration(id, scope);
    }

    @Get(':id/suggested-templates')
    @Permissions(PERMISSIONS.DEVICE.READ_ALL)
    @ApiOperation({ summary: 'Get suggested templates for a device based on manufacturer/model' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async getSuggestedTemplates(@Param('id') id: string, @Scope() scope: DataScope) {
        return this.deviceTemplateService.getSuggestedTemplates(id, scope);
    }

    // Webhook Management Endpoints
    @Post(':id/webhook')
    @Permissions(PERMISSIONS.DEVICE.MANAGE_MANAGED)
    @ApiOperation({ summary: 'Configure webhook for device events' })
    @ApiParam({ name: 'id', description: 'ID of the device' })
    @ApiBody({ type: CreateWebhookDto })
    @ApiResponse({ status: 201, description: 'Webhook configured successfully.' })
    @ApiResponse({
        status: 400,
        description: 'Invalid webhook configuration.',
        type: ApiErrorResponse,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Device not found.', type: ApiErrorResponse })
    async configureWebhook(
        @Param('id') id: string,
        @Body() webhookConfig: CreateWebhookDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.deviceWebhookService.configureWebhook(id, webhookConfig, scope);
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
        const webhooks = await this.deviceWebhookService.getDeviceWebhooks(id, scope);
        return plainToClass(WebhookConfigurationResponseDto, {
            deviceId: id,
            webhooks: webhooks,
        });
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
        await this.deviceWebhookService.removeWebhook(id, hostId, scope, user.sub);
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
        return this.deviceWebhookService.testWebhook(id, hostId, scope, user.sub);
    }
}
