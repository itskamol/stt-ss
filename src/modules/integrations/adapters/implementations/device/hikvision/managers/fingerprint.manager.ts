import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { XmlJsonService } from '@/shared/services/xml-json.service';
import { HikvisionHttpClient } from '../utils/hikvision-http.client';
import { FingerprintAddRequest, FingerprintSearchResponse, ISAPIResponse } from '../types';

@Injectable()
export class HikvisionFingerprintManager {
    constructor(
        private readonly httpClient: HikvisionHttpClient,
        private readonly logger: LoggerService,
        private readonly xmlJsonService: XmlJsonService
    ) {}

    /**
     * Check if device supports fingerprint management
     */
    async checkFingerprintSupport(device: any): Promise<boolean> {
        try {
            this.logger.debug('Checking fingerprint support', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/capabilities',
            });

            // Parse XML response to check for isSupportFingerPrintCfg
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);
            const isSupportFingerPrint =
                jsonResponse?.AccessControlCap?.isSupportFingerPrintCfg === 'true';

            this.logger.debug('Fingerprint support check completed', {
                deviceId: device.id,
                supported: isSupportFingerPrint,
            });

            return isSupportFingerPrint;
        } catch (error) {
            this.logger.error('Failed to check fingerprint support', error.message, {
                deviceId: device.id,
            });
            return false;
        }
    }

    /**
     * Get fingerprint capabilities
     */
    async getFingerprintCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting fingerprint capabilities', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/FingerPrintCfg/capabilities?format=json',
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to get fingerprint capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Get fingerprint count for specific person
     */
    async getFingerprintCount(device: any, employeeNo?: string): Promise<number> {
        try {
            this.logger.debug('Getting fingerprint count', { deviceId: device.id, employeeNo });

            const url = employeeNo
                ? `/ISAPI/AccessControl/FingerPrint/Count?format=json&employeeNo=${employeeNo}`
                : '/ISAPI/AccessControl/FingerPrint/Count?format=json';

            const response = await this.httpClient.request<{ numberOfFP: number }>(device, {
                method: 'GET',
                url,
            });

            this.logger.debug('Fingerprint count retrieved', {
                deviceId: device.id,
                employeeNo,
                count: response.numberOfFP,
            });

            return response.numberOfFP || 0;
        } catch (error) {
            this.logger.error('Failed to get fingerprint count', error.message, {
                deviceId: device.id,
                employeeNo,
            });
            throw error;
        }
    }

    /**
     * Search fingerprint information
     */
    async searchFingerprints(device: any, searchRequest?: any): Promise<FingerprintSearchResponse> {
        try {
            this.logger.debug('Searching fingerprints', { deviceId: device.id, searchRequest });

            const response = await this.httpClient.request<FingerprintSearchResponse>(device, {
                method: 'POST',
                url: '/ISAPI/AccessControl/FingerPrintUpload?format=json',
                data: searchRequest || {},
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Fingerprint search completed', {
                deviceId: device.id,
                count: response.FingerPrintInfo?.length || 0,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to search fingerprints', error.message, {
                deviceId: device.id,
                searchRequest,
            });
            throw error;
        }
    }

    /**
     * Apply fingerprint (add or update)
     */
    async applyFingerprint(
        device: any,
        fingerprintData: FingerprintAddRequest
    ): Promise<ISAPIResponse & { employeeNo?: string; fingerPrintID?: string }> {
        try {
            this.logger.debug('Applying fingerprint', {
                deviceId: device.id,
                employeeNo: fingerprintData.employeeNo,
                fingerPrintID: fingerprintData.fingerPrintID,
            });

            const response = await this.httpClient.request<
                ISAPIResponse & { employeeNo?: string; fingerPrintID?: string }
            >(device, {
                method: 'POST',
                url: '/ISAPI/AccessControl/FingerPrint/SetUp?format=json',
                data: fingerprintData,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Fingerprint applied successfully', {
                deviceId: device.id,
                employeeNo: response.employeeNo,
                fingerPrintID: response.fingerPrintID,
                statusCode: response.statusCode,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to apply fingerprint', error.message, {
                deviceId: device.id,
                employeeNo: fingerprintData.employeeNo,
                fingerPrintID: fingerprintData.fingerPrintID,
            });
            throw error;
        }
    }

    /**
     * Add fingerprint (asynchronous operation)
     */
    async addFingerprint(
        device: any,
        fingerprintData: FingerprintAddRequest
    ): Promise<ISAPIResponse> {
        try {
            this.logger.debug('Adding fingerprint', {
                deviceId: device.id,
                employeeNo: fingerprintData.employeeNo,
                fingerPrintID: fingerprintData.fingerPrintID,
            });

            const response = await this.httpClient.request<ISAPIResponse>(device, {
                method: 'POST',
                url: '/ISAPI/AccessControl/FingerPrintDownload?format=json',
                data: fingerprintData,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Fingerprint addition initiated', {
                deviceId: device.id,
                employeeNo: fingerprintData.employeeNo,
                statusCode: response.statusCode,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to add fingerprint', error.message, {
                deviceId: device.id,
                employeeNo: fingerprintData.employeeNo,
                fingerPrintID: fingerprintData.fingerPrintID,
            });
            throw error;
        }
    }

    /**
     * Get fingerprint addition progress
     */
    async getFingerprintProgress(device: any): Promise<any> {
        try {
            this.logger.debug('Getting fingerprint progress', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/FingerPrintProgress?format=json',
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to get fingerprint progress', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Modify fingerprint information
     */
    async modifyFingerprint(
        device: any,
        fingerprintData: Partial<FingerprintAddRequest>
    ): Promise<ISAPIResponse & { employeeNo?: string; fingerPrintID?: string }> {
        try {
            this.logger.debug('Modifying fingerprint', {
                deviceId: device.id,
                employeeNo: fingerprintData.employeeNo,
                fingerPrintID: fingerprintData.fingerPrintID,
            });

            const response = await this.httpClient.request<
                ISAPIResponse & { employeeNo?: string; fingerPrintID?: string }
            >(device, {
                method: 'POST',
                url: '/ISAPI/AccessControl/FingerPrintModify?format=json',
                data: fingerprintData,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Fingerprint modified successfully', {
                deviceId: device.id,
                employeeNo: response.employeeNo,
                fingerPrintID: response.fingerPrintID,
                statusCode: response.statusCode,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to modify fingerprint', error.message, {
                deviceId: device.id,
                employeeNo: fingerprintData.employeeNo,
                fingerPrintID: fingerprintData.fingerPrintID,
            });
            throw error;
        }
    }

    /**
     * Delete fingerprints (asynchronous operation)
     */
    async deleteFingerprints(
        device: any,
        deleteRequest: {
            mode?: 'all' | 'byList';
            EmployeeNoList?: Array<{
                employeeNo: string;
                fingerPrintID?: string;
            }>;
        }
    ): Promise<ISAPIResponse> {
        try {
            this.logger.debug('Deleting fingerprints', { deviceId: device.id, deleteRequest });

            const response = await this.httpClient.request<ISAPIResponse>(device, {
                method: 'PUT',
                url: '/ISAPI/AccessControl/FingerPrint/Delete?format=json',
                data: deleteRequest,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Fingerprint deletion initiated', {
                deviceId: device.id,
                statusCode: response.statusCode,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to delete fingerprints', error.message, {
                deviceId: device.id,
                deleteRequest,
            });
            throw error;
        }
    }

    /**
     * Get fingerprint deletion progress
     */
    async getFingerprintDeleteProgress(device: any): Promise<any> {
        try {
            this.logger.debug('Getting fingerprint delete progress', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/FingerPrint/DeleteProcess?format=json',
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to get fingerprint delete progress', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Capture fingerprint data from device
     */
    async captureFingerprint(
        device: any,
        captureOptions: {
            readerID?: number;
            timeout?: number;
        } = {}
    ): Promise<any> {
        try {
            this.logger.debug('Capturing fingerprint', { deviceId: device.id, captureOptions });

            const captureRequest = {
                readerID: captureOptions.readerID || 1,
                timeout: captureOptions.timeout || 30000,
            };

            // Convert to XML format as required by the API
            const xmlData = this.xmlJsonService.jsonToXml(
                { CaptureFingerPrintCond: captureRequest },
                'CaptureFingerPrintCond'
            );

            const response = await this.httpClient.request(device, {
                method: 'POST',
                url: '/ISAPI/AccessControl/CaptureFingerPrint',
                data: xmlData,
                headers: {
                    'Content-Type': 'application/xml',
                },
            });

            this.logger.debug('Fingerprint capture initiated', {
                deviceId: device.id,
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            return jsonResponse;
        } catch (error) {
            this.logger.error('Failed to capture fingerprint', error.message, {
                deviceId: device.id,
                captureOptions,
            });
            throw error;
        }
    }

    /**
     * Bulk add fingerprints with validation
     */
    async bulkAddFingerprints(
        device: any,
        fingerprints: FingerprintAddRequest[]
    ): Promise<ISAPIResponse[]> {
        const results: ISAPIResponse[] = [];

        for (const fingerprint of fingerprints) {
            try {
                const result = await this.addFingerprint(device, fingerprint);
                results.push(result);

                // Wait for completion before adding next fingerprint
                let progress;
                do {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                    progress = await this.getFingerprintProgress(device);
                } while (progress?.status === 'processing');
            } catch (error) {
                this.logger.error('Failed to add fingerprint in bulk operation', error.message, {
                    deviceId: device.id,
                    employeeNo: fingerprint.employeeNo,
                    fingerPrintID: fingerprint.fingerPrintID,
                });
                results.push({
                    statusCode: 0,
                    statusString: 'Error',
                    subStatusCode: 'BulkAddFailed',
                    errorCode: -1,
                    errorMsg: error.message,
                });
            }
        }

        return results;
    }

    /**
     * Get fingerprint by employee number and fingerprint ID
     */
    async getFingerprintByEmployeeNo(
        device: any,
        employeeNo: string,
        fingerPrintID?: string
    ): Promise<any> {
        try {
            const searchResponse = await this.searchFingerprints(device, {
                employeeNo,
                fingerPrintID,
            });

            if (searchResponse.FingerPrintInfo && searchResponse.FingerPrintInfo.length > 0) {
                return fingerPrintID
                    ? searchResponse.FingerPrintInfo.find(fp => fp.fingerPrintID === fingerPrintID)
                    : searchResponse.FingerPrintInfo;
            }

            return null;
        } catch (error) {
            this.logger.error('Failed to get fingerprint by employee number', error.message, {
                deviceId: device.id,
                employeeNo,
                fingerPrintID,
            });
            throw error;
        }
    }
}
