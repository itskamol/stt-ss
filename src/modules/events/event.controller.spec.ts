import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { LoggerService } from '../../core/logger/logger.service';
import { CreateRawEventDto } from '../../shared/dto';

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
        }).compile();

        controller = module.get<EventController>(EventController);
        eventService = module.get(EventService);
        loggerService = module.get(LoggerService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('processRawEvent', () => {
        const mockEventDto: CreateRawEventDto = {
            eventType: 'access_attempt',
            timestamp: new Date().toISOString(),
            cardId: 'CARD-123',
            additionalData: { location: 'main_entrance' },
        };

        it('should process raw event successfully', async () => {
            const deviceId = 'device-123';
            const signature = 'dev-mock-signature';
            const idempotencyKey = 'unique-key-123';
            const eventId = 'event-456';

            eventService.processRawEvent.mockResolvedValue(eventId);

            const result = await controller.processRawEvent(
                mockEventDto,
                deviceId,
                signature,
                idempotencyKey
            );

            expect(eventService.processRawEvent).toHaveBeenCalledWith(
                mockEventDto,
                deviceId,
                signature,
                idempotencyKey
            );

            expect(result).toEqual({
                eventId,
                status: 'accepted',
                message: 'Event queued for processing',
            });

            expect(loggerService.log).toHaveBeenCalledWith(
                'Raw event processed successfully',
                expect.objectContaining({
                    eventId,
                    deviceId,
                    eventType: mockEventDto.eventType,
                    idempotencyKey,
                })
            );
        });

        it('should generate idempotency key if not provided', async () => {
            const deviceId = 'device-123';
            const signature = 'dev-mock-signature';
            const eventId = 'event-456';

            eventService.processRawEvent.mockResolvedValue(eventId);

            const result = await controller.processRawEvent(mockEventDto, deviceId, signature);

            expect(eventService.processRawEvent).toHaveBeenCalledWith(
                mockEventDto,
                deviceId,
                signature,
                expect.stringContaining(deviceId)
            );

            expect(result.eventId).toBe(eventId);
        });

        it('should throw BadRequestException when device ID is missing', async () => {
            const signature = 'dev-mock-signature';

            await expect(controller.processRawEvent(mockEventDto, '', signature)).rejects.toThrow(
                BadRequestException
            );
        });

        it('should throw UnauthorizedException when signature is missing', async () => {
            const deviceId = 'device-123';

            await expect(controller.processRawEvent(mockEventDto, deviceId, '')).rejects.toThrow(
                UnauthorizedException
            );
        });

        it('should handle duplicate events', async () => {
            const deviceId = 'device-123';
            const signature = 'dev-mock-signature';
            const idempotencyKey = 'duplicate-key';
            const existingEventId = 'existing-event-123';

            const duplicateError = new Error('DUPLICATE_EVENT');
            (duplicateError as any).existingEventId = existingEventId;
            eventService.processRawEvent.mockRejectedValue(duplicateError);

            const result = await controller.processRawEvent(
                mockEventDto,
                deviceId,
                signature,
                idempotencyKey
            );

            expect(result).toEqual({
                eventId: existingEventId,
                status: 'duplicate',
                message: 'Event already processed',
            });
        });

        it('should handle processing errors', async () => {
            const deviceId = 'device-123';
            const signature = 'dev-mock-signature';
            const idempotencyKey = 'error-key';

            const processingError = new Error('Processing failed');
            eventService.processRawEvent.mockRejectedValue(processingError);

            await expect(
                controller.processRawEvent(mockEventDto, deviceId, signature, idempotencyKey)
            ).rejects.toThrow('Processing failed');

            expect(loggerService.error).toHaveBeenCalledWith(
                'Failed to process raw event',
                processingError,
                expect.objectContaining({
                    deviceId,
                    eventType: mockEventDto.eventType,
                    idempotencyKey,
                })
            );
        });
    });

    describe('generateIdempotencyKey', () => {
        it('should generate consistent idempotency keys', () => {
            const deviceId = 'device-123';
            const eventData: CreateRawEventDto = {
                eventType: 'access_attempt',
                timestamp: '2023-01-01T12:00:00Z',
                cardId: 'CARD-123',
            };

            // Access private method for testing
            const key1 = (controller as any).generateIdempotencyKey(deviceId, eventData);
            const key2 = (controller as any).generateIdempotencyKey(deviceId, eventData);

            expect(key1).toBe(key2);
            expect(key1).toContain(deviceId);
            expect(key1).toContain('2023-01-01T12:00:00Z');
        });

        it('should generate different keys for different data', () => {
            const deviceId = 'device-123';
            const eventData1: CreateRawEventDto = {
                eventType: 'access_attempt',
                cardId: 'CARD-123',
            };
            const eventData2: CreateRawEventDto = {
                eventType: 'access_attempt',
                cardId: 'CARD-456',
            };

            const key1 = (controller as any).generateIdempotencyKey(deviceId, eventData1);
            const key2 = (controller as any).generateIdempotencyKey(deviceId, eventData2);

            expect(key1).not.toBe(key2);
        });
    });
});
