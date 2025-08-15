import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosRequestConfig, Method } from 'axios';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from '@/core/logger';
import * as crypto from 'crypto';
import { DeviceConnectionConfig } from '@/modules/device/device-adapter.strategy';

@Injectable()
export class HikvisionHttpClient {
    constructor(
        private readonly logger: LoggerService,
        private readonly httpService: HttpService
    ) {}

    async request<T>(deviceConfig: DeviceConnectionConfig, config: AxiosRequestConfig): Promise<T> {
        const baseUrl = `http://${deviceConfig.host}:${deviceConfig.port}`;
        const url = `${baseUrl}${config.url}`;

        try {
            await firstValueFrom(this.httpService.get(url));
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
                    deviceConfig,
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
        deviceConfig: DeviceConnectionConfig,
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

        // `this.username` va `this.password` o'rniga `device`dan olingan ma'lumotlarni ishlatamiz
        const ha1 = crypto
            .createHash('md5')
            .update(`${deviceConfig.username}:${realm}:${deviceConfig.password}`)
            .digest('hex');
        const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
        const response = crypto
            .createHash('md5')
            .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
            .digest('hex');

        const authParts = [
            `username="${deviceConfig.username}"`,
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

    private md5(input: string): string {
        return crypto.createHash('md5').update(input).digest('hex');
    }

    // Qo'shimcha utility metodlar
    async testConnection(deviceConfig: DeviceConnectionConfig): Promise<boolean> {
        try {
            // Use the same endpoint checking logic as in configuration manager
            const possibleEndpoints = [
                '/ISAPI/System/deviceInfo',
                '/ISAPI/System/status',
                '/ISAPI/System/deviceinfo',
                '/ISAPI/system/deviceInfo',
                '/ISAPI/ContentMgmt/System/deviceInfo',
                '/ISAPI/System/capabilities',
            ];

            for (const url of possibleEndpoints) {
                try {
                    await this.request(deviceConfig, {
                        method: 'GET',
                        url,
                    });
                    return true; // If any endpoint works, connection is successful
                } catch (error) {
                    continue; // Try next endpoint
                }
            }

            return false; // All endpoints failed
        } catch (error) {
            this.logger.error('Connection test failed', error.message, {
                host: deviceConfig.host,
            });
            return false;
        }
    }

    async getDeviceInfo(device: any): Promise<any> {
        // Use same fallback logic as configuration manager
        const possibleEndpoints = [
            '/ISAPI/System/deviceInfo',
            '/ISAPI/System/status',
            '/ISAPI/System/deviceinfo',
            '/ISAPI/system/deviceInfo',
            '/ISAPI/ContentMgmt/System/deviceInfo',
            '/ISAPI/System/capabilities',
        ];

        for (const url of possibleEndpoints) {
            try {
                return this.request(device, {
                    method: 'GET',
                    url,
                });
            } catch (error) {
                continue; // Try next endpoint
            }
        }

        throw new Error('No valid device info endpoint found');
    }

    async getChannels(device: any): Promise<any> {
        return this.request(device, {
            method: 'GET',
            url: '/ISAPI/System/Video/inputs',
        });
    }
}
