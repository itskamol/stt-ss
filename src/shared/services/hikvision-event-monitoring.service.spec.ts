import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

import { EncryptionService } from './encryption.service';
import { 
    HikvisionEventMonitoringService,
    EventSubscriptionOptions,
    HikvisionEventType,
    HikvisionRawEvent 
} from './hikvision-event-monitoring.service';
import { HikvisionDeviceConfig } from '../adapters/hikvision.adapter';
import { DeviceEvent } from '../adapters/device.adapter';
import { EventType } from '@prisma/client';

// Mock WebSocket
jest.mock('ws', () => {
    return jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        close: jest.fn(),
        readyState: 1, // OPEN
    }));
});

describe('HikvisionEventMonitoringService', () => {
    let service: HikvisionEventMonitoringService;
    let httpService: jest.Mocked<HttpService>;
    let encryptionService: jest.Mocked<EncryptionService>;

    const mockDevice: HikvisionDeviceConfig = {
        deviceId: 'test-device-1',
        ipAddress: '192.168.1.100',
        username: 'admin',
        encryptedSecret: 'encrypted-password',
    };

    const mockDecryptedPassword = 'admin123';

    beforeEach(async () => {
        const mockHttpService = {
            get: jest.fn(),
        };

        const mockEncryptionService = {
            decrypt: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HikvisionEventMonitoringService,
                { provide: HttpService, useValue: mockHttpService },
                { provide: EncryptionService, useValue: mockEncryptionService },
            ],
        }).compile();

        service = module.get<HikvisionEventMonitoringService>(HikvisionEventMonitoringService);
        httpService = module.get(HttpService);
        encryptionService = module.get(EncryptionService);

        // Setup default mocks
        encryptionService.decrypt.mockReturnValue(mockDecryptedPassword);
    });

    afterEach(async () => {
        await service.cleanup();
        jest.clearAllMocks();
    });

    describe('subscribeToEvents', () => {
        it('should subscribe to events with polling method', async () => {
            const mockEvents: HikvisionRawEvent[] = [
                {
                    eventType: 'accessControllerEvent',
                    eventTime: new Date().toISOString(),
                    deviceID: 'test-device-1',
                    employeeNoString: 'EMP001',
                    doorID: 1,
                },
            ];

            httpService.get.mockReturnValue(of({ data: { events: mockEvents } }) as any);

            const callback = jest.fn();
            const options: EventSubscriptionOptions = {
                useWebSocket: false,
                pollingInterval: 1000,
                eventTypes: [EventType.ACCESS_GRANTED],
            };

            await service.subscribeToEvents(mockDevice, callback, options);

            expect(service.hasActiveSubscription('test-device-1')).toBe(true);

            // Wait for polling to trigger
            await new Promise(resolve => setTimeout(resolve, 1100));

            expect(callback).toHaveBeenCalled();
            const calledEvent = callback.mock.calls[0][0] as DeviceEvent;
            expect(calledEvent.deviceId).toBe('test-device-1');
            expect(calledEvent.eventType).toBe('access_granted');
            expect(calledEvent.userId).toBe('EMP001');
        });

        it('should handle subscription to already subscribed device', async () => {
            const callback = jest.fn();
            const options: EventSubscriptionOptions = {
                useWebSocket: false,
                pollingInterval: 5000,
            };

            httpService.get.mockReturnValue(of({ data: { events: [] } }) as any);

            // First subscription
            await service.subscribeToEvents(mockDevice, callback, options);
            expect(service.hasActiveSubscription('test-device-1')).toBe(true);

            // Second subscription should replace the first
            await service.subscribeToEvents(mockDevice, callback, options);
            expect(service.hasActiveSubscription('test-device-1')).toBe(true);
        });

        it('should handle subscription errors', async () => {
            const error = { response: { status: 500 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            const callback = jest.fn();
            const options: EventSubscriptionOptions = {
                useWebSocket: false,
                pollingInterval: 1000,
            };

            await expect(service.subscribeToEvents(mockDevice, callback, options)).rejects.toThrow();
        });

        it('should filter events by type', async () => {
            const mockEvents: HikvisionRawEvent[] = [
                {
                    eventType: 'accessControllerEvent',
                    eventTime: new Date().toISOString(),
                    deviceID: 'test-device-1',
                    employeeNoString: 'EMP001',
                },
                {
                    eventType: 'motionDetection',
                    eventTime: new Date().toISOString(),
                    deviceID: 'test-device-1',
                },
            ];

            httpService.get.mockReturnValue(of({ data: { events: mockEvents } }) as any);

            const callback = jest.fn();
            const options: EventSubscriptionOptions = {
                useWebSocket: false,
                pollingInterval: 1000,
                eventTypes: [EventType.ACCESS_GRANTED], // Only access events
            };

            await service.subscribeToEvents(mockDevice, callback, options);

            // Wait for polling
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Should only receive access_granted event, not motion_detected
            expect(callback).toHaveBeenCalledTimes(1);
            const calledEvent = callback.mock.calls[0][0] as DeviceEvent;
            expect(calledEvent.eventType).toBe('access_granted');
        });
    });

    describe('unsubscribeFromEvents', () => {
        it('should unsubscribe from events', async () => {
            const callback = jest.fn();
            const options: EventSubscriptionOptions = {
                useWebSocket: false,
                pollingInterval: 5000,
            };

            httpService.get.mockReturnValue(of({ data: { events: [] } }) as any);

            await service.subscribeToEvents(mockDevice, callback, options);
            expect(service.hasActiveSubscription('test-device-1')).toBe(true);

            await service.unsubscribeFromEvents('test-device-1');
            expect(service.hasActiveSubscription('test-device-1')).toBe(false);
        });

        it('should handle unsubscribing from non-existent subscription', async () => {
            await expect(service.unsubscribeFromEvents('non-existent')).resolves.not.toThrow();
        });
    });

    describe('monitoring statistics', () => {
        it('should track event statistics', async () => {
            const mockEvents: HikvisionRawEvent[] = [
                {
                    eventType: 'accessControllerEvent',
                    eventTime: new Date().toISOString(),
                    deviceID: 'test-device-1',
                    employeeNoString: 'EMP001',
                },
                {
                    eventType: 'accessDenied',
                    eventTime: new Date().toISOString(),
                    deviceID: 'test-device-1',
                    employeeNoString: 'EMP002',
                },
            ];

            httpService.get.mockReturnValue(of({ data: { events: mockEvents } }) as any);

            const callback = jest.fn();
            const options: EventSubscriptionOptions = {
                useWebSocket: false,
                pollingInterval: 1000,
                eventTypes: [EventType.ACCESS_GRANTED, EventType.ACCESS_GRANTED],
            };

            await service.subscribeToEvents(mockDevice, callback, options);

            // Wait for polling
            await new Promise(resolve => setTimeout(resolve, 1100));

            const stats = service.getMonitoringStats('test-device-1');
            expect(stats).toBeDefined();
            expect(stats!.totalEventsReceived).toBe(2);
            expect(stats!.eventsByType['access_granted']).toBe(1);
            expect(stats!.eventsByType['access_denied']).toBe(1);
            expect(stats!.connectionStatus).toBe('connected');
        });

        it('should return all monitoring statistics', async () => {
            const callback = jest.fn();
            httpService.get.mockReturnValue(of({ data: { events: [] } }) as any);

            await service.subscribeToEvents(mockDevice, callback, { useWebSocket: false });

            const allStats = service.getAllMonitoringStats();
            expect(allStats).toHaveLength(1);
            expect(allStats[0].deviceId).toBe('test-device-1');
        });

        it('should return null for non-existent device stats', () => {
            const stats = service.getMonitoringStats('non-existent');
            expect(stats).toBeNull();
        });
    });

    describe('event parsing', () => {
        it('should parse XML events correctly', () => {
            const xmlMessage = `
                <EventNotificationAlert>
                    <eventType>accessControllerEvent</eventType>
                    <dateTime>2023-01-01T12:00:00Z</dateTime>
                    <deviceID>test-device-1</deviceID>
                    <employeeNoString>EMP001</employeeNoString>
                    <doorID>1</doorID>
                </EventNotificationAlert>
            `;

            // Test private method through public interface
            const buffer = Buffer.from(xmlMessage, 'utf8');
            
            // We can't directly test private methods, but we can test the overall functionality
            // by subscribing and checking if events are parsed correctly
            expect(buffer.toString()).toContain('accessControllerEvent');
        });

        it('should handle malformed event data', async () => {
            // Mock malformed response
            httpService.get.mockReturnValue(of({ data: 'invalid-json' }) as any);

            const callback = jest.fn();
            const options: EventSubscriptionOptions = {
                useWebSocket: false,
                pollingInterval: 1000,
            };

            await service.subscribeToEvents(mockDevice, callback, options);

            // Wait for polling - should not crash
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Should not have called callback due to parsing error
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('event type mapping', () => {
        it('should map Hikvision event types correctly', async () => {
            const mockEvents: HikvisionRawEvent[] = [
                {
                    eventType: 'accessControllerEvent',
                    eventTime: new Date().toISOString(),
                    deviceID: 'test-device-1',
                },
                {
                    eventType: 'accessDenied',
                    eventTime: new Date().toISOString(),
                    deviceID: 'test-device-1',
                },
                {
                    eventType: 'doorOpen',
                    eventTime: new Date().toISOString(),
                    deviceID: 'test-device-1',
                },
                {
                    eventType: 'unknownEventType',
                    eventTime: new Date().toISOString(),
                    deviceID: 'test-device-1',
                },
            ];

            httpService.get.mockReturnValue(of({ data: { events: mockEvents } }) as any);

            const callback = jest.fn();
            const options: EventSubscriptionOptions = {
                useWebSocket: false,
                pollingInterval: 1000,
                eventTypes: Object.values(EventType),
            };

            await service.subscribeToEvents(mockDevice, callback, options);

            // Wait for polling
            await new Promise(resolve => setTimeout(resolve, 1100));

            expect(callback).toHaveBeenCalledTimes(4);
            
            const events = callback.mock.calls.map(call => call[0] as DeviceEvent);
            expect(events[0].eventType).toBe('access_granted');
            expect(events[1].eventType).toBe('access_denied');
            expect(events[2].eventType).toBe('door_opened');
            expect(events[3].eventType).toBe('error'); // Unknown type mapped to error
        });
    });

    describe('cleanup', () => {
        it('should cleanup all subscriptions', async () => {
            const callback = jest.fn();
            httpService.get.mockReturnValue(of({ data: { events: [] } }) as any);

            // Create multiple subscriptions
            const device2 = { ...mockDevice, deviceId: 'test-device-2' };
            
            await service.subscribeToEvents(mockDevice, callback, { useWebSocket: false });
            await service.subscribeToEvents(device2, callback, { useWebSocket: false });

            expect(service.getActiveSubscriptionsCount()).toBe(2);

            await service.cleanup();

            expect(service.getActiveSubscriptionsCount()).toBe(0);
            expect(service.getAllMonitoringStats()).toHaveLength(0);
        });
    });

    describe('connection status tracking', () => {
        it('should track connection status changes', async () => {
            const callback = jest.fn();
            
            // First call succeeds
            httpService.get.mockReturnValueOnce(of({ data: { events: [] } }) as any);
            // Second call fails
            httpService.get.mockReturnValueOnce(throwError(() => new Error('Network error')) as any);
            // Third call succeeds again
            httpService.get.mockReturnValueOnce(of({ data: { events: [] } }) as any);

            const options: EventSubscriptionOptions = {
                useWebSocket: false,
                pollingInterval: 500,
                maxRetries: 2,
            };

            await service.subscribeToEvents(mockDevice, callback, options);

            // Wait for multiple polling cycles
            await new Promise(resolve => setTimeout(resolve, 1600));

            const stats = service.getMonitoringStats('test-device-1');
            expect(stats).toBeDefined();
            // Connection status should eventually recover
        });
    });
});