import { Injectable, Logger} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { EncryptionService } from './encryption.service';
import {
    SecureSession,
    CachedSession,
    HikvisionCacheKeys,
    HikvisionDeviceConfig,
    HikvisionErrorContext,
    HikvisionSecurityResponse,
    HIKVISION_ENDPOINTS,
    HIKVISION_CONFIG,
} from '../adapters/hikvision.adapter';
import { HikvisionExceptionFactory } from '../exceptions/hikvision.exceptions';
import { CacheService } from '@/core/cache/cache.service';

export interface SessionAcquisitionOptions {
    forceRefresh?: boolean;
    timeout?: number;
    retryCount?: number;
}

export interface SessionMetrics {
    deviceId: string;
    cacheHits: number;
    cacheMisses: number;
    acquisitionCount: number;
    lastAcquisition?: Date;
    averageAcquisitionTime?: number;
}

@Injectable()
export class HikvisionSessionService {
    private readonly logger = new Logger(HikvisionSessionService.name);
    private readonly sessionMetrics = new Map<string, SessionMetrics>();
    private readonly pendingAcquisitions = new Map<string, Promise<SecureSession>>();

    constructor(
        private readonly cacheService: CacheService,
        private readonly httpService: HttpService,
        private readonly encryptionService: EncryptionService,
    ) {}

    /**
     * Get secure session with intelligent caching and deduplication
     */
    async getSecureSession(
        device: HikvisionDeviceConfig,
        options: SessionAcquisitionOptions = {}
    ): Promise<SecureSession> {
        const { forceRefresh = false, timeout = HIKVISION_CONFIG.DEFAULT_TIMEOUT } = options;
        const cacheKey = HikvisionCacheKeys.session(device.deviceId);

        // Check if there's already a pending acquisition for this device
        if (!forceRefresh && this.pendingAcquisitions.has(device.deviceId)) {
            this.logger.debug('Waiting for pending session acquisition', { deviceId: device.deviceId });
            return this.pendingAcquisitions.get(device.deviceId)!;
        }

        // Check cache first (unless force refresh is requested)
        if (!forceRefresh) {
            const cached = await this.getCachedSession(device.deviceId);
            if (cached) {
                this.updateMetrics(device.deviceId, 'cache_hit');
                return cached;
            }
        }

        // Acquire new session with deduplication
        const acquisitionPromise = this.acquireNewSession(device, timeout);
        this.pendingAcquisitions.set(device.deviceId, acquisitionPromise);

        try {
            const session = await acquisitionPromise;
            this.updateMetrics(device.deviceId, 'cache_miss');
            return session;
        } finally {
            this.pendingAcquisitions.delete(device.deviceId);
        }
    }

    /**
     * Clear session from cache
     */
    async clearSession(deviceId: string): Promise<void> {
        this.logger.log('Clearing session cache', { deviceId });
        
        const cacheKey = HikvisionCacheKeys.session(deviceId);
        await this.cacheService.del(cacheKey);
        
        // Clear any pending acquisitions
        this.pendingAcquisitions.delete(deviceId);
        
        this.logger.log('Session cache cleared', { deviceId });
    }

    /**
     * Clear all sessions for cleanup
     */
    async clearAllSessions(): Promise<void> {
        this.logger.log('Clearing all session caches');
        
        // Clear all pending acquisitions
        this.pendingAcquisitions.clear();
        
        // In a real implementation, we'd need a way to get all session cache keys
        // For now, we'll just log the operation
        this.logger.log('All session caches cleared');
    }

    /**
     * Get session metrics for monitoring
     */
    getSessionMetrics(deviceId: string): SessionMetrics | null {
        return this.sessionMetrics.get(deviceId) || null;
    }

    /**
     * Get all session metrics
     */
    getAllSessionMetrics(): SessionMetrics[] {
        return Array.from(this.sessionMetrics.values());
    }

    /**
     * Validate if a session is still valid
     */
    async validateSession(deviceId: string, session: SecureSession): Promise<boolean> {
        try {
            // Try to use the session for a simple operation
            // This is a placeholder - in a real implementation, we'd make a test API call
            return session.security && session.identityKey ? true : false;
        } catch (error) {
            this.logger.warn('Session validation failed', { deviceId, error: error.message });
            return false;
        }
    }

    /**
     * Preload sessions for multiple devices
     */
    async preloadSessions(devices: HikvisionDeviceConfig[]): Promise<void> {
        this.logger.log('Preloading sessions for devices', { deviceCount: devices.length });

        const promises = devices.map(device => 
            this.getSecureSession(device).catch(error => {
                this.logger.warn('Failed to preload session', { 
                    deviceId: device.deviceId, 
                    error: error.message 
                });
                return null;
            })
        );

        await Promise.allSettled(promises);
        this.logger.log('Session preloading completed');
    }

    // ==================== Private Methods ====================

    private async getCachedSession(deviceId: string): Promise<SecureSession | null> {
        try {
            const cacheKey = HikvisionCacheKeys.session(deviceId);
            const cached = await this.cacheService.getCachedData<CachedSession>(cacheKey);
            
            const test = await this.cacheService.get(cacheKey)

            if (cached && cached.expiresAt > Date.now()) {
                this.logger.debug('Using cached session', { deviceId });
                return {
                    security: cached.security,
                    identityKey: cached.identityKey,
                };
            }

            if (cached) {
                this.logger.debug('Cached session expired', { deviceId });
                await this.cacheService.del(cacheKey);
            }

            return null;
        } catch (error) {
            this.logger.warn('Failed to get cached session', { deviceId, error: error.message });
            return null;
        }
    }

    private async acquireNewSession(device: HikvisionDeviceConfig, timeout: number): Promise<SecureSession> {
        const startTime = Date.now();
        const context = this.createErrorContext(device.deviceId, 'acquireNewSession');

        try {
            this.logger.debug('Acquiring new session', { deviceId: device.deviceId });

            const endpoint = this.buildEndpoint(device, HIKVISION_ENDPOINTS.SECURITY_KEY);
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout,
                    headers: {
                        'User-Agent': 'Hikvision-Adapter/1.0',
                    },
                })
            );

            const sessionData = response.data as HikvisionSecurityResponse;
            
            if (!sessionData.security || !sessionData.identityKey) {
                throw new Error('Invalid session response: missing security keys');
            }

            const session: SecureSession = {
                security: sessionData.security,
                identityKey: sessionData.identityKey,
            };

            // Cache the session
            await this.cacheSession(device.deviceId, session);

            const acquisitionTime = Date.now() - startTime;
            this.updateMetrics(device.deviceId, 'acquisition', acquisitionTime);

            this.logger.debug('Session acquired successfully', { 
                deviceId: device.deviceId, 
                acquisitionTime 
            });

            return session;

        } catch (error) {
            const acquisitionTime = Date.now() - startTime;
            const exception = HikvisionExceptionFactory.fromSessionError(
                context,
                `Failed to acquire session after ${acquisitionTime}ms`,
                error
            );
            
            this.logger.error('Session acquisition failed', { 
                deviceId: device.deviceId, 
                acquisitionTime,
                error: exception.message 
            });
            
            throw exception.toNestException();
        }
    }

    private async cacheSession(deviceId: string, session: SecureSession): Promise<void> {
        try {
            const cacheKey = HikvisionCacheKeys.session(deviceId);
            const cachedSession: CachedSession = {
                ...session,
                expiresAt: Date.now() + (HIKVISION_CONFIG.SESSION_CACHE_TTL * 1000),
            };

            await this.cacheService.cacheData(
                cacheKey, 
                cachedSession, 
                HIKVISION_CONFIG.SESSION_CACHE_TTL
            );

            this.logger.debug('Session cached', { 
                deviceId, 
                expiresAt: new Date(cachedSession.expiresAt).toISOString() 
            });

        } catch (error) {
            this.logger.warn('Failed to cache session', { deviceId, error: error.message });
            // Don't throw here - session acquisition was successful
        }
    }

    private updateMetrics(deviceId: string, operation: 'cache_hit' | 'cache_miss' | 'acquisition', time?: number): void {
        let metrics = this.sessionMetrics.get(deviceId);
        
        if (!metrics) {
            metrics = {
                deviceId,
                cacheHits: 0,
                cacheMisses: 0,
                acquisitionCount: 0,
            };
            this.sessionMetrics.set(deviceId, metrics);
        }

        switch (operation) {
            case 'cache_hit':
                metrics.cacheHits++;
                break;
            case 'cache_miss':
                metrics.cacheMisses++;
                break;
            case 'acquisition':
                metrics.acquisitionCount++;
                metrics.lastAcquisition = new Date();
                if (time) {
                    const currentAvg = metrics.averageAcquisitionTime || 0;
                    const count = metrics.acquisitionCount;
                    metrics.averageAcquisitionTime = ((currentAvg * (count - 1)) + time) / count;
                }
                break;
        }
    }

    private buildEndpoint(device: HikvisionDeviceConfig, path: string): string {
        const protocol = device.useHttps ? 'https' : 'http';
        const port = device.port || (device.useHttps ? HIKVISION_CONFIG.DEFAULT_HTTPS_PORT : HIKVISION_CONFIG.DEFAULT_PORT);
        
        return `${protocol}://${device.ipAddress}:${port}${path}`;
    }

    private createErrorContext(deviceId: string, operation: string): HikvisionErrorContext {
        return {
            deviceId,
            operation,
            endpoint: HIKVISION_ENDPOINTS.SECURITY_KEY,
            correlationId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
    }
}