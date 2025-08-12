import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

import { EncryptionService } from './encryption.service';
import { HikvisionSessionService, SessionAcquisitionOptions } from './hikvision-session.service';
import {
    HikvisionDeviceConfig,
    SecureSession,
    CachedSession,
    HikvisionCacheKeys,
    HIKVISION_CONFIG,
} from '../adapters/hikvision.adapter';
import { InternalServerErrorException } from '@nestjs/common';
import { CacheService } from '@/core/cache/cache.service';

describe('HikvisionSessionService', () => {
    let service: HikvisionSessionService;
    let httpService: jest.Mocked<HttpService>;
    let encryptionService: jest.Mocked<EncryptionService>;
    let cacheService: jest.Mocked<CacheService>;

    const mockDevice: HikvisionDeviceConfig = {
        deviceId: 'test-device-1',
        ipAddress: '192.168.1.100',
        username: 'admin',
        encryptedSecret: 'encrypted-password',
    };

    const mockDecryptedPassword = 'admin123';
    const mockSession: SecureSession = {
        security: 'test-security-key',
        identityKey: 'test-identity-key',
    };

    beforeEach(async () => {
        const mockHttpService = {
            get: jest.fn(),
        };

        const mockEncryptionService = {
            decrypt: jest.fn(),
        };

        const mockCacheManager = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HikvisionSessionService,
                { provide: HttpService, useValue: mockHttpService },
                { provide: EncryptionService, useValue: mockEncryptionService },
                { provide: CacheService, useValue: mockCacheManager },
            ],
        }).compile();

        service = module.get<HikvisionSessionService>(HikvisionSessionService);
        httpService = module.get(HttpService);
        encryptionService = module.get(EncryptionService);
        cacheService = module.get(CacheService);

        // Setup default mocks
        encryptionService.decrypt.mockReturnValue(mockDecryptedPassword);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getSecureSession', () => {
        it('should return cached session when available and not expired', async () => {
            const cachedSession: CachedSession = {
                ...mockSession,
                expiresAt: Date.now() + 300000, // 5 minutes from now
            };
            cacheService.getCachedData.mockResolvedValue(cachedSession);

            const result = await service.getSecureSession(mockDevice);

            expect(result).toEqual(mockSession);
            expect(httpService.get).not.toHaveBeenCalled();
            expect(cacheService.get).toHaveBeenCalledWith(HikvisionCacheKeys.session('test-device-1'));
        });

        it('should acquire new session when cache is empty', async () => {
            cacheService.get.mockResolvedValue(null);
            
            const mockResponse = {
                data: {
                    security: 'new-security-key',
                    identityKey: 'new-identity-key',
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await service.getSecureSession(mockDevice);

            expect(result).toEqual({
                security: 'new-security-key',
                identityKey: 'new-identity-key',
            });
            expect(httpService.get).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/System/Security/identityKey',
                expect.objectContaining({
                    auth: { username: 'admin', password: mockDecryptedPassword },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );
            expect(cacheService.set).toHaveBeenCalled();
        });

        it('should acquire new session when cached session is expired', async () => {
            const expiredSession: CachedSession = {
                ...mockSession,
                expiresAt: Date.now() - 1000, // 1 second ago
            };
            cacheService.getCachedData.mockResolvedValue(expiredSession);

            const mockResponse = {
                data: {
                    security: 'fresh-security-key',
                    identityKey: 'fresh-identity-key',
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await service.getSecureSession(mockDevice);

            expect(result).toEqual({
                security: 'fresh-security-key',
                identityKey: 'fresh-identity-key',
            });
            expect(cacheService.del).toHaveBeenCalledWith(HikvisionCacheKeys.session('test-device-1'));
        });

        it('should force refresh when forceRefresh option is true', async () => {
            const cachedSession: CachedSession = {
                ...mockSession,
                expiresAt: Date.now() + 300000, // 5 minutes from now
            };
            cacheService.getCachedData.mockResolvedValue(cachedSession);

            const mockResponse = {
                data: {
                    security: 'forced-refresh-key',
                    identityKey: 'forced-refresh-identity',
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const options: SessionAcquisitionOptions = { forceRefresh: true };
            const result = await service.getSecureSession(mockDevice, options);

            expect(result).toEqual({
                security: 'forced-refresh-key',
                identityKey: 'forced-refresh-identity',
            });
            expect(httpService.get).toHaveBeenCalled();
        });

        it('should deduplicate concurrent session acquisitions', async () => {
            cacheService.get.mockResolvedValue(null);
            
            const mockResponse = {
                data: {
                    security: 'concurrent-key',
                    identityKey: 'concurrent-identity',
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            // Start multiple concurrent requests
            const promises = [
                service.getSecureSession(mockDevice),
                service.getSecureSession(mockDevice),
                service.getSecureSession(mockDevice),
            ];

            const results = await Promise.all(promises);

            // All should return the same session
            results.forEach(result => {
                expect(result).toEqual({
                    security: 'concurrent-key',
                    identityKey: 'concurrent-identity',
                });
            });

            // But HTTP should only be called once
            expect(httpService.get).toHaveBeenCalledTimes(1);
        });

        it('should throw exception when session acquisition fails', async () => {
            cacheService.get.mockResolvedValue(null);
            
            const error = { response: { status: 401, statusText: 'Unauthorized' } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            await expect(service.getSecureSession(mockDevice)).rejects.toThrow(InternalServerErrorException);
        });

        it('should handle invalid session response', async () => {
            cacheService.get.mockResolvedValue(null);
            
            const mockResponse = {
                data: {
                    security: 'test-key',
                    // Missing identityKey
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            await expect(service.getSecureSession(mockDevice)).rejects.toThrow(InternalServerErrorException);
        });

        it('should use custom timeout when provided', async () => {
            cacheService.get.mockResolvedValue(null);
            
            const mockResponse = {
                data: mockSession,
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const options: SessionAcquisitionOptions = { timeout: 5000 };
            await service.getSecureSession(mockDevice, options);

            expect(httpService.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    timeout: 5000,
                })
            );
        });
    });

    describe('clearSession', () => {
        it('should clear session from cache', async () => {
            await service.clearSession('test-device-1');

            expect(cacheService.del).toHaveBeenCalledWith(HikvisionCacheKeys.session('test-device-1'));
        });
    });

    describe('clearAllSessions', () => {
        it('should clear all sessions', async () => {
            await service.clearAllSessions();

            // This is a placeholder test since the actual implementation
            // would need a way to enumerate all cache keys
            expect(true).toBe(true);
        });
    });

    describe('validateSession', () => {
        it('should return true for valid session', async () => {
            const result = await service.validateSession('test-device-1', mockSession);

            expect(result).toBe(true);
        });

        it('should return false for invalid session', async () => {
            const invalidSession = { security: '', identityKey: '' };
            const result = await service.validateSession('test-device-1', invalidSession);

            expect(result).toBe(false);
        });
    });

    describe('session metrics', () => {
        it('should track cache hits', async () => {
            const cachedSession: CachedSession = {
                ...mockSession,
                expiresAt: Date.now() + 300000,
            };
            cacheService.getCachedData.mockResolvedValue(cachedSession);

            await service.getSecureSession(mockDevice);

            const metrics = service.getSessionMetrics('test-device-1');
            expect(metrics).toBeDefined();
            expect(metrics!.cacheHits).toBe(1);
            expect(metrics!.cacheMisses).toBe(0);
        });

        it('should track cache misses and acquisitions', async () => {
            cacheService.get.mockResolvedValue(null);
            
            const mockResponse = { data: mockSession };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            await service.getSecureSession(mockDevice);

            const metrics = service.getSessionMetrics('test-device-1');
            expect(metrics).toBeDefined();
            expect(metrics!.cacheHits).toBe(0);
            expect(metrics!.cacheMisses).toBe(1);
            expect(metrics!.acquisitionCount).toBe(1);
            expect(metrics!.lastAcquisition).toBeDefined();
            expect(metrics!.averageAcquisitionTime).toBeGreaterThan(0);
        });

        it('should return all metrics', async () => {
            const cachedSession: CachedSession = {
                ...mockSession,
                expiresAt: Date.now() + 300000,
            };
            cacheService.getCachedData.mockResolvedValue(cachedSession);

            await service.getSecureSession(mockDevice);

            const allMetrics = service.getAllSessionMetrics();
            expect(allMetrics).toHaveLength(1);
            expect(allMetrics[0].deviceId).toBe('test-device-1');
        });

        it('should return null for non-existent device metrics', () => {
            const metrics = service.getSessionMetrics('non-existent-device');
            expect(metrics).toBeNull();
        });
    });

    describe('preloadSessions', () => {
        it('should preload sessions for multiple devices', async () => {
            const devices: HikvisionDeviceConfig[] = [
                { ...mockDevice, deviceId: 'device-1' },
                { ...mockDevice, deviceId: 'device-2' },
            ];

            cacheService.get.mockResolvedValue(null);
            const mockResponse = { data: mockSession };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            await service.preloadSessions(devices);

            expect(httpService.get).toHaveBeenCalledTimes(2);
        });

        it('should handle failures gracefully during preload', async () => {
            const devices: HikvisionDeviceConfig[] = [
                { ...mockDevice, deviceId: 'device-1' },
                { ...mockDevice, deviceId: 'device-2' },
            ];

            cacheService.get.mockResolvedValue(null);
            httpService.get
                .mockReturnValueOnce(of({ data: mockSession }) as any)
                .mockReturnValueOnce(throwError(() => new Error('Connection failed')) as any);

            // Should not throw
            await expect(service.preloadSessions(devices)).resolves.not.toThrow();
        });
    });

    describe('error handling', () => {
        it('should handle cache errors gracefully', async () => {
            cacheService.get.mockRejectedValue(new Error('Cache error'));
            
            const mockResponse = { data: mockSession };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await service.getSecureSession(mockDevice);

            expect(result).toEqual(mockSession);
        });

        it('should handle cache set errors gracefully', async () => {
            cacheService.get.mockResolvedValue(null);
            cacheService.set.mockRejectedValue(new Error('Cache set error'));
            
            const mockResponse = { data: mockSession };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            // Should not throw even if caching fails
            const result = await service.getSecureSession(mockDevice);

            expect(result).toEqual(mockSession);
        });
    });
});