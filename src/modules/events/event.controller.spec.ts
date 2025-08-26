import { Test, TestingModule } from '@nestjs/testing';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { LoggerService } from '@/core/logger';
import { CreateRawEventDto } from '@/shared/dto';
import { UnauthorizedException } from '@nestjs/common';
import { DeviceAuthGuard } from '@/shared/guards/device-auth.guard';

describe('EventController', () => {
    let controller: EventController;
    let eventService: jest.Mocked<EventService>;
    let loggerService: jest.Mocked<LoggerService>;

    beforeEach(async () => {
        const mockEventService = {
            processRawEvent: jest.fn(),
        };

        const mockLoggerService = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [EventController],
            providers: [
                {
                    provide: EventService,
                    useValue: mockEventService,
                },
                {
                    provide: LoggerService,
                    useValue: mockLoggerService,
                },
            ],
        })
            .overrideGuard(DeviceAuthGuard)
            .useValue({ canActivate: () => true }) // Mock the guard
            .compile();

        controller = module.get<EventController>(EventController);
        eventService = module.get(EventService);
        loggerService = module.get(LoggerService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('processRawEvent', () => {
        const createRawEventDto: CreateRawEventDto = {
            eventType: 'CARD_SCAN' as any,
            timestamp: new Date().toISOString(),
            employeeId: 'emp-123',
        };
        const deviceId = 'device-123';
        const signature = 'valid-signature';
        const idempotencyKey = 'unique-key-123';

        it('should process raw event successfully', async () => {
            const eventId = 'event-456';
            eventService.processRawEvent.mockResolvedValue(eventId);

            const result = await controller.processRawEvent(
                createRawEventDto,
                deviceId,
            );

            expect(eventService.processRawEvent).toHaveBeenCalledWith(
                createRawEventDto,
                deviceId,
                signature,
                idempotencyKey
            );
            expect(result).toEqual({
                eventId,
                status: 'accepted',
                message: 'Event queued for processing',
            });
        });

        it('should handle duplicate events gracefully', async () => {
            const duplicateError = new Error('DUPLICATE_EVENT');
            (duplicateError as any).existingEventId = 'existing-event-789';
            eventService.processRawEvent.mockRejectedValue(duplicateError);

            const result = await controller.processRawEvent(
                createRawEventDto,
                deviceId,
            );

            expect(result).toEqual({
                eventId: 'existing-event-789',
                status: 'duplicate',
                message: 'Event already processed',
            });
        });

        it('should generate idempotency key if not provided', async () => {
            const eventId = 'event-456';
            eventService.processRawEvent.mockResolvedValue(eventId);

            await controller.processRawEvent(createRawEventDto, deviceId);

            expect(eventService.processRawEvent).toHaveBeenCalledWith(
                createRawEventDto,
                deviceId,
                signature,
                expect.any(String) // Check that a key was generated
            );
        });

        it('should throw UnauthorizedException for invalid signature', async () => {
            const authError = new UnauthorizedException('Device signature verification failed');
            eventService.processRawEvent.mockRejectedValue(authError);

            await expect(
                controller.processRawEvent(
                    createRawEventDto,
                    deviceId,
                )
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should re-throw other processing errors', async () => {
            const processingError = new Error('Processing failed');
            eventService.processRawEvent.mockRejectedValue(processingError);

            await expect(
                controller.processRawEvent(createRawEventDto, deviceId)
            ).rejects.toThrow('Processing failed');
        });
    });
});
