import { Body, Controller, Headers, HttpCode, HttpStatus, Ip, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags, ApiResponse } from '@nestjs/swagger';
import { DeviceService } from './device.service';
import { Public } from '@/shared/decorators';
import { ApiErrorResponse, ApiSuccessResponse } from '@/shared/dto';

@ApiTags('Device Webhooks')
@Controller('webhook')
export class WebhookController {
    constructor(private readonly deviceService: DeviceService) {}

    @Post('device-events')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Receive device events via webhook' })
    @ApiBody({ description: 'Device event data' })
    @ApiResponse({ status: 200, description: 'Event received successfully.', type: ApiSuccessResponse })
    @ApiResponse({ status: 400, description: 'Bad request.', type: ApiErrorResponse })
    async handleDeviceEvent(
        @Body() eventData: any,
        @Headers() headers: any,
        @Ip() clientIp: string
    ) {
        return this.deviceService.handleWebhookEvent(eventData, clientIp);
    }

    @Post('device-events/:deviceId')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Receive device events for specific device' })
    @ApiParam({ name: 'deviceId', description: 'Device ID' })
    @ApiResponse({ status: 200, description: 'Event received successfully.', type: ApiSuccessResponse })
    @ApiResponse({ status: 400, description: 'Bad request.', type: ApiErrorResponse })
    async handleDeviceEventWithId(
        @Param('deviceId') deviceId: string,
        @Body() eventData: any,
        @Ip() clientIp: string
    ) {
        return this.deviceService.handleWebhookEvent(eventData, clientIp, deviceId);
    }
}
