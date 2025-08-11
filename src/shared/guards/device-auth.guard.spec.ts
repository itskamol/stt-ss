import crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DeviceAuthGuard } from './device-auth.guard';
import { LoggerService } from '../../core/logger/logger.service';

describe('DeviceAuthGuard', () => {
    let guard: DeviceAuthGuard;
    let loggerService: jest.Mocked<LoggerService>;

    beforeEach(async () => {
        const mockLoggerService = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeviceAuthGuard,
                Reflector,
                {
                    provide: LoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        guard = module.get<DeviceAuthGuard>(DeviceAuthGuard);
        loggerService = module.get(LoggerService);
    });

    it('should be defined', () => {
        expect(guard).toBeDefined();
    });

    describe('canActivate', () => {
        const createMockContext = (headers: Record<string, string> = {}, body: any = {}) => {
            const mockRequest = {
                headers,
                body,
                ip: '127.0.0.1',
            };

            return {
                switchToHttp: () => ({
                    getRequest: () => mockRequest,
                }),
            } as ExecutionContext;
        };

        it('should allow access with valid device credentials', async () => {
            const context = createMockContext({
                'x-device-id': 'device-123',
                'x-device-signature': 'dev-mock-signature',
            });

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
            expect(loggerService.log).toHaveBeenCalledWith(
                'Device authenticated successfully',
                expect.objectContaining({
                    deviceId: 'device-123',
                })
            );
        });

        it('should throw UnauthorizedException when device ID is missing', async () => {
            const context = createMockContext({
                'x-device-signature': 'dev-mock-signature',
            });

            await expect(guard.canActivate(context)).rejects.toThrow(
                new UnauthorizedException('Device ID is required')
            );

            expect(loggerService.warn).toHaveBeenCalledWith(
                'Device authentication failed: Missing device ID',
                expect.any(Object)
            );
        });

        it('should throw UnauthorizedException when signature is missing', async () => {
            const context = createMockContext({
                'x-device-id': 'device-123',
            });

            await expect(guard.canActivate(context)).rejects.toThrow(
                new UnauthorizedException('Device signature is required')
            );

            expect(loggerService.warn).toHaveBeenCalledWith(
                'Device authentication failed: Missing signature',
                expect.objectContaining({
                    deviceId: 'device-123',
                })
            );
        });

        it('should validate timestamp and reject old requests', async () => {
            const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago

            const context = createMockContext({
                'x-device-id': 'device-123',
                'x-device-signature': 'dev-mock-signature',
                'x-timestamp': oldTimestamp,
            });

            await expect(guard.canActivate(context)).rejects.toThrow(
                new UnauthorizedException('Request timestamp is too old')
            );

            expect(loggerService.warn).toHaveBeenCalledWith(
                'Device authentication failed: Request too old',
                expect.objectContaining({
                    deviceId: 'device-123',
                    timestamp: oldTimestamp,
                })
            );
        });

        it('should accept recent timestamps', async () => {
            const recentTimestamp = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 minutes ago

            const context = createMockContext({
                'x-device-id': 'device-123',
                'x-device-signature': 'dev-mock-signature',
                'x-timestamp': recentTimestamp,
            });

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
        });

        it('should reject invalid signatures', async () => {
            const context = createMockContext({
                'x-device-id': 'device-123',
                'x-device-signature': 'invalid-signature',
            });

            await expect(guard.canActivate(context)).rejects.toThrow(
                new UnauthorizedException('Invalid device signature')
            );

            expect(loggerService.warn).toHaveBeenCalledWith(
                'Device authentication failed: Invalid signature',
                expect.objectContaining({
                    deviceId: 'device-123',
                })
            );
        });

        it('should accept development signatures', async () => {
            const context = createMockContext({
                'x-device-id': 'device-123',
                'x-device-signature': 'dev-test-signature',
            });

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
        });

        it('should add device info to request', async () => {
            const mockRequest = {
                headers: {
                    'x-device-id': 'device-123',
                    'x-device-signature': 'dev-mock-signature',
                    'x-timestamp': new Date().toISOString(),
                },
                body: {},
                ip: '127.0.0.1',
            };

            const context = {
                switchToHttp: () => ({
                    getRequest: () => mockRequest,
                }),
            } as ExecutionContext;

            await guard.canActivate(context);

            expect(mockRequest).toHaveProperty('device');
            expect((mockRequest as any).device).toEqual({
                id: 'device-123',
                signature: 'dev-mock-signature',
                timestamp: expect.any(String),
                authenticated: true,
            });
        });
    });

    describe('isValidSignature', () => {
        it('should validate development signatures', () => {
            const result = (guard as any).isValidSignature('device-123', 'dev-test-signature', {});

            expect(result).toBe(true);
        });

        it('should validate mock signatures correctly', () => {
            const deviceId = 'device-123';
            const body = { eventType: 'test' };
            const timestamp = '2023-01-01T12:00:00Z';

            // Generate expected signature
            const payload = JSON.stringify({ deviceId, body, timestamp });
            const expectedSignature = crypto
                .createHash('sha256')
                .update(`${payload}mock-device-secret`)
                .digest('hex')
                .substring(0, 32);

            const result = (guard as any).isValidSignature(
                deviceId,
                expectedSignature,
                body,
                timestamp
            );

            expect(result).toBe(true);
        });

        it('should reject invalid signatures', () => {
            const result = (guard as any).isValidSignature('device-123', 'invalid-signature', {});

            expect(result).toBe(false);
        });
    });
});
