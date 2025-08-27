import * as crypto from 'crypto';
import {
    BadRequestException,
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    UnauthorizedException,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiConsumes,
    ApiExtraModels,
    ApiHeader,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
    getSchemaPath,
} from '@nestjs/swagger';
import { EventService } from './event.service';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
    CreateRawEventDto,
    ProcessedEventResponseDto,
} from '@/shared/dto';
import { Public } from '@/shared/decorators';
import { DeviceAuthGuard } from '@/shared/guards/device-auth.guard';
import { ApiOkResponseData } from '@/shared/utils';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Events')
@Controller('events')
@ApiExtraModels(ApiSuccessResponse, ProcessedEventResponseDto)
export class EventController {
    constructor(private readonly eventService: EventService) {}

    @Post('raw/:deviceId')
    @Public()
    @HttpCode(HttpStatus.ACCEPTED)
    // Swagger'ga bu endpoint multipart/form-data qabul qilishini aytish uchun:
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Process a raw event from a device' })
    @ApiParam({ name: 'deviceId', description: 'Unique ID of the device', required: true })
    // FileInterceptor'ni shu yerda ishlating
    // 'file' - bu form-data da fayl yuboriladigan maydon (key) nomi
    @UseInterceptors(FileInterceptor('Picture'))
    async processRawEvent(
        @UploadedFile() file: Express.Multer.File,
        @Body() createRawEventDto: any, // Masalan: CreateRawEventDto
        @Param('deviceId') deviceId: string
    ): Promise<void> {
        if (!deviceId) {
            throw new BadRequestException('Device ID header is required');
        }

        console.log('--- Device ID ---');
        console.log(deviceId);

        console.log('--- Body (boshqa ma`lumotlar) ---');
        console.log(createRawEventDto.event_log);

        // Bu yerda fayl va body ma'lumotlarini qayta ishlashingiz mumkin
        // Masalan:
        // const fileContent = file.buffer.toString('utf-8');
        // const someData = createRawEventDto.someField;
    }

    private generateIdempotencyKey(deviceId: string, eventData: CreateRawEventDto): string {
        const timestamp = eventData.timestamp || new Date().toISOString();
        const dataHash = this.hashEventData(eventData);
        return `${deviceId}-${timestamp}-${dataHash}`;
    }

    private hashEventData(eventData: CreateRawEventDto): string {
        const dataString = JSON.stringify({
            eventType: eventData.eventType,
            employeeId: eventData.employeeId,
            cardId: eventData.cardId,
            biometricData: eventData.biometricData,
        });
        return crypto.createHash('md5').update(dataString).digest('hex').substring(0, 8);
    }
}
