import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { HikvisionHttpClient } from '../utils/hikvision-http.client';
import {
    ISAPIResponse,
    PersonAddRequest,
    PersonDeleteRequest,
    PersonInfo,
    PersonModifyRequest,
    PersonSearchRequest,
    PersonSearchResponse,
} from '../types';

@Injectable()
export class HikvisionPersonManager {
    constructor(
        private readonly httpClient: HikvisionHttpClient,
        private readonly logger: LoggerService
    ) {}

    /**
     * Search persons in the device
     */
    async searchPersons(
        device: any,
        searchRequest: PersonSearchRequest
    ): Promise<PersonSearchResponse> {
        try {
            this.logger.debug('Searching persons', { deviceId: device.id, searchRequest });

            const response = await this.httpClient.request<PersonSearchResponse>(device, {
                method: 'POST',
                url: '/ISAPI/AccessControl/UserInfo/Search?format=json',
                data: searchRequest,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Person search completed', {
                deviceId: device.id,
                totalMatches: response.UserInfoSearch.totalMatches,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to search persons', error.message, {
                deviceId: device.id,
                searchRequest,
            });
            throw error;
        }
    }

    /**
     * Get total count of persons
     */
    async getPersonCount(device: any): Promise<number> {
        try {
            this.logger.debug('Getting person count', { deviceId: device.id });

            const response = await this.httpClient.request<{ totalMatches: number }>(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/UserInfo/Count?format=json',
            });

            return response.totalMatches || 0;
        } catch (error) {
            this.logger.error('Failed to get person count', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Add person to device
     */
    async addPerson(device: any, personRequest: PersonAddRequest): Promise<ISAPIResponse> {
        try {
            this.logger.debug('Adding person', {
                deviceId: device.id,
                employeeNo: personRequest.UserInfo.employeeNo,
            });

            const response = await this.httpClient.request<ISAPIResponse>(device, {
                method: 'POST',
                url: '/ISAPI/AccessControl/UserInfo/Record?format=json',
                data: personRequest,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Person added successfully', {
                deviceId: device.id,
                employeeNo: personRequest.UserInfo.employeeNo,
                statusCode: response.statusCode,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to add person', error.message, {
                deviceId: device.id,
                employeeNo: personRequest.UserInfo.employeeNo,
            });
            throw error;
        }
    }

    /**
     * Modify person information
     */
    async modifyPerson(device: any, personRequest: PersonModifyRequest): Promise<ISAPIResponse> {
        try {
            this.logger.debug('Modifying person', {
                deviceId: device.id,
                employeeNo: personRequest.UserInfo.employeeNo,
            });

            const response = await this.httpClient.request<ISAPIResponse>(device, {
                method: 'PUT',
                url: '/ISAPI/AccessControl/UserInfo/Modify?format=json',
                data: personRequest,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Person modified successfully', {
                deviceId: device.id,
                employeeNo: personRequest.UserInfo.employeeNo,
                statusCode: response.statusCode,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to modify person', error.message, {
                deviceId: device.id,
                employeeNo: personRequest.UserInfo.employeeNo,
            });
            throw error;
        }
    }

    /**
     * Delete persons from device
     */
    async deletePersons(device: any, deleteRequest: PersonDeleteRequest): Promise<ISAPIResponse> {
        try {
            this.logger.debug('Deleting persons', {
                deviceId: device.id,
                mode: deleteRequest.UserInfoDetail.mode,
            });

            const response = await this.httpClient.request<ISAPIResponse>(device, {
                method: 'PUT',
                url: '/ISAPI/AccessControl/UserInfoDetail/Delete?format=json',
                data: deleteRequest,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Persons deletion initiated', {
                deviceId: device.id,
                statusCode: response.statusCode,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to delete persons', error.message, {
                deviceId: device.id,
                deleteRequest,
            });
            throw error;
        }
    }

    /**
     * Get person deletion progress
     */
    async getDeleteProgress(device: any): Promise<any> {
        try {
            this.logger.debug('Getting delete progress', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/UserInfoDetail/DeleteProcess?format=json',
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to get delete progress', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Get person capabilities
     */
    async getPersonCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting person capabilities', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/UserInfo/capabilities?format=json',
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to get person capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Bulk add persons with validation
     */
    async bulkAddPersons(device: any, persons: PersonInfo[]): Promise<ISAPIResponse[]> {
        const results: ISAPIResponse[] = [];

        for (const person of persons) {
            try {
                const result = await this.addPerson(device, { UserInfo: person });
                results.push(result);
            } catch (error) {
                this.logger.error('Failed to add person in bulk operation', error.message, {
                    deviceId: device.id,
                    employeeNo: person.employeeNo,
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
     * Search person by employee number
     */
    async searchPersonByEmployeeNo(device: any, employeeNo: string): Promise<PersonInfo | null> {
        try {
            const searchRequest: PersonSearchRequest = {
                UserInfoSearchCond: {
                    searchID: `search_${Date.now()}`,
                    searchResultPosition: 0,
                    maxResults: 1,
                    EmployeeNoList: [{ employeeNo }],
                },
            };

            const response = await this.searchPersons(device, searchRequest);

            if (response.UserInfoSearch.numOfMatches > 0) {
                return response.UserInfoSearch.UserInfo[0];
            }

            return null;
        } catch (error) {
            this.logger.error('Failed to search person by employee number', error.message, {
                deviceId: device.id,
                employeeNo,
            });
            throw error;
        }
    }
}
