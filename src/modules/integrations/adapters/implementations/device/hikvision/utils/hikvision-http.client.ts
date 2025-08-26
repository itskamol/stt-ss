import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, Method } from 'axios';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from '@/core/logger';
import * as crypto from 'crypto';
import { HIKVISION_ENDPOINTS, UNSUPPORTED_ERROR_PATTERNS } from '../constants/hikvision-endpoints';
import { Device } from '@prisma/client';
import { EncryptionService } from '@/shared/services/encryption.service';

@Injectable()
export class HikvisionHttpClient {
    constructor(
        private readonly logger: LoggerService,
        private readonly httpService: HttpService,
        private readonly encryptionService: EncryptionService,
    ) {}

    async request<T>(device: Device, config: AxiosRequestConfig): Promise<T> {
        const baseUrl = `http://${device.host}:${device.port}`;
        const url = `${baseUrl}${config.url}`;

        try {
            return (await firstValueFrom(this.httpService.request({ ...config, url }))).data;
        } catch (error: any) {
            if (error.response && error.response.status === 401) {
                const authHeader = error.response.headers['www-authenticate'];
                if (!authHeader || !authHeader.toLowerCase().startsWith('digest')) {
                    throw new HttpException(
                        'Server is not supporting Digest authentication.',
                        HttpStatus.INTERNAL_SERVER_ERROR
                    );
                }

                const digestParams = this.parseDigestHeader(authHeader);

                const authResponseHeader = this.createAuthorizationHeader(
                    device,
                    digestParams,
                    config.method.toUpperCase() as Method,
                    config.url
                );

                const finalConfig: AxiosRequestConfig = {
                    ...config,
                    url,
                    headers: {
                        ...config.headers,
                        Authorization: authResponseHeader,
                    },
                };

                try {
                    const response = await firstValueFrom(this.httpService.request<T>(finalConfig));
                    return response.data;
                } catch (e: any) {
                    this.logger.error(`Autentifikatsiyali so'rovda xatolik: ${e.message}`, e.stack);
                    throw new HttpException(
                        e.response?.data || e.message,
                        e.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
                    );
                }
            }
            this.logger.error(`Boshlang'ich so'rovda xatolik: ${error.message}`, error.stack);
            throw new HttpException(
                error.response?.data || error.message,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    private parseDigestHeader(header: string): Record<string, string> {
        const params: Record<string, string> = {};
        header
            .slice(7)
            .split(',')
            .forEach(part => {
                const [key, value] = part.trim().split(/=(.*)/s);
                params[key] = value.replace(/"/g, '');
            });
        return params;
    }

    private createAuthorizationHeader(
        device: Device,
        params: Record<string, string>,
        method: Method,
        uri: string
    ): string {
        const realm = params.realm;
        const qop = params.qop;
        const nonce = params.nonce;
        const opaque = params.opaque;
        const nc = '00000001';
        const cnonce = crypto.randomBytes(8).toString('hex');

        const password = this.encryptionService.decrypt(device.password);

        // `this.username` va `this.password` o'rniga `device`dan olingan ma'lumotlarni ishlatamiz
        const ha1 = crypto
            .createHash('md5')
            .update(`${device.username}:${realm}:${password}`)
            .digest('hex');
        const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
        const response = crypto
            .createHash('md5')
            .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
            .digest('hex');

        const authParts = [
            `username="${device.username}"`,
            `realm="${realm}"`,
            `nonce="${nonce}"`,
            `uri="${uri}"`,
            `qop=${qop}`,
            `nc=${nc}`,
            `cnonce="${cnonce}"`,
            `response="${response}"`,
            `opaque="${opaque}"`,
        ];

        return `Digest ${authParts.join(', ')}`;
    }

    // Qo'shimcha utility metodlar
    async testConnection(device: Device): Promise<boolean> {
        try {
            // Use working endpoints from testing
            const testEndpoints = [
                HIKVISION_ENDPOINTS.DEVICE_INFO.PRIMARY,
                HIKVISION_ENDPOINTS.SYSTEM.CAPABILITIES,
                HIKVISION_ENDPOINTS.DEVICE_INFO.ALTERNATIVES[0],
            ];

            for (const url of testEndpoints) {
                try {
                    await this.request(device, {
                        method: 'GET',
                        url,
                    });
                    this.logger.debug('Connection test successful', { url, host: device.host });
                    return true; // If any endpoint works, connection is successful
                } catch (error) {
                    this.logger.debug('Connection test endpoint failed', {
                        url,
                        error: error.message,
                    });
                    continue; // Try next endpoint
                }
            }

            return false; // All endpoints failed
        } catch (error) {
            this.logger.error('Connection test failed', error.message, {
                host: device.host,
            });
            return false;
        }
    }

    async getDeviceInfo(device: any): Promise<any> {
        // Use working endpoints from testing
        const possibleEndpoints = HIKVISION_ENDPOINTS.DEVICE_INFO.ALTERNATIVES.concat(
            HIKVISION_ENDPOINTS.DEVICE_INFO.PRIMARY
        );

        let lastError: any;
        for (const url of possibleEndpoints) {
            try {
                const result = await this.request(device, {
                    method: 'GET',
                    url,
                });
                this.logger.debug('Device info retrieved successfully', { url });
                return result;
            } catch (error) {
                lastError = error;
                this.logger.debug('Device info endpoint failed', { url, error: error.message });
                continue; // Try next endpoint
            }
        }

        this.logger.error('All device info endpoints failed', lastError?.message);
        throw new Error('No valid device info endpoint found');
    }

    async getChannels(device: any): Promise<any> {
        try {
            return this.request(device, {
                method: 'GET',
                url: HIKVISION_ENDPOINTS.VIDEO.INPUTS,
            });
        } catch (error) {
            this.logger.error('Failed to get channels', error.message);
            throw error;
        }
    }

    /**
     * Check if an endpoint is supported on the device
     */
    async isEndpointSupported(device: any, url: string): Promise<boolean> {
        try {
            await this.request(device, {
                method: 'GET',
                url,
            });
            return true;
        } catch (error) {
            const errorMessage = error.message.toLowerCase();
            const isUnsupported = UNSUPPORTED_ERROR_PATTERNS.some(pattern =>
                errorMessage.includes(pattern.toLowerCase())
            );
            return !isUnsupported;
        }
    }

    /**
     * Get device capabilities by checking supported endpoints
     */
    async getDeviceCapabilities(device: any): Promise<string> {
        const accessControl = await this.request<string>(device, {
            method: 'GET',
            url: HIKVISION_ENDPOINTS.ACCESS_CONTROL.CAPABILITIES,
        });

        return accessControl
    }
}
