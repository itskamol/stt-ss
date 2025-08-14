import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { XmlJsonService } from '@/shared/services/xml-json.service';
import { HikvisionHttpClient } from '../utils/hikvision-http.client';
import { HttpHostNotification, HttpHostNotificationList, ISAPIXMLResponse } from '../types';

@Injectable()
export class HikvisionEventHostManager {
    constructor(
        private readonly httpClient: HikvisionHttpClient,
        private readonly logger: LoggerService,
        private readonly xmlJsonService: XmlJsonService
    ) {}

    /**
     * Get listening host capabilities
     */
    async getListeningHostCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting listening host capabilities', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/Event/notification/httpHosts/capabilities',
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('Listening host capabilities retrieved', {
                deviceId: device.id,
            });

            return jsonResponse;
        } catch (error) {
            this.logger.error('Failed to get listening host capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Set parameters for a specific listening host
     */
    async setListeningHost(
        device: any,
        hostID: string,
        hostConfig: HttpHostNotification
    ): Promise<ISAPIXMLResponse> {
        try {
            this.logger.debug('Setting listening host', { deviceId: device.id, hostID });

            // Convert to XML format
            const xmlData = this.xmlJsonService.jsonToXml(
                { HttpHostNotification: hostConfig },
                'HttpHostNotification'
            );

            const response = await this.httpClient.request(device, {
                method: 'PUT',
                url: `/ISAPI/Event/notification/httpHosts/${hostID}`,
                data: xmlData,
                headers: {
                    'Content-Type': 'application/xml',
                },
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('Listening host set successfully', {
                deviceId: device.id,
                hostID,
                statusCode: jsonResponse.ResponseStatus?.statusCode,
            });

            return jsonResponse.ResponseStatus;
        } catch (error) {
            this.logger.error('Failed to set listening host', error.message, {
                deviceId: device.id,
                hostID,
            });
            throw error;
        }
    }

    /**
     * Get parameters for a specific listening host
     */
    async getListeningHost(device: any, hostID: string): Promise<HttpHostNotification> {
        try {
            this.logger.debug('Getting listening host', { deviceId: device.id, hostID });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: `/ISAPI/Event/notification/httpHosts/${hostID}`,
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('Listening host retrieved', {
                deviceId: device.id,
                hostID,
            });

            return jsonResponse.HttpHostNotification;
        } catch (error) {
            this.logger.error('Failed to get listening host', error.message, {
                deviceId: device.id,
                hostID,
            });
            throw error;
        }
    }

    /**
     * Get parameters for all listening hosts
     */
    async getAllListeningHosts(device: any): Promise<HttpHostNotification[]> {
        try {
            this.logger.debug('Getting all listening hosts', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/Event/notification/httpHosts',
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            const hosts = jsonResponse.HttpHostNotificationList?.HttpHostNotification || [];
            const hostArray = Array.isArray(hosts) ? hosts : [hosts];

            this.logger.debug('All listening hosts retrieved', {
                deviceId: device.id,
                count: hostArray.length,
            });

            return hostArray;
        } catch (error) {
            this.logger.error('Failed to get all listening hosts', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Set parameters for all listening hosts
     */
    async setAllListeningHosts(
        device: any,
        hostConfigs: HttpHostNotification[]
    ): Promise<ISAPIXMLResponse> {
        try {
            this.logger.debug('Setting all listening hosts', {
                deviceId: device.id,
                count: hostConfigs.length,
            });

            const hostList: HttpHostNotificationList = {
                HttpHostNotification: hostConfigs,
            };

            // Convert to XML format
            const xmlData = this.xmlJsonService.jsonToXml(
                { HttpHostNotificationList: hostList },
                'HttpHostNotificationList'
            );

            const response = await this.httpClient.request(device, {
                method: 'PUT',
                url: '/ISAPI/Event/notification/httpHosts',
                data: xmlData,
                headers: {
                    'Content-Type': 'application/xml',
                },
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('All listening hosts set successfully', {
                deviceId: device.id,
                count: hostConfigs.length,
                statusCode: jsonResponse.ResponseStatus?.statusCode,
            });

            return jsonResponse.ResponseStatus;
        } catch (error) {
            this.logger.error('Failed to set all listening hosts', error.message, {
                deviceId: device.id,
                count: hostConfigs.length,
            });
            throw error;
        }
    }

    /**
     * Delete all listening hosts
     */
    async deleteAllListeningHosts(device: any): Promise<ISAPIXMLResponse> {
        try {
            this.logger.debug('Deleting all listening hosts', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'DELETE',
                url: '/ISAPI/Event/notification/httpHosts',
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('All listening hosts deleted successfully', {
                deviceId: device.id,
                statusCode: jsonResponse.ResponseStatus?.statusCode,
            });

            return jsonResponse.ResponseStatus;
        } catch (error) {
            this.logger.error('Failed to delete all listening hosts', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Delete a specific listening host
     */
    async deleteListeningHost(device: any, hostID: string): Promise<ISAPIXMLResponse> {
        try {
            this.logger.debug('Deleting listening host', { deviceId: device.id, hostID });

            const response = await this.httpClient.request(device, {
                method: 'DELETE',
                url: `/ISAPI/Event/notification/httpHosts/${hostID}`,
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('Listening host deleted successfully', {
                deviceId: device.id,
                hostID,
                statusCode: jsonResponse.ResponseStatus?.statusCode,
            });

            return jsonResponse.ResponseStatus;
        } catch (error) {
            this.logger.error('Failed to delete listening host', error.message, {
                deviceId: device.id,
                hostID,
            });
            throw error;
        }
    }

    /**
     * Test listening service connectivity
     */
    async testListeningService(device: any, hostID: string): Promise<ISAPIXMLResponse> {
        try {
            this.logger.debug('Testing listening service', { deviceId: device.id, hostID });

            const response = await this.httpClient.request(device, {
                method: 'POST',
                url: `/ISAPI/Event/notification/httpHosts/${hostID}/test`,
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('Listening service test completed', {
                deviceId: device.id,
                hostID,
                statusCode: jsonResponse.ResponseStatus?.statusCode,
            });

            return jsonResponse.ResponseStatus;
        } catch (error) {
            this.logger.error('Failed to test listening service', error.message, {
                deviceId: device.id,
                hostID,
            });
            throw error;
        }
    }

    /**
     * Create a basic HTTP host configuration
     */
    createBasicHostConfig(
        id: string,
        url: string,
        host: string,
        port: number,
        options: {
            protocolType?: 'HTTP' | 'HTTPS';
            parameterFormatType?: 'XML' | 'JSON' | 'querystring';
            addressingFormatType?: 'hostname' | 'host';
            userName?: string;
            password?: string;
            httpAuthenticationMethod?: 'none' | 'MD5digest' | 'base64';
            uploadImagesDataType?: 'URL' | 'binary';
            heartbeat?: number;
            eventMode?: 'all' | 'list';
        } = {}
    ): HttpHostNotification {
        return {
            id,
            url,
            protocolType: options.protocolType || 'HTTP',
            parameterFormatType: options.parameterFormatType || 'JSON',
            addressingFormatType: options.addressingFormatType || 'host',
            host,
            portNo: port,
            userName: options.userName,
            password: options.password,
            httpAuthenticationMethod: options.httpAuthenticationMethod || 'none',
            uploadImagesDataType: options.uploadImagesDataType || 'URL',
            httpBroken: false,
            SubscribeEvent: {
                heartbeat: options.heartbeat || 30,
                eventMode: options.eventMode || 'all',
            },
        };
    }

    /**
     * Create event subscription configuration
     */
    createEventSubscription(
        eventTypes: string[],
        channels: string = '1,2,3,4',
        pictureURLType: string = 'binary'
    ) {
        return {
            heartbeat: 30,
            eventMode: 'list' as const,
            EventList: eventTypes.map(type => ({
                type,
                pictureURLType,
                channels,
            })),
            channels,
            pictureURLType,
        };
    }

    /**
     * Bulk configure multiple listening hosts
     */
    async bulkConfigureListeningHosts(
        device: any,
        hostConfigs: Array<{
            id: string;
            url: string;
            host: string;
            port: number;
            options?: any;
        }>
    ): Promise<ISAPIXMLResponse[]> {
        const results: ISAPIXMLResponse[] = [];

        for (const config of hostConfigs) {
            try {
                const hostConfig = this.createBasicHostConfig(
                    config.id,
                    config.url,
                    config.host,
                    config.port,
                    config.options
                );

                const result = await this.setListeningHost(device, config.id, hostConfig);
                results.push(result);
            } catch (error) {
                this.logger.error(
                    'Failed to configure listening host in bulk operation',
                    error.message,
                    {
                        deviceId: device.id,
                        hostId: config.id,
                    }
                );
                results.push({
                    requestURL: '',
                    statusCode: 0,
                    statusString: 'Error',
                    subStatusCode: 'BulkConfigFailed',
                });
            }
        }

        return results;
    }
}
