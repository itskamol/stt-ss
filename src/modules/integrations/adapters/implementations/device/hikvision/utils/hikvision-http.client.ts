import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from '@/core/logger';
import { EncryptionService } from '@/shared/services/encryption.service';

@Injectable()
export class HikvisionHttpClient {
    private readonly AUTH_TIMEOUT = 5000;
    private readonly COMMAND_TIMEOUT = 10000;

    constructor(
        private readonly logger: LoggerService,
        private readonly httpService: HttpService,
        private readonly encryptionService: EncryptionService
    ) {}

    async request<T>(device: any, config: AxiosRequestConfig): Promise<T> {
        try {
            const url = `http://${device.host}:${device.port || 80}${config.url}`;

            const requestConfig: AxiosRequestConfig = {
                ...config,
                url,
                timeout: this.COMMAND_TIMEOUT,
                auth: {
                    username: device.username,
                    password: device.password,
                },
            };

            const response = await firstValueFrom(this.httpService.request(requestConfig));
            return response.data;
        } catch (error) {
            this.logger.error('HTTP request failed', error.message, {
                deviceId: device.id,
                url: config.url,
                method: config.method,
            });
            throw error;
        }
    }

    private async handleDigestAuth<T>(
        device: any,
        config: AxiosRequestConfig,
        url: string,
        error: any
    ): Promise<T> {
        // Digest auth logic
        return {} as T;
    }

    private parseDigestHeader(header: string): Record<string, string> {
        // Parse digest header logic
        return {};
    }

    private createDigestAuth(
        device: any,
        params: Record<string, string>,
        method: string,
        uri: string
    ): string {
        // Create digest auth logic
        return '';
    }
}